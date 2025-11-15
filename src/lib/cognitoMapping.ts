// Cognito to Organization Member mapping service
import { getCurrentUser } from 'aws-amplify/auth';

interface CognitoMapping {
  cognito_user_id: string;
  organization_member_id: string;
  email: string;
  full_name: string;
}

class CognitoMappingService {
  private mappings: Map<string, string> = new Map();

  // Hardcoded mappings for existing users (temporary until DB migration)
  private staticMappings: Record<string, string> = {
    // Map Cognito emails to organization_member user_ids
    'stefan@stargazer-farm.com': '08617390-b001-708d-f61e-07a1698282ec',           // Stefan Hamilton (96 actions) - Org 1
    'mae@stargazer-farm.com': '1891f310-c071-705a-2c72-0d0a33c92bf0',              // Mae Dela Torre (57 actions) - Org 1
    'paniellesterjohnlegarda@gmail.com': '7dd4187f-ff2a-4367-9e7b-0c8741f25495',   // Lester Paniel - Org 1
    'carlhilo22@gmail.com': '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8',               // Malone - Org 1
    'antonettediaz966@gmail.com': '5b3f7beb-cd85-463f-94d7-832fd0445255',          // Antonette Diaz - Org 1
    'gelmar@cleverwf.com': '01dbe4ed-bd76-4180-a39d-8760b24800e1',                 // Gelmar - Org 1
    'stefhamilton@gmail.com': '3fcd5103-95d4-46d3-bbe8-b7a5220ee4c5'              // Stefan (OPA test) - Org 2
  };

  async getCurrentOrganizationMemberId(): Promise<string | null> {
    try {
      const cognitoUser = await getCurrentUser();
      const email = cognitoUser.signInDetails?.loginId;
      
      if (!email) return null;

      // Check static mappings first (for existing users)
      const mappedId = this.staticMappings[email];
      if (mappedId) {
        return mappedId;
      }

      // Try to find by email in organization_members
      const response = await fetch(`/api/organization_members/by-email?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const result = await response.json();
        return result.data?.user_id || null;
      }

      return null;
    } catch (error) {
      console.error('Failed to get organization member ID:', error);
      return null;
    }
  }

  async getCurrentUserActions(): Promise<any[]> {
    const memberId = await this.getCurrentOrganizationMemberId();
    if (!memberId) return [];

    try {
      const response = await fetch(`/api/actions?assigned_to=${memberId}`);
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Failed to fetch user actions:', error);
      return [];
    }
  }

  // Update static mapping (for development/migration)
  updateMapping(email: string, organizationMemberId: string): void {
    this.staticMappings[email] = organizationMemberId;
  }

  // Get all mappings for debugging
  getAllMappings(): Record<string, string> {
    return { ...this.staticMappings };
  }
}

export const cognitoMapping = new CognitoMappingService();
