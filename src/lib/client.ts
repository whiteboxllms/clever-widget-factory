// Unified client that replaces Supabase client
import { database } from './database';
import { auth } from './authService';

export const client = {
  from: database.from.bind(database),
  auth
};

// Export as supabase for drop-in replacement
export { client as supabase };
