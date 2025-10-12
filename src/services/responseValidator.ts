import { ValidationResult } from '@/types/report';

/**
 * Validates AI responses against expected JSON schema
 */
export function validateResponse(
  aiResponse: any,
  expectedSchema: any
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!expectedSchema) {
    return {
      isValid: true,
      errors: [],
      warnings: ['No validation schema provided']
    };
  }
  
  try {
    // Basic type checking
    if (typeof aiResponse !== typeof expectedSchema) {
      errors.push(`Expected ${typeof expectedSchema}, got ${typeof aiResponse}`);
      return { isValid: false, errors, warnings };
    }
    
    // If it's an object, check required fields
    if (typeof aiResponse === 'object' && aiResponse !== null) {
      validateObject(aiResponse, expectedSchema, '', errors, warnings);
    }
    
    // If it's an array, check structure
    if (Array.isArray(aiResponse)) {
      validateArray(aiResponse, expectedSchema, '', errors, warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings: []
    };
  }
}

/**
 * Validates object structure recursively
 */
function validateObject(
  obj: any,
  schema: any,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (typeof obj !== 'object' || obj === null) {
    errors.push(`${path}: Expected object, got ${typeof obj}`);
    return;
  }
  
  if (typeof schema !== 'object' || schema === null) {
    return; // Can't validate against non-object schema
  }
  
  // Check required fields from schema
  for (const [key, expectedType] of Object.entries(schema)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj)) {
      errors.push(`${currentPath}: Missing required field`);
      continue;
    }
    
    const actualValue = obj[key];
    const expectedValue = expectedType;
    
    // Type checking
    if (typeof expectedValue === 'string') {
      // Expected type is a string description
      if (expectedValue === 'string' && typeof actualValue !== 'string') {
        errors.push(`${currentPath}: Expected string, got ${typeof actualValue}`);
      } else if (expectedValue === 'number' && typeof actualValue !== 'number') {
        errors.push(`${currentPath}: Expected number, got ${typeof actualValue}`);
      } else if (expectedValue === 'boolean' && typeof actualValue !== 'boolean') {
        errors.push(`${currentPath}: Expected boolean, got ${typeof actualValue}`);
      } else if (expectedValue === 'array' && !Array.isArray(actualValue)) {
        errors.push(`${currentPath}: Expected array, got ${typeof actualValue}`);
      } else if (expectedValue === 'object' && (typeof actualValue !== 'object' || actualValue === null)) {
        errors.push(`${currentPath}: Expected object, got ${typeof actualValue}`);
      }
    } else if (typeof expectedValue === 'object') {
      // Recursively validate nested objects
      if (Array.isArray(expectedValue)) {
        validateArray(actualValue, expectedValue[0], currentPath, errors, warnings);
      } else {
        validateObject(actualValue, expectedValue, currentPath, errors, warnings);
      }
    }
  }
  
  // Warn about extra fields
  for (const key of Object.keys(obj)) {
    if (!(key in schema)) {
      warnings.push(`${path ? `${path}.` : ''}${key}: Extra field not in schema`);
    }
  }
}

/**
 * Validates array structure
 */
function validateArray(
  arr: any[],
  expectedItemSchema: any,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (!Array.isArray(arr)) {
    errors.push(`${path}: Expected array, got ${typeof arr}`);
    return;
  }
  
  if (arr.length === 0) {
    warnings.push(`${path}: Empty array`);
    return;
  }
  
  // Validate each item in the array
  arr.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    
    if (typeof expectedItemSchema === 'string') {
      if (expectedItemSchema === 'string' && typeof item !== 'string') {
        errors.push(`${itemPath}: Expected string, got ${typeof item}`);
      } else if (expectedItemSchema === 'number' && typeof item !== 'number') {
        errors.push(`${itemPath}: Expected number, got ${typeof item}`);
      } else if (expectedItemSchema === 'object' && (typeof item !== 'object' || item === null)) {
        errors.push(`${itemPath}: Expected object, got ${typeof item}`);
      }
    } else if (typeof expectedItemSchema === 'object') {
      validateObject(item, expectedItemSchema, itemPath, errors, warnings);
    }
  });
}

/**
 * Validates a report generation response specifically
 */
export function validateReportResponse(aiResponse: any): ValidationResult {
  const expectedSchema = {
    headline: 'string',
    sections: [{
      sectionType: 'string',
      title: 'string',
      content: 'string',
      visibleTo: ['string'],
      images: [{
        url: 'string',
        caption: 'string'
      }],
      relatedActionIds: ['string'],
      relatedIssueIds: ['string'],
      relatedCheckoutIds: ['string'],
      relatedAssetIds: ['string'],
      participants: ['string']
    }]
  };
  
  return validateResponse(aiResponse, expectedSchema);
}

/**
 * Validates a scoring response specifically
 */
export function validateScoringResponse(aiResponse: any): ValidationResult {
  const expectedSchema = {
    scores: 'object',
    likely_root_causes: ['string']
  };
  
  return validateResponse(aiResponse, expectedSchema);
}

/**
 * Tests validation with sample data
 */
export function testValidation(): void {
  console.log('Testing validation...');
  
  // Test valid report response
  const validReport = {
    headline: "Great Day at the Farm",
    sections: [
      {
        sectionType: "accomplishment",
        title: "Harvest Complete",
        content: "We harvested 2,400 lbs of tomatoes",
        visibleTo: ["intern", "admin"],
        relatedActionIds: ["uuid1", "uuid2"]
      }
    ]
  };
  
  const validResult = validateReportResponse(validReport);
  console.log('Valid report:', validResult);
  
  // Test invalid report response
  const invalidReport = {
    sections: "not an array" // Missing headline, wrong type for sections
  };
  
  const invalidResult = validateReportResponse(invalidReport);
  console.log('Invalid report:', invalidResult);
}
