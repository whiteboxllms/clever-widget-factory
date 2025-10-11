# Clever Widget Factory

A comprehensive asset management and accountability system built with React, TypeScript, and Supabase.

## Project info

**URL**: https://lovable.dev/projects/79911e5f-8077-4490-a4d5-cbe8b4da048d

## Local Development Setup

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Supabase CLI installed - [install Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### Database Setup

This project uses Supabase as the database backend. To set up your local development environment with the latest database schema and data:

#### Quick Setup (Recommended)

Use the automated restoration script:

```sh
# For local development (default)
./scripts/restore-and-migrate.sh

# For production (requires PROD_DATABASE_URL environment variable)
export PROD_DATABASE_URL="postgresql://user:password@host:port/database"
./scripts/restore-and-migrate.sh --prod
```

#### Manual Setup

1. **Start Supabase locally:**
   ```sh
   supabase start
   ```

2. **Restore the database from backup:**
   ```sh
   # Stop the local Supabase instance
   supabase stop
   
   # Restore from the backup file
   supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres" --file backups/db_cluster-10-10-2025@17-03-17.backup
   
   # Start Supabase again
   supabase start
   ```

3. **Verify the database is running:**
   ```sh
   supabase status
   ```

### Application Setup

Follow these steps to get the application running:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd clever-widget-factory

# Step 3: Install the necessary dependencies
npm i

# Step 4: Start the development server
npm run dev
```

The application will be available at `http://localhost:8080` (or the port shown in your terminal).

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/79911e5f-8077-4490-a4d5-cbe8b4da048d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

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

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn-ui, Radix UI, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form with Zod validation
- **Rich Text**: Tiptap editor
- **Image Processing**: Browser Image Compression
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Database Management

### Backup and Restore

The project includes database backup files for easy setup:

- `backups/db_cluster-10-10-2025@17-03-17.backup` - Latest database backup
- `db_cluster-05-10-2025@17-08-06.backup` - Previous backup

### Creating New Backups

To create a new backup of your local database:

```sh
# Create a backup
supabase db dump --file "db_cluster-$(date +%d-%m-%Y@%H-%M-%S).backup"
```

### Database Migrations

Database schema changes are managed through Supabase migrations located in the `supabase/migrations/` directory. To apply migrations:

```sh
supabase db push
```

## Development Workflow

1. **Database Changes**: Make schema changes through Supabase migrations
2. **Local Development**: Use the local Supabase instance with the backup data
3. **Testing**: Test changes locally before deploying
4. **Deployment**: Deploy through Lovable or your preferred method

