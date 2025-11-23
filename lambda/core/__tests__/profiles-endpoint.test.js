/**
 * Tests for profiles endpoint
 * 
 * This test identifies issues with the /profiles endpoint:
 * 1. SQL injection vulnerability (direct string interpolation)
 * 2. Missing error handling in queryJSON calls
 * 3. No proper SQL parameterization
 * 
 * Run with: node lambda/core/__tests__/profiles-endpoint.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simple test runner
function runTests() {
  const tests = [
    {
      name: 'Profiles endpoint should use SQL parameterization (not string interpolation)',
      fn: () => {
        const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
        
        // Find the profiles GET endpoint
        const profilesGetMatch = code.match(/if \(path\.endsWith\('\/profiles'\)\)[\s\S]*?if \(httpMethod === 'GET'\)[\s\S]*?const sql =[\s\S]*?queryJSON\(sql\)/);
        
        if (profilesGetMatch) {
          const profilesCode = profilesGetMatch[0];
          
          // BUG: Should use formatSqlValue or parameterized queries, not direct interpolation
          const hasDirectInterpolation = profilesCode.includes(`\`WHERE user_id = '\${user_id}'\``) ||
                                        profilesCode.includes(`'WHERE user_id = '${'${user_id}'}'`);
          
          const usesFormatSqlValue = profilesCode.includes('formatSqlValue') || 
                                     profilesCode.includes('formatSqlValue(user_id)');
          
          console.log('Profiles GET code snippet:', profilesCode.substring(0, 300));
          console.log('Has direct interpolation:', hasDirectInterpolation);
          console.log('Uses formatSqlValue:', usesFormatSqlValue);
          
          if (hasDirectInterpolation && !usesFormatSqlValue) {
            throw new Error('BUG: Profiles endpoint uses direct string interpolation - SQL injection vulnerability!');
          }
        } else {
          throw new Error('Could not find profiles GET endpoint code');
        }
      }
    },
    {
      name: 'Profiles endpoint should have error handling',
      fn: () => {
        const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
        
        // Find the profiles endpoint block - need to match more content to get the full block
        const profilesEndpointMatch = code.match(/if \(path\.endsWith\('\/profiles'\)\)[\s\S]*?if \(httpMethod === 'POST'\)[\s\S]*?catch \(error\)[\s\S]*?\}[\s\S]*?\}/);
        
        // Also check for GET endpoint with try-catch
        const profilesGetMatch = code.match(/if \(path\.endsWith\('\/profiles'\)\)[\s\S]*?if \(httpMethod === 'GET'\)[\s\S]*?try[\s\S]*?catch/);
        const profilesPostMatch = code.match(/if \(httpMethod === 'POST'\)[\s\S]*?if \(path\.endsWith\('\/profiles'\)\)[\s\S]*?try[\s\S]*?catch/);
        
        // Check if profiles endpoint has try-catch in GET or POST
        const hasGetErrorHandling = profilesGetMatch !== null;
        const hasPostErrorHandling = code.match(/\/\/ Profiles endpoint[\s\S]*?if \(httpMethod === 'POST'\)[\s\S]*?try[\s\S]*?catch/) !== null;
        
        // More flexible check - look for try-catch anywhere in the profiles endpoint section
        const profilesSectionStart = code.indexOf("if (path.endsWith('/profiles'))");
        if (profilesSectionStart !== -1) {
          // Find the next major endpoint or end of handler
          const nextEndpoint = code.indexOf('\n    // ', profilesSectionStart + 100);
          const profilesSection = nextEndpoint !== -1 
            ? code.substring(profilesSectionStart, nextEndpoint)
            : code.substring(profilesSectionStart, profilesSectionStart + 2000);
          
          const hasErrorHandling = profilesSection.includes('try') && profilesSection.includes('catch');
          
          console.log('Profiles endpoint code snippet:', profilesSection.substring(0, 500));
          console.log('Has error handling (try-catch):', hasErrorHandling);
          
          if (!hasErrorHandling) {
            throw new Error('BUG: Profiles endpoint does not have error handling - unhandled errors cause 502!');
          }
        } else {
          throw new Error('Could not find profiles endpoint code');
        }
      }
    },
    {
      name: 'Profiles POST endpoint should use SQL parameterization',
      fn: () => {
        const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
        
        // Find the profiles POST endpoint
        const profilesPostMatch = code.match(/if \(httpMethod === 'POST'\)[\s\S]*?const sql = `[\s\S]*?queryJSON\(sql\)/);
        
        if (profilesPostMatch) {
          const profilesPostCode = profilesPostMatch[0];
          
          // Check if it uses direct interpolation for user_id, full_name, or favorite_color
          const hasDirectInterpolation = profilesPostCode.includes(`'\${user_id}'`) ||
                                        profilesPostCode.includes(`'\${full_name}'`) ||
                                        profilesPostCode.includes(`'\${favorite_color}'`);
          
          const usesFormatSqlValue = profilesPostCode.includes('formatSqlValue');
          
          console.log('Profiles POST code snippet:', profilesPostCode.substring(0, 400));
          console.log('Has direct interpolation:', hasDirectInterpolation);
          console.log('Uses formatSqlValue:', usesFormatSqlValue);
          
          if (hasDirectInterpolation && !usesFormatSqlValue) {
            throw new Error('BUG: Profiles POST endpoint uses direct string interpolation - SQL injection vulnerability!');
          }
        }
      }
    },
    {
      name: 'Profiles endpoint should handle special characters in user_id safely',
      fn: () => {
        const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
        
        // Check if the code properly escapes SQL values
        const profilesGetMatch = code.match(/if \(path\.endsWith\('\/profiles'\)\)[\s\S]*?if \(httpMethod === 'GET'\)[\s\S]*?queryJSON\(sql\)/);
        
        if (profilesGetMatch) {
          const profilesCode = profilesGetMatch[0];
          
          // Should use formatSqlValue or escapeLiteral to handle special characters
          const usesSafeEscaping = profilesCode.includes('formatSqlValue') || 
                                  profilesCode.includes('escapeLiteral') ||
                                  profilesCode.includes('$1') || // parameterized query
                                  profilesCode.includes('?'); // parameterized query
          
          console.log('Uses safe SQL escaping:', usesSafeEscaping);
          
          if (!usesSafeEscaping) {
            throw new Error('BUG: Profiles endpoint does not safely escape user input - vulnerable to SQL injection!');
          }
        }
      }
    }
  ];

  console.log('Running profiles endpoint tests...\n');
  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    try {
      test.fn();
      console.log(`✓ ${test.name}\n`);
      passed++;
    } catch (error) {
      console.log(`✗ ${test.name}`);
      console.log(`  ${error.message}\n`);
      failed++;
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

if (require.main === module) {
  const results = runTests();
  process.exit(results.failed > 0 ? 1 : 0);
}

module.exports = { runTests };

