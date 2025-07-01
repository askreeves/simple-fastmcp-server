import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// State management using a simple in-memory store
// In production, you'd use Cloudflare KV, D1, or Durable Objects
let globalState = {
  counter: 0,
  messages: [] as string[],
};

/**
 * Simple MCP Server Example using the official TypeScript SDK
 * 
 * This server demonstrates:
 * - Tool creation with the official MCP TypeScript SDK
 * - State management (using in-memory storage for simplicity)
 * - Proper MCP protocol implementation
 * - Working with Cloudflare Workers via HTTP transport
 */

// Create MCP server instance
const server = new McpServer({
  name: "Simple MCP Server",
  version: "1.0.0",
});

// Register tools with the server
server.registerTool(
  "add_to_counter",
  {
    title: "Add to Counter",
    description: "Add a number to the persistent counter",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "The number to add to the counter"
        }
      },
      required: ["amount"]
    }
  },
  async ({ amount }) => {
    const oldValue = globalState.counter;
    const newValue = oldValue + amount;
    globalState.counter = newValue;
    
    const message = `Added ${amount}: ${oldValue} → ${newValue}`;
    globalState.messages.push(message);

    return {
      content: [
        {
          type: "text",
          text: `Successfully added ${amount} to counter. New value: ${newValue}`
        }
      ]
    };
  }
);

server.registerTool(
  "reset_counter",
  {
    title: "Reset Counter",
    description: "Reset the counter to zero",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  async () => {
    globalState.counter = 0;
    globalState.messages.push("Counter reset to 0");

    return {
      content: [
        {
          type: "text",
          text: "Counter has been reset to 0"
        }
      ]
    };
  }
);

server.registerTool(
  "get_time",
  {
    title: "Get Current Time",
    description: "Get the current server time",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  async () => {
    const now = new Date().toISOString();
    globalState.messages.push(`Time requested: ${now}`);

    return {
      content: [
        {
          type: "text",
          text: `Current server time: ${now}`
        }
      ]
    };
  }
);

server.registerTool(
  "send_message",
  {
    title: "Send Message",
    description: "Send a message to be stored on the server",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to store"
        }
      },
      required: ["message"]
    }
  },
  async ({ message }) => {
    const timestamp = new Date().toISOString();
    const messageWithTime = `[${timestamp}] ${message}`;
    globalState.messages.push(messageWithTime);

    return {
      content: [
        {
          type: "text",
          text: `Message stored: ${messageWithTime}`
        }
      ]
    };
  }
);

server.registerTool(
  "get_message_count",
  {
    title: "Get Message Count",
    description: "Get the total number of messages stored",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  async () => {
    const count = globalState.messages.length;

    return {
      content: [
        {
          type: "text",
          text: `Total messages stored: ${count}`
        }
      ]
    };
  }
);

// Register resources
server.registerResource(
  "counter",
  {
    title: "Counter Value",
    description: "Current counter value",
    uri: "mcp://resource/counter",
    mimeType: "text/plain"
  },
  async () => {
    return {
      contents: [
        {
          uri: "mcp://resource/counter",
          text: `Current counter value: ${globalState.counter}`,
          mimeType: "text/plain"
        }
      ]
    };
  }
);

server.registerResource(
  "messages",
  {
    title: "Message History",
    description: "All stored messages",
    uri: "mcp://resource/messages",
    mimeType: "text/plain"
  },
  async () => {
    return {
      contents: [
        {
          uri: "mcp://resource/messages",
          text: globalState.messages.join("\\n"),
          mimeType: "text/plain"
        }
      ]
    };
  }
);

// Cloudflare Workers Streamable HTTP Transport Implementation
class CloudflareWorkerTransport {
  private server: McpServer;
  private isConnected = false;

  constructor(server: McpServer) {
    this.server = server;
  }

  async connect() {
    if (this.isConnected) return;
    
    // Set up event handlers for the MCP server
    this.server.onRequest = async (request, extra) => {
      // Handle incoming MCP requests
      console.log("Received MCP request:", request.method);
      return this.server.handleRequest(request);
    };

    this.isConnected = true;
    console.log("MCP Server connected via Cloudflare Worker Transport");
  }

  async handleHttpRequest(request: Request): Promise<Response> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json() as any;
      
      console.log("Processing MCP request:", body.method);
      
      // Use the server's built-in request handling
      const response = await this.server.request(body, {});
      
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
      
    } catch (error) {
      console.error("Error processing MCP request:", error);
      
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `Internal error: ${error}`
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}

// Create transport instance
const transport = new CloudflareWorkerTransport(server);

// Initialize the server
async function initializeServer() {
  try {
    await transport.connect();
    console.log("MCP Server initialized successfully");
  } catch (error) {
    console.error("Failed to initialize MCP server:", error);
  }
}

// Initialize on first request
let initialized = false;

// Cloudflare Workers fetch handler
export default {
  async fetch(request: Request, env: {}, ctx: ExecutionContext): Promise<Response> {
    // Initialize server on first request
    if (!initialized) {
      await initializeServer();
      initialized = true;
    }

    const { pathname } = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    
    // Handle MCP protocol requests
    if (pathname === '/mcp') {
      return transport.handleHttpRequest(request);
    }
    
    // Health check endpoint
    if (pathname === '/health') {
      return Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'Simple MCP Server',
        version: '1.0.0',
        state: {
          counter: globalState.counter,
          messageCount: globalState.messages.length
        },
        mcp: {
          initialized: initialized,
          connected: true
        }
      });
    }
    
    // Root endpoint with info
    if (pathname === '/') {
      return new Response(`
# Simple MCP Server

This is a Model Context Protocol server running on Cloudflare Workers.

## Endpoints

- \`/mcp\` - MCP protocol endpoint (POST)
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

Connect your MCP client to the \`/mcp\` endpoint using HTTP POST.

## Current State

- Counter: ${globalState.counter}
- Messages: ${globalState.messages.length}
- Server Status: ${initialized ? 'Initialized' : 'Not Initialized'}

## Test MCP Connection

\`\`\`bash
curl -X POST https://your-worker.workers.dev/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
\`\`\`
      `, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Handle 404
    return new Response('Not found', { status: 404 });
  },
};