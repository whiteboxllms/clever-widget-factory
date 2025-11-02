# MCP Server Deployment Guide

## Overview

This guide covers deploying the Clever Widget Factory MCP Server as a Supabase Edge Function.

## Prerequisites

- Supabase CLI installed and configured
- Access to your Supabase project
- Local Supabase instance running (for testing)

## Local Development Setup

### 1. Start Local Supabase

```bash
# Start local Supabase (includes database and functions)
supabase start
```

### 2. Serve Function Locally

```bash
# In another terminal, serve the function with auto-reload
supabase functions serve mcp-server --env-file ./supabase/.env.local

# The MCP server will be available at:
# http://localhost:54321/functions/v1/mcp-server
```

### 3. Test Locally

You can test the server using:

#### Manual Testing with cURL

```bash
# Test tool listing
curl -X POST http://localhost:54321/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}}'

# Test a tool call
curl -X POST http://localhost:54321/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "list_issues",
      "arguments": {
        "organization_id": "your-org-id",
        "limit": 5
      }
    }
  }'
```

#### MCP Inspector Tool

Create a simple HTML test client:

```html
<!DOCTYPE html>
<html>
<head>
    <title>MCP Server Inspector</title>
</head>
<body>
    <h1>MCP Server Inspector</h1>
    <div id="output"></div>
    <script>
        // Connect to MCP server via SSE
        const eventSource = new EventSource('http://localhost:54321/functions/v1/mcp-server');
        
        eventSource.onmessage = function(event) {
            document.getElementById('output').innerHTML += '<pre>' + event.data + '</pre>';
        };
    </script>
</body>
</html>
```

## Production Deployment

### 1. Deploy to Supabase

```bash
# Deploy the function
supabase functions deploy mcp-server

# Verify deployment
supabase functions list
```

### 2. Environment Variables

The following environment variables are automatically provided by Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional custom variables:
- `MCP_SERVER_VERSION` - Version tracking

### 3. Test Production Deployment

```bash
# Test production endpoint
curl -X POST https://your-project.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{"method": "tools/list", "params": {}}'
```

## Configuration

### Claude Desktop Integration

To use with Claude Desktop, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clever-widget-factory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-stdio"],
      "env": {
        "MCP_SERVER_URL": "https://your-project.supabase.co/functions/v1/mcp-server"
      }
    }
  }
}
```

### Custom MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL('https://your-project.supabase.co/functions/v1/mcp-server'),
  {}
);

const client = new Client(
  {
    name: 'my-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  }
);

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool({
  name: 'list_issues',
  arguments: {
    organization_id: 'your-org-id',
    limit: 10
  }
});
console.log('Result:', result);
```

## Monitoring and Logging

### Function Logs

```bash
# View function logs
supabase functions logs mcp-server

# Follow logs in real-time
supabase functions logs mcp-server --follow
```

### Database Logging

All tool invocations are logged to the console with:
- Timestamp
- Tool name
- Organization ID
- User ID (if provided)
- Success/failure status
- Parameters (sanitized)

## Troubleshooting

### Common Issues

1. **Function not starting**
   - Check Supabase CLI is installed and configured
   - Verify local Supabase is running (`supabase status`)
   - Check function code for syntax errors

2. **Database connection errors**
   - Verify environment variables are set correctly
   - Check database is accessible from function
   - Ensure service role key has proper permissions

3. **Tool validation errors**
   - Check input parameters match schema requirements
   - Verify organization_id is valid UUID
   - Ensure required fields are provided

4. **Permission errors**
   - Verify service role key has necessary permissions
   - Check Row Level Security (RLS) policies
   - Ensure organization exists and is active

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export DEBUG=mcp-server:*
```

## Security Considerations

1. **Organization Isolation**: All tools validate organization access
2. **Input Validation**: All inputs are validated using Zod schemas
3. **Audit Logging**: All operations are logged for audit trails
4. **Rate Limiting**: Consider implementing rate limiting for production
5. **API Keys**: Consider adding API key authentication for additional security

## Performance Optimization

1. **Database Indexing**: Ensure proper indexes on frequently queried fields
2. **Connection Pooling**: Supabase handles connection pooling automatically
3. **Caching**: Consider caching frequently accessed data
4. **Pagination**: Use limit parameters to control result set sizes

## Maintenance

### Updating the Function

```bash
# Make changes to function code
# Then redeploy
supabase functions deploy mcp-server
```

### Database Schema Changes

If database schema changes are needed:
1. Create migration files in `supabase/migrations/`
2. Apply migrations: `supabase db push`
3. Update function code to handle schema changes
4. Redeploy function

### Version Management

Track versions using:
- Git tags for code versions
- `MCP_SERVER_VERSION` environment variable
- Function deployment timestamps

## Support

For issues or questions:
1. Check function logs for error details
2. Verify database connectivity and permissions
3. Test with minimal tool calls to isolate issues
4. Refer to Supabase Edge Functions documentation
5. Contact development team for complex issues
