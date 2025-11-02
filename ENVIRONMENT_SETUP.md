# Environment Setup for Supabase

This project now supports both local and production Supabase configurations through environment variables.

## Quick Setup

1. **Create a `.env.local` file** in the project root:
   ```bash
   touch .env.local
   ```

2. **Add your local Supabase configuration** to `.env.local`:
   ```env
   # Local Supabase Configuration
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=your_local_anon_key_here

   # AI Features (5 Whys Coach)
   VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

3. **Get your local Supabase anon key**:
   - Start your local Supabase: `supabase start`
   - Go to http://localhost:54323 (Supabase Studio)
   - Navigate to Settings > API
   - Copy the "anon public" key
   - Replace `your_local_anon_key_here` with the actual key

## How It Works

The `src/integrations/supabase/client.ts` file now:
- ✅ Loads configuration from environment variables first
- ✅ Falls back to production values if no env vars are set
- ✅ Supports both local and production environments

## Environment Variables

| Variable | Description | Local Value | Production Value |
|----------|-------------|-------------|------------------|
| `VITE_SUPABASE_URL` | Supabase API URL | `http://127.0.0.1:54321` | `https://oskwnlhuuxjfuwnjuavn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Your local key | Production key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter API key for AI features | Your OpenRouter key | Production key |

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

### Frontend Deployment (Vite)

The `VITE_OPENROUTER_API_KEY` must be set as an environment variable in your deployment platform **at build time**. Vite embeds these variables into the client bundle during build.

#### Vercel

1. Go to your project settings in Vercel
2. Navigate to **Settings > Environment Variables**
3. Add the following variable:
   - **Key:** `VITE_OPENROUTER_API_KEY`
   - **Value:** Your OpenRouter API key
   - **Environment:** Production (and Preview/Development if needed)
4. Redeploy your application

#### Netlify

1. Go to your site settings in Netlify
2. Navigate to **Site configuration > Environment variables**
3. Add the following variable:
   - **Key:** `VITE_OPENROUTER_API_KEY`
   - **Value:** Your OpenRouter API key
   - **Scopes:** Production (and Deploy previews if needed)
4. Trigger a new deploy

#### Other Platforms (AWS, Cloudflare Pages, etc.)

Set `VITE_OPENROUTER_API_KEY` as an environment variable in your build/deployment configuration before running `npm run build`.

**Important Security Notes:**
- ⚠️ **`VITE_` prefixed variables are exposed to client-side code** - they will be visible in the browser bundle
- ✅ This is acceptable for OpenRouter API keys as they should be rate-limited and have usage controls
- ✅ Consider using domain/IP restrictions on your OpenRouter account for additional security
- ❌ Never use `VITE_` prefix for server-side secrets (use Edge Functions secrets instead)

### Backend Deployment (Supabase Edge Functions)

For Supabase Edge Functions, environment variables are managed differently:
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions > Settings**
3. Add secrets using: `supabase secrets set OPENROUTER_API_KEY=your_key_here`
4. Access in function code: `Deno.env.get('OPENROUTER_API_KEY')`

**Note:** The 5 Whys feature currently runs in the frontend, so only frontend deployment variables are needed.
