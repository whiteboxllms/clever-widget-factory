import { useOrganization } from './useOrganization';

export function useOrganizationId() {
  const { organization, loading } = useOrganization();
  
  if (loading) {
    return null; // Return null while loading instead of throwing error
  }
  
  if (!organization) {
    throw new Error('Organization context is required but not available');
  }
  
  return organization.id;
}