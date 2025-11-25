// User mapping service to handle Cognito -> Database user ID translation
// This handles the migration period where Cognito IDs don't match database IDs

interface UserMapping {
  cognitoId: string;
  databaseId: string;
  email: string;
}

// This would ideally come from a database table or API
// For now, we'll maintain the mapping here until full migration is complete
const USER_MAPPINGS: UserMapping[] = [
  {
    cognitoId: '7871f320-d031-70a1-541b-748f221805f3',
    databaseId: 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd',
    email: 'stefan@stargazer-farm.com'
  },
  // Add other organization members as they migrate to Cognito
  // {
  //   cognitoId: 'new-cognito-id',
  //   databaseId: 'existing-database-id',
  //   email: 'user@stargazer-farm.com'
  // }
];

export class UserMappingService {
  /**
   * Get database user ID from Cognito user ID
   */
  static getDatabaseUserId(cognitoUserId: string): string {
    const mapping = USER_MAPPINGS.find(m => m.cognitoId === cognitoUserId);
    return mapping?.databaseId || cognitoUserId; // Fallback to Cognito ID if no mapping
  }

  /**
   * Get Cognito user ID from database user ID
   */
  static getCognitoUserId(databaseUserId: string): string {
    const mapping = USER_MAPPINGS.find(m => m.databaseId === databaseUserId);
    return mapping?.cognitoId || databaseUserId; // Fallback to database ID if no mapping
  }

  /**
   * Check if user needs ID mapping
   */
  static needsMapping(cognitoUserId: string): boolean {
    return USER_MAPPINGS.some(m => m.cognitoId === cognitoUserId);
  }

  /**
   * Get user mapping by email (useful for initial setup)
   */
  static getMappingByEmail(email: string): UserMapping | null {
    return USER_MAPPINGS.find(m => m.email === email) || null;
  }

  /**
   * Add new user mapping (for when new users migrate)
   */
  static addMapping(cognitoId: string, databaseId: string, email: string): void {
    // Remove existing mapping if it exists
    const existingIndex = USER_MAPPINGS.findIndex(m => m.email === email);
    if (existingIndex >= 0) {
      USER_MAPPINGS[existingIndex] = { cognitoId, databaseId, email };
    } else {
      USER_MAPPINGS.push({ cognitoId, databaseId, email });
    }
  }
}

// Hook to get the correct user ID for database operations
export function useDatabaseUserId(cognitoUserId: string): string {
  return UserMappingService.getDatabaseUserId(cognitoUserId);
}
