/**
 * ExplorationCodeGenerator
 * 
 * Generates unique exploration codes in the format SF<mmddyy><SUFFIX><number>
 * SUFFIX examples: EX (exploration), CT (curry tree), etc.
 * Supports auto-increment and user override functionality
 * Ensures uniqueness validation across the system
 * 
 * Requirements: 2.2, 2.3, 7.2
 */

import { apiService } from '../lib/apiService';

export interface ExplorationCodeGeneratorOptions {
  farmCode?: string;
  suffix?: string;
  userOverride?: string;
}

export class ExplorationCodeGenerator {
  private static readonly DEFAULT_FARM_CODE = 'SF';
  
  /**
   * Generate a unique exploration code for the given date
   * @param date - The date for the exploration
   * @param options - Optional configuration
   * @returns Promise<string> - The generated exploration code
   */
  async generateCode(
    date: Date, 
    options: ExplorationCodeGeneratorOptions = {}
  ): Promise<string> {
    const { 
      farmCode = ExplorationCodeGenerator.DEFAULT_FARM_CODE, 
      suffix = 'EX',
      userOverride 
    } = options;
    
    // If user provided an override, validate its uniqueness
    if (userOverride) {
      await this.validateCodeUniqueness(userOverride);
      return userOverride;
    }
    
    // Generate auto-incremented code
    const mmddyy = this.formatDate(date);
    const nextNumber = await this.getNextNumber(date, farmCode, suffix);
    return `${farmCode}${mmddyy}${suffix}${nextNumber.toString().padStart(2, '0')}`;
  }
  
  /**
   * Validate that an exploration code is unique in the system
   * @param code - The code to validate
   * @throws Error if code already exists
   */
  async validateCodeUniqueness(code: string): Promise<void> {
    const exists = await this.codeExists(code);
    if (exists) {
      throw new Error(`Exploration code ${code} already exists`);
    }
  }
  
  /**
   * Format date as mmddyy string
   * @param date - The date to format
   * @returns string in mmddyy format
   */
  private formatDate(date: Date): string {
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const yy = date.getFullYear().toString().slice(-2);
    return `${mm}${dd}${yy}`;
  }
  
  /**
   * Get the next available number for the given date, farm code, and suffix
   * @param date - The date for the exploration
   * @param farmCode - The farm code prefix
   * @param suffix - The suffix (e.g., EX, CT)
   * @returns Promise<number> - The next available number
   */
  private async getNextNumber(date: Date, farmCode: string, suffix: string): Promise<number> {
    const dateStr = this.formatDate(date);
    const prefix = `${farmCode}${dateStr}${suffix}`;
    
    try {
      // Query for existing codes with this prefix
      const existingCodes = await this.getExistingCodes(prefix);
      const numbers = existingCodes
        .map(code => parseInt(code.substring(prefix.length)))
        .filter(num => !isNaN(num))
        .sort((a, b) => a - b);
      
      // Find next available number
      let nextNumber = 1;
      for (const num of numbers) {
        if (num === nextNumber) {
          nextNumber++;
        } else {
          break;
        }
      }
      
      return nextNumber;
    } catch (error) {
      console.error('Error getting next exploration number:', error);
      // Fallback to 1 if there's an error
      return 1;
    }
  }
  
  /**
   * Check if an exploration code already exists
   * @param code - The code to check
   * @returns Promise<boolean> - True if code exists
   */
  private async codeExists(code: string): Promise<boolean> {
    try {
      // Query the exploration table to check if code exists
      const response = await apiService.get(`/explorations/check-code/${encodeURIComponent(code)}`);
      return response.exists === true;
    } catch (error) {
      console.error('Error checking code existence:', error);
      // If there's an error, assume it doesn't exist to allow creation
      // The database unique constraint will catch actual duplicates
      return false;
    }
  }
  
  /**
   * Get existing exploration codes that start with the given prefix
   * @param prefix - The prefix to search for
   * @returns Promise<string[]> - Array of existing codes
   */
  private async getExistingCodes(prefix: string): Promise<string[]> {
    try {
      const response = await apiService.get(`/explorations/codes-by-prefix/${encodeURIComponent(prefix)}`);
      return response.codes || [];
    } catch (error) {
      console.error('Error fetching existing codes:', error);
      // Return empty array if there's an error
      return [];
    }
  }
  
  /**
   * Validate exploration code format
   * @param code - The code to validate
   * @returns boolean - True if format is valid
   */
  static validateCodeFormat(code: string): boolean {
    // Format: SF<mmddyy><SUFFIX><number>
    // Examples: SF010126EX01, SF122925CT01
    const pattern = /^[A-Z]{2}\d{6}[A-Z]{2}\d{2,}$/;
    return pattern.test(code);
  }
  
  /**
   * Parse exploration code to extract components
   * @param code - The code to parse
   * @returns object with parsed components or null if invalid
   */
  static parseCode(code: string): {
    farmCode: string;
    date: Date;
    suffix: string;
    number: number;
  } | null {
    if (!ExplorationCodeGenerator.validateCodeFormat(code)) {
      return null;
    }
    
    try {
      const farmCode = code.substring(0, 2);
      const dateStr = code.substring(2, 8); // mmddyy
      const suffix = code.substring(8, 10); // 2-letter suffix
      const numberStr = code.substring(10); // after suffix
      
      // Parse date
      const mm = parseInt(dateStr.substring(0, 2));
      const dd = parseInt(dateStr.substring(2, 4));
      const yy = parseInt(dateStr.substring(4, 6));
      const fullYear = yy < 50 ? 2000 + yy : 1900 + yy; // Assume 00-49 is 2000s, 50-99 is 1900s
      
      const date = new Date(fullYear, mm - 1, dd);
      const number = parseInt(numberStr);
      
      return {
        farmCode,
        date,
        suffix,
        number
      };
    } catch (error) {
      return null;
    }
  }
}

// Export a singleton instance for convenience
export const explorationCodeGenerator = new ExplorationCodeGenerator();