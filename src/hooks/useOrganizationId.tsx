import { useOrganization } from './useOrganization';

export function useOrganizationId() {
  const { organization } = useOrganization();
  
  if (!organization) {
    throw new Error('Organization context is required but not available');
  }
  
  return organization.id;
}