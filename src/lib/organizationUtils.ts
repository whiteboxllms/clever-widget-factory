// Utility function to add organization_id to database operations
// This ensures all database inserts include the required organization_id field

export interface DatabaseInsertWithOrg {
  organization_id: string;
  [key: string]: any;
}

export function addOrganizationId<T extends Record<string, any>>(
  data: T, 
  organizationId: string
): T & { organization_id: string } {
  return {
    ...data,
    organization_id: organizationId
  };
}