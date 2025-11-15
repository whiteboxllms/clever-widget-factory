import { useOrganization } from './useOrganization';

export function useOrganizationId() {
  const { organization, loading } = useOrganization();
  
  if (loading) {
    return null; // Return null while loading instead of throwing error
  }
  
  if (!organization) {
    console.warn('Organization context is not available');
    return null; // Return null instead of throwing error
  }
  
  return organization.id;
}