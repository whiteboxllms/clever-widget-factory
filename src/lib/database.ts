/**
 * Legacy database stub
 * This file is a stub for tests that reference the old database module.
 * The application has been migrated to AWS and no longer uses direct database connections.
 */

export const queryJSON = async (...args: any[]): Promise<any[]> => {
  throw new Error('Direct database access is not supported. Use API services instead.');
};

export default {
  queryJSON
};
