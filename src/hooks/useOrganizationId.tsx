import { useOrganization } from './useOrganization';

/**
 * Hook to get the current organization ID.
 * Returns null if not available - this is OK since the backend
 * will extract organization context from the auth token automatically.
 * 
 * @deprecated Organization context is now handled by the backend via authorizer.
 * This hook is kept for backward compatibility but returns null gracefully.
 */
export function useOrganizationId() {
  const { organization, loading } = useOrganization();
  
  // Return null gracefully - backend handles organization context
  if (loading || !organization) {
    return null;
  }
  
  return organization.id;
}