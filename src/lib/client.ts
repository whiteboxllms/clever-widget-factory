// Minimal client for legacy compatibility
// Most functionality has been migrated to TanStack Query and API calls

export const supabase = {
  from: (table: string) => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null })
  }),
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null })
  }
};

export { supabase as client };