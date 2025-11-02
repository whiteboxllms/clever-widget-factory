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
