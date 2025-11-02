# Environment Setup

This project uses a hybrid environment variable approach for maximum flexibility and security.

## Quick Setup

1. **Copy the example file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Add your OpenRouter API key** to `.env.local`:
   ```env
   VITE_OPENROUTER_API_KEY="your_openrouter_api_key_here"
   ```

3. **Optional: Local Supabase Development**
   
   If you want to use a local Supabase instance, add to `.env.local`:
   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=your_local_anon_key_here

   # Note: OpenRouter API key is now stored securely in Supabase Edge Functions
   # See: supabase secrets set OPENROUTER_API_KEY=your_key
   ```

   To get your local Supabase anon key:
   - Start your local Supabase: `supabase start`
   - Go to http://localhost:54323 (Supabase Studio)
   - Navigate to Settings > API
   - Copy the "anon public" key

## How It Works

The project uses two environment files:

- **`.env`** (committed to git) - Contains public Supabase credentials
- **`.env.local`** (gitignored) - Contains private API keys and optional local overrides

The `src/integrations/supabase/client.ts` file:
- ✅ Loads from `.env.local` first (if it exists)
- ✅ Falls back to `.env` for Supabase credentials
- ✅ Supports both local and production environments

## Environment Variables

| Variable | Description | Local Value | Production Value |
|----------|-------------|-------------|------------------|
| `VITE_SUPABASE_URL` | Supabase API URL | `http://127.0.0.1:54321` | `https://oskwnlhuuxjfuwnjuavn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Your local key | Production key |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features (Edge Function secret) | Set via `supabase secrets set` | Production key stored in Supabase |

## Switching Environments

- **Local Development**: Create `.env.local` with local values
- **Production**: Remove `.env.local` or set production values
- **No Config**: Falls back to production (current behavior)

## File Structure

```
project-root/
├── .env.local          # Local environment (gitignored)
├── .env.example        # Example configuration
└── src/integrations/supabase/
    └── client.ts       # Updated to use env vars
```

The `.env.local` file is gitignored, so your local configuration won't be committed to the repository.

## Production Deployment

### OpenRouter API Key (Secured Server-Side)

The OpenRouter API key is now stored securely in Supabase Edge Functions secrets and is never exposed to the client.

#### Setting the Secret

Use the Supabase CLI to set the secret:

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here --project-ref your-project-ref
```

Find your project ref in your Supabase dashboard URL: `https://app.supabase.com/project/<project-ref>`

#### Local Development

For local development, create `supabase/.env.local`:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Then serve the function with:
```bash
supabase functions serve mcp-server --env-file ./supabase/.env.local
```

#### Frontend Deployment

No frontend environment variables are needed. The API key is accessed server-side only through the MCP server Edge Function.

### Backend Deployment (Supabase Edge Functions)

For Supabase Edge Functions, secrets are managed via CLI:

1. **Set the secret:**
   ```bash
   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here --project-ref your-project-ref
   ```

2. **Verify it's set:**
   ```bash
   supabase secrets list --project-ref your-project-ref
   ```

3. **Access in function code:**
   ```typescript
   const apiKey = Deno.env.get('OPENROUTER_API_KEY');
   ```

**Note:** The 5 Whys feature now uses the MCP server for all AI chat, so the API key is stored securely server-side.
