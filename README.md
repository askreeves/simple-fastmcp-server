# Simple MCP Server

A Model Context Protocol (MCP) server running on Cloudflare Workers using the official TypeScript SDK. This server demonstrates how to build MCP servers with tools and resources.

## Features

- ✅ **Official MCP TypeScript SDK** implementation
- ✅ **5 interactive tools** for demonstration
- ✅ **2 resources** for data access
- ✅ **Stateful operations** with in-memory storage
- ✅ **Global deployment** on Cloudflare's edge network
- ✅ **TypeScript** support with full type safety
- ✅ **HTTP-based MCP transport** for web compatibility

## Tools Available

1. **add_to_counter** - Add a number to the persistent counter
2. **reset_counter** - Reset the counter to zero  
3. **get_time** - Get current server time
4. **send_message** - Store a message on the server
5. **get_message_count** - Get total number of stored messages

## Resources Available

1. **counter** - Current counter value
2. **messages** - Message history

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/askreeves/simple-fastmcp-server.git
cd simple-fastmcp-server
npm install
```

### 2. Deploy to Cloudflare

```bash
# Login to Cloudflare (if not already)
npx wrangler login

# Deploy the server
npm run deploy
```

### 3. Test the Server

```bash
# Health check
curl https://your-worker.your-subdomain.workers.dev/health

# View server info
curl https://your-worker.your-subdomain.workers.dev/
```

## Development

```bash
# Start local development server
npm run dev

# Run type checking
npm run typecheck

# Build TypeScript
npm run build
```

## MCP Client Connection

### HTTP Transport
```
https://your-worker.your-subdomain.workers.dev/mcp
```

## Usage Examples

Connect via an MCP client and test the tools:

### Example MCP Tool Call:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "add_to_counter",
    "arguments": {
      "amount": 5
    }
  }
}
```

### Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully added 5 to counter. New value: 5"
      }
    ]
  }
}
```

## Project Structure

```
├── src/
│   └── index.ts          # Main MCP server implementation
├── package.json          # Dependencies and scripts
├── wrangler.toml         # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Architecture

This server uses:
- **Official MCP TypeScript SDK** (`@modelcontextprotocol/sdk`)
- **HTTP-based transport** for web compatibility
- **In-memory state** (can be upgraded to KV/D1/Durable Objects)
- **JSON-RPC 2.0** protocol implementation
- **Cloudflare Workers** runtime for global deployment

## Extending the Server

To add new tools:
```typescript
server.registerTool(
  "your_tool_name",
  {
    title: "Your Tool",
    description: "What your tool does",
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string" }
      },
      required: ["param"]
    }
  },
  async ({ param }) => {
    // Your tool logic here
    return {
      content: [
        { type: "text", text: `Result: ${param}` }
      ]
    };
  }
);
```

## License

MIT