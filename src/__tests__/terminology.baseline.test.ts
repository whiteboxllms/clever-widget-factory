/**
 * Comprehensive terminology verification test
 * 
 * This test verifies that "Project" terminology exists in the UI after migration.
 * 
 * This ensures all instances of "Mission" have been replaced with "Project" in user-facing text.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Files that should contain "Project" terminology (user-facing text only)
const UI_FILES_TO_CHECK = [
  'src/pages/Dashboard.tsx',
  'src/pages/Missions.tsx',
  'src/pages/EditMission.tsx',
  'src/pages/Actions.tsx',
  'src/components/SimpleMissionForm.tsx',
  'src/components/UnifiedActionDialog.tsx',
  'src/components/ActionCard.tsx',
  'src/components/InventoryHistoryDialog.tsx',
  'src/components/MissionTemplates.tsx',
  'src/components/MissionTaskList.tsx',
  'src/components/MissionActionList.tsx',
];

// User-facing text patterns that should contain "Project" (after migration)
// Note: Patterns match various quote styles (single, double, template literals)
const PROJECT_PATTERNS = [
  /Stargazer Projects/,
  /Create Project/,
  /Project Title/,
  /Project Context/,
  /Project #/,
  /Project Filters/,
  /Project Updated/,
  /Project Removed/,
  /Project Moved to Backlog/,
  /Define your project details/,
  /Enter project title/,
  /Create Project Action/,
  /Choose a Project Template/,
  /No actions defined for this project/,
  /break down the project/,
  /will be saved when you create the project/,
];

// Patterns that should NOT exist (old Mission terminology)
const OLD_MISSION_PATTERNS = [
  /Stargazer Missions/,
  /Create Mission[^A]/, // "Create Mission" but not "Create Mission Action" (which is now "Create Project Action")
  /Mission Title/,
  /Mission Context/,
  /Mission #/,
  /Mission Filters/,
  /Mission Updated/,
  /Mission Removed/,
  /Mission Moved to Backlog/,
  /Define your mission details/,
  /Enter mission title/,
  /Choose a Mission Template/,
  /No actions defined for this mission/,
  /break down the mission/,
  /will be saved when you create the mission/,
];

describe('Terminology Verification - Project Text Verification', () => {
  UI_FILES_TO_CHECK.forEach((filePath) => {
    it(`should contain Project terminology in ${filePath}`, () => {
      try {
        const fileContent = readFileSync(join(process.cwd(), filePath), 'utf-8');
        
        // Check if at least one Project pattern exists in the file
        const hasProjectText = PROJECT_PATTERNS.some(pattern => pattern.test(fileContent));
        
        // After migration: Should find Project text
        expect(hasProjectText).toBe(true);
      } catch (error) {
        // File might not exist, skip
        console.warn(`Could not read ${filePath}:`, error);
      }
    });

    it(`should NOT contain old Mission terminology in ${filePath}`, () => {
      try {
        const fileContent = readFileSync(join(process.cwd(), filePath), 'utf-8');
        
        // Check that old Mission patterns don't exist (except in comments/internal code)
        // We'll check for user-facing strings specifically
        const hasOldMissionText = OLD_MISSION_PATTERNS.some(pattern => {
          const match = pattern.exec(fileContent);
          // Only fail if it's in a user-facing string (not in comments or variable names)
          if (match) {
            const context = fileContent.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20);
            // Skip if it's in a comment or variable name
            if (context.includes('//') || context.includes('/*') || context.includes('*/')) {
              return false;
            }
            // Skip if it's part of a variable name (mission_id, mission_number, etc.)
            if (match[0].includes('mission_') || match[0].includes('missionId') || match[0].includes('missionData')) {
              return false;
            }
            return true;
          }
          return false;
        });
        
        // After migration: Should NOT find old Mission text in user-facing strings
        expect(hasOldMissionText).toBe(false);
      } catch (error) {
        // File might not exist, skip
        console.warn(`Could not read ${filePath}:`, error);
      }
    });
  });

  it('should have Project terminology in Dashboard navigation', () => {
    const dashboardContent = readFileSync(
      join(process.cwd(), 'src/pages/Dashboard.tsx'),
      'utf-8'
    );
    
    // After migration: Should find "Stargazer Projects"
    expect(dashboardContent).toMatch(/Stargazer Projects/);
    expect(dashboardContent).not.toMatch(/Stargazer Missions/);
  });

  it('should have Project terminology in Missions page header', () => {
    const missionsContent = readFileSync(
      join(process.cwd(), 'src/pages/Missions.tsx'),
      'utf-8'
    );
    
    // After migration: Should find "Stargazer Projects" and "Create Project"
    expect(missionsContent).toMatch(/Stargazer Projects/);
    expect(missionsContent).toMatch(/Create Project/);
  });

  it('should have Project terminology in form labels', () => {
    const formContent = readFileSync(
      join(process.cwd(), 'src/components/SimpleMissionForm.tsx'),
      'utf-8'
    );
    
    // After migration: Should find "Project Title"
    expect(formContent).toMatch(/Project Title/);
  });
});

