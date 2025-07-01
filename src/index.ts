import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define the state type for our MCP server
type State = { 
  counter: number;
  messages: string[];
};

/**
 * Simple FastMCP Server Example
 * 
 * This server demonstrates:
 * - Basic tool creation
 * - Stateful operations
 * - Resource management
 * - Multiple transport support (SSE + Streamable HTTP)
 */
export class SimpleFastMCP extends McpAgent<{}, State, {}> {
  server = new McpServer({
    name: "Simple FastMCP Server",
    version: "1.0.0",
  });

  // Initial state for the server
  initialState: State = {
    counter: 0,
    messages: [],
  };

  async init() {
    // Define a resource that shows the current counter value
    this.server.resource(
      "counter",
      "mcp://resource/counter",
      "Current counter value",
      (uri) => {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Current counter value: ${this.state.counter}`,
              mimeType: "text/plain"
            }
          ],
        };
      }
    );

    // Define a resource that shows message history
    this.server.resource(
      "messages",
      "mcp://resource/messages",
      "Message history",
      (uri) => {
        return {
          contents: [
            {
              uri: uri.href,
              text: this.state.messages.join("\n"),
              mimeType: "text/plain"
            }
          ],
        };
      }
    );

    // Tool: Add to counter
    this.server.tool(
      "add_to_counter",
      "Add a number to the counter",
      {
        amount: z.number().describe("The number to add to the counter")
      },
      async ({ amount }) => {
        const oldValue = this.state.counter;
        const newValue = oldValue + amount;
        
        this.setState({
          ...this.state,
          counter: newValue,
          messages: [...this.state.messages, `Added ${amount}: ${oldValue} → ${newValue}`]
        });

        return {
          content: [
            {
              type: "text",
              text: `Successfully added ${amount} to counter. New value: ${newValue}`
            }
          ],
        };
      }
    );

    // Tool: Reset counter
    this.server.tool(
      "reset_counter",
      "Reset the counter to zero",
      {},
      async () => {
        this.setState({
          ...this.state,
          counter: 0,
          messages: [...this.state.messages, "Counter reset to 0"]
        });

        return {
          content: [
            {
              type: "text",
              text: "Counter has been reset to 0"
            }
          ],
        };
      }
    );

    // Tool: Get current time
    this.server.tool(
      "get_time",
      "Get the current server time",
      {},
      async () => {
        const now = new Date().toISOString();
        
        this.setState({
          ...this.state,
          messages: [...this.state.messages, `Time requested: ${now}`]
        });

        return {
          content: [
            {
              type: "text",
              text: `Current server time: ${now}`
            }
          ],
        };
      }
    );

    // Tool: Send message
    this.server.tool(
      "send_message",
      "Send a message to be stored in the server",
      {
        message: z.string().describe("The message to store")
      },
      async ({ message }) => {
        const timestamp = new Date().toISOString();
        const messageWithTime = `[${timestamp}] ${message}`;
        
        this.setState({
          ...this.state,
          messages: [...this.state.messages, messageWithTime]
        });

        return {
          content: [
            {
              type: "text",
              text: `Message stored: ${messageWithTime}`
            }
          ],
        };
      }
    );

    // Tool: Get message count
    this.server.tool(
      "get_message_count",
      "Get the total number of messages stored",
      {},
      async () => {
        const count = this.state.messages.length;
        
        return {
          content: [
            {
              type: "text",
              text: `Total messages stored: ${count}`
            }
          ],
        };
      }
    );
  }

  // Called whenever state is updated
  onStateUpdate(state: State) {
    console.log("State updated:", { 
      counter: state.counter, 
      messageCount: state.messages.length 
    });
  }
}

// Worker fetch handler - supports both SSE and Streamable HTTP
export default {
  fetch(request: Request, env: {}, ctx: ExecutionContext): Response | Promise<Response> {
    const { pathname } = new URL(request.url);
    
    // Handle SSE transport (legacy, but still widely supported)
    if (pathname.startsWith('/sse')) {
      return SimpleFastMCP.serveSSE('/sse').fetch(request, env, ctx);
    }
    
    // Handle Streamable HTTP transport (newer, preferred)
    if (pathname.startsWith('/mcp')) {
      return SimpleFastMCP.serve('/mcp').fetch(request, env, ctx);
    }
    
    // Health check endpoint
    if (pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        transport: {
          sse: '/sse',
          streamable_http: '/mcp'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Root endpoint with info
    if (pathname === '/') {
      return new Response(`
# Simple FastMCP Server

This is a simple FastMCP server running on Cloudflare Workers.

## Endpoints

- \`/sse\` - Server-Sent Events transport
- \`/mcp\` - Streamable HTTP transport  
- \`/health\` - Health check

## Tools Available

1. **add_to_counter** - Add a number to the persistent counter
2. **reset_counter** - Reset the counter to zero
3. **get_time** - Get current server time
4. **send_message** - Store a message on the server
5. **get_message_count** - Get total number of stored messages

## Resources Available

1. **counter** - Current counter value
2. **messages** - Message history

## Usage

Connect your MCP client to one of the transport endpoints above.
      `, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Handle 404
    return new Response('Not found', { status: 404 });
  },
};
