import { WorkflowStage } from '@/hooks/useFiveWhysAgent';

export interface TestExchange {
  userMessage: string;
  expectedNextStage: WorkflowStage;
  expectedResponsePattern?: RegExp;
  expectedWhyCount?: number;
  validateResponse?: (response: string) => boolean;
  maxWaitTime?: number; // milliseconds
}

export interface TestScenario {
  name: string;
  description: string;
  issue: { id: string; description: string };
  exchanges: TestExchange[];
}

export const testScenarios: TestScenario[] = [
  {
    name: 'Happy Path - Complete 5 Whys Flow',
    description: 'Tests complete flow from facts through all 5 whys to root cause summary',
    issue: {
      id: 'test-001',
      description: 'Light does not turn on after rain',
    },
    exchanges: [
      {
        userMessage: 'Light was on yesterday at 8pm, off at 4am today, it rained overnight',
        expectedNextStage: 'collecting_facts',
        expectedResponsePattern: /What|When|Where|Did|How/,
      },
      {
        userMessage: 'Other lights on the same circuit work fine',
        expectedNextStage: 'proposing_causes',
        expectedResponsePattern: /1\.|2\.|3\./,
      },
      {
        userMessage: '1',
        expectedNextStage: 'selecting_cause',
        expectedResponsePattern: /Why #1 of 5/i,
        expectedWhyCount: 1,
      },
      {
        userMessage: 'Moisture entered the fixture',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #2 of 5/i,
        expectedWhyCount: 2,
      },
      {
        userMessage: 'Insufficient weatherproofing on the fixture',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #3 of 5/i,
        expectedWhyCount: 3,
      },
      {
        userMessage: 'Fixture was rated for indoor use only',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #4 of 5/i,
        expectedWhyCount: 4,
      },
      {
        userMessage: 'Wrong fixture was purchased without checking weather rating',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #5 of 5/i,
        expectedWhyCount: 5,
      },
      {
        userMessage: 'No purchase guidelines specified outdoor rating requirements',
        expectedNextStage: 'root_cause_identified',
        expectedResponsePattern: /root cause|summary/i,
        expectedWhyCount: 5,
      },
    ],
  },
  {
    name: 'User Enters Custom Reason',
    description: 'Tests flow where user enters custom answers instead of selecting options',
    issue: {
      id: 'test-002',
      description: 'Machine makes unusual noise',
    },
    exchanges: [
      {
        userMessage: 'Machine started making grinding noise yesterday, temperature was normal',
        expectedNextStage: 'collecting_facts',
      },
      {
        userMessage: 'No recent maintenance was performed',
        expectedNextStage: 'proposing_causes',
        expectedResponsePattern: /1\.|2\.|3\./,
      },
      {
        userMessage: '2',
        expectedNextStage: 'selecting_cause',
        expectedResponsePattern: /Why #1 of 5/i,
      },
      {
        userMessage: 'Bearings have worn out due to lack of lubrication',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #2 of 5/i,
      },
      {
        userMessage: 'Maintenance schedule does not include bearing checks',
        expectedNextStage: 'five_whys',
        expectedResponsePattern: /Why #3 of 5/i,
      },
    ],
  },
  {
    name: 'Very Brief Facts',
    description: 'Tests flow with minimal factual information provided',
    issue: {
      id: 'test-003',
      description: 'Equipment not functioning',
    },
    exchanges: [
      {
        userMessage: 'Broken',
        expectedNextStage: 'collecting_facts',
      },
      {
        userMessage: 'Yesterday',
        expectedNextStage: 'proposing_causes',
      },
      {
        userMessage: '1',
        expectedNextStage: 'selecting_cause',
        expectedResponsePattern: /Why #1 of 5/i,
      },
    ],
  },
  {
    name: 'Focus on Accountable Person Actions',
    description: 'Tests that AI options focus on what person did vs best practice, not technical issues',
    issue: {
      id: 'test-004',
      description: 'Light bulb burned out prematurely',
    },
    exchanges: [
      {
        userMessage: 'Bulb burned out after 2 days, device was on overnight both nights',
        expectedNextStage: 'collecting_facts',
      },
      {
        userMessage: 'Device manual says use 60W max, we used 100W bulb',
        expectedNextStage: 'proposing_causes',
      },
      {
        userMessage: 'Wrong bulb wattage used',
        expectedNextStage: 'selecting_cause',
        expectedResponsePattern: /Why #1:/i,
        expectedOptionsCount: 3,
      },
    ],
  },
];

