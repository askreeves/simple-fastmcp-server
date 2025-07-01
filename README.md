# Simple FastMCP Server

A simple FastMCP (Model Context Protocol) server running on Cloudflare Workers. This server demonstrates how to build stateful MCP servers with multiple tools and resources.

## Features

- ✅ **Stateful operations** with persistent counter and message storage
- ✅ **Multiple transport methods** (SSE + Streamable HTTP)
- ✅ **5 interactive tools** for demonstration
- ✅ **2 resources** for data access
- ✅ **Global deployment** on Cloudflare's edge network
- ✅ **TypeScript** support with full type safety

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

# Run tests
npm run test
```

## MCP Client Connection

### SSE Transport (Legacy)
```
https://your-worker.your-subdomain.workers.dev/sse
```

### Streamable HTTP Transport (Preferred)
```
https://your-worker.your-subdomain.workers.dev/mcp
```

## Usage Examples

Once connected via an MCP client (like Claude Desktop, Cursor, etc.):

```
Human: Add 5 to the counter
AI: I'll add 5 to the counter for you.
[Uses add_to_counter tool]
Successfully added 5 to counter. New value: 5
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

## License

MIT
