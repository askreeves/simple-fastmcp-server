import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
 * - Multiple transport support via Cloudflare Workers
 * - Proper MCP protocol implementation
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

// Simple HTTP-based MCP transport for Cloudflare Workers
class WorkerMCPTransport {
  constructor(private server: McpServer) {}

  async handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json() as any;
      
      // Handle MCP protocol messages
      switch (body.method) {
        case 'initialize':
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {}
              },
              serverInfo: {
                name: "Simple MCP Server",
                version: "1.0.0"
              }
            }
          });

        case 'tools/list':
          const tools = Array.from((this.server as any)._tools.keys()).map(name => {
            const tool = (this.server as any)._tools.get(name);
            return {
              name,
              description: tool.metadata.description,
              inputSchema: tool.metadata.inputSchema
            };
          });
          
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: { tools }
          });

        case 'tools/call':
          const toolName = body.params.name;
          const args = body.params.arguments || {};
          
          try {
            const result = await (this.server as any)._callTool(toolName, args);
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              result
            });
          } catch (error) {
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32603,
                message: `Tool execution failed: ${error}`
              }
            });
          }

        case 'resources/list':
          const resources = Array.from((this.server as any)._resources.keys()).map(name => {
            const resource = (this.server as any)._resources.get(name);
            return {
              name,
              description: resource.metadata.description,
              uri: resource.metadata.uri,
              mimeType: resource.metadata.mimeType
            };
          });
          
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: { resources }
          });

        case 'resources/read':
          const resourceUri = body.params.uri;
          // Simple resource lookup by URI
          const resourceName = resourceUri.split('/').pop();
          
          try {
            const result = await (this.server as any)._readResource(resourceName, resourceUri);
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              result
            });
          } catch (error) {
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32603,
                message: `Resource read failed: ${error}`
              }
            });
          }

        default:
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`
            }
          });
      }
    } catch (error) {
      return Response.json({
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "Parse error"
        }
      });
    }
  }
}

// Create transport instance
const transport = new WorkerMCPTransport(server);

// Cloudflare Workers fetch handler
export default {
  async fetch(request: Request, env: {}, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    
    // Handle MCP protocol requests
    if (pathname === '/mcp') {
      return transport.handleRequest(request);
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
        }
      });
    }
    
    // Root endpoint with info
    if (pathname === '/') {
      return new Response(`
# Simple MCP Server

This is a Model Context Protocol server running on Cloudflare Workers.

## Endpoints

- \`/mcp\` - MCP protocol endpoint
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

Connect your MCP client to the \`/mcp\` endpoint.

## Current State

- Counter: ${globalState.counter}
- Messages: ${globalState.messages.length}
      `, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Handle 404
    return new Response('Not found', { status: 404 });
  },
};