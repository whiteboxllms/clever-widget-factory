# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/79911e5f-8077-4490-a4d5-cbe8b4da048d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/79911e5f-8077-4490-a4d5-cbe8b4da048d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE (Local Development)**

If you want to work locally using your own IDE, you can clone this repo and set up a complete local development environment with Supabase.

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Docker Desktop installed and running
- Supabase CLI installed - [install Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### Local Development Setup
This uses a localdb

#### 1. Clone and Install Dependencies

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i
```

#### 2. Set Up Local Supabase

```sh
# Initialize Supabase (if not already done)
supabase init

# Start local Supabase services
supabase start
```

This will start:
- Local PostgreSQL database
- Supabase API
- Supabase Studio (at http://127.0.0.1:54323)
- Storage service

#### 3. Load Production Data (Optional)

To work with real data locally, you can load your production database:

```sh
# Download production database backup from Supabase Dashboard
# Go to: https://supabase.com/dashboard/project/oskwnlhuuxjfuwnjuavn/settings/backups
# Download the latest backup file (e.g., db_cluster-01-10-2025@17-02-34.backup)

# Load the backup into your local database
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f db_cluster-01-10-2025@17-02-34.backup
```

**Note**: Images and files will still be served from production storage. Only database data is loaded locally.

#### 4. Configure Environment Variables

```sh
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local with your local Supabase credentials
# The values are shown when you run 'supabase start'
```

Example `.env.local`:
```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

#### 5. Start the Development Server

```sh
# Start the React development server
npm run dev
```

Your app will be available at `http://localhost:8080` (or the port shown in the terminal).

### Development Workflow

1. **Make changes** to your code locally
2. **Test** with your local Supabase instance
3. **Commit and push** changes to trigger Lovable sync
4. **Deploy** via Lovable when ready

### Database Migration Workflow

When you need to make database schema changes:

#### 1. Create Migrations Locally
```sh
# After making schema changes in Supabase Studio (http://127.0.0.1:54323)
# Generate a migration file
supabase db diff --schema public > supabase/migrations/$(date +%Y%m%d%H%M%S)_your_change_name.sql
```

#### 2. Test Migrations Locally
```sh
# Reset local database and apply all migrations
supabase db reset

# Or apply just the new migration
supabase db push
```

#### 3. Apply to Production
```sh
# Link to production project (if not already linked)
supabase link --project-ref oskwnlhuuxjfuwnjuavn

# Push migrations to production
supabase db push --remote
```

#### Alternative: Manual Production Updates
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/oskwnlhuuxjfuwnjuavn)
2. Navigate to **SQL Editor**
3. Run your migration SQL directly

#### ⚠️ Important Safety Notes
- **Always backup production** before applying migrations
- Test migrations on a copy of production data first
- Consider **downtime** for major schema changes
- **Never** modify existing migration files
- Always create **new migration files** for changes

### Troubleshooting

**Supabase won't start:**
```sh
# Stop and clean up
supabase stop
docker system prune -f
supabase start
```

**Database connection issues:**
- Ensure Docker Desktop is running
- Check that Supabase is running: `supabase status`
- Verify your `.env.local` has the correct local URLs

**Missing data:**
- Load production backup as described in step 3
- Or create test data via Supabase Studio at http://127.0.0.1:54323

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- **Frontend**: Vite, TypeScript, React
- **UI**: shadcn-ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Development**: Docker, Supabase CLI

## Recent Updates

### Attachment Persistence Fix
- Fixed issue where uploaded images and PDFs were lost when editing actions
- Added proper `attachments` field mapping in `SimpleMissionForm.tsx`
- Ensures attachments persist across save/edit cycles

### Local Development Environment
- Added support for local Supabase development
- Environment variable configuration for local/production switching
- Database backup/restore workflow for testing with real data

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/79911e5f-8077-4490-a4d5-cbe8b4da048d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
