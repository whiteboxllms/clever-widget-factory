const {
  buildScoringPrompt,
  parseAndValidateScores,
  stripHtml
} = require('./action-scoring');

describe('action-scoring', () => {
  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>world</strong></p>';
      expect(stripHtml(html)).toBe('Hello world');
    });

    it('should decode HTML entities', () => {
      const html = 'Test&nbsp;&amp;&lt;&gt;&quot;';
      expect(stripHtml(html)).toBe('Test & < > "');
    });

    it('should handle empty input', () => {
      expect(stripHtml('')).toBe('');
      expect(stripHtml(null)).toBe('');
      expect(stripHtml(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      const html = '  <p>  Test  </p>  ';
      expect(stripHtml(html)).toBe('Test');
    });
  });

  describe('buildScoringPrompt', () => {
    const mockPrompt = {
      prompt_text: 'Score this action based on the following criteria:'
    };

    it('should build prompt with minimal action data', () => {
      const action = {
        id: 'action-123',
        title: 'Test Action',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z'
      };

      const prompt = buildScoringPrompt(action, mockPrompt);
      
      expect(prompt).toContain(mockPrompt.prompt_text);
      expect(prompt).toContain('action-123');
      expect(prompt).toContain('Test Action');
      expect(prompt).toContain('IMPORTANT OVERRIDES');
    });

    it('should include asset info when present', () => {
      const action = {
        id: 'action-123',
        title: 'Test Action',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        asset: {
          id: 'asset-456',
          name: 'Test Tool',
          category: 'Hand Tools',
          storage_vicinity: 'Workshop',
          serial_number: 'SN-123'
        }
      };

      const prompt = buildScoringPrompt(action, mockPrompt);
      
      expect(prompt).toContain('Test Tool');
      expect(prompt).toContain('Hand Tools');
      expect(prompt).toContain('Workshop');
    });

    it('should not include asset field when asset is missing', () => {
      const action = {
        id: 'action-123',
        title: 'Test Action',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z'
      };

      const prompt = buildScoringPrompt(action, mockPrompt);
      const jsonPart = prompt.split('\n\n').pop();
      const actionContext = JSON.parse(jsonPart);
      
      expect(actionContext.asset).toBeUndefined();
    });

    it('should include linked issue when present', () => {
      const action = {
        id: 'action-123',
        title: 'Test Action',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        linked_issue: {
          description: 'Tool broken',
          issue_type: 'damage',
          status: 'resolved',
          root_cause: 'Wear and tear'
        }
      };

      const prompt = buildScoringPrompt(action, mockPrompt);
      
      expect(prompt).toContain('Tool broken');
      expect(prompt).toContain('damage');
      expect(prompt).toContain('Wear and tear');
    });

    it('should strip HTML from policy and observations', () => {
      const action = {
        id: 'action-123',
        title: 'Test Action',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        policy: '<p>Always <strong>wear</strong> safety gear</p>',
        observations: '<p>Task completed <em>successfully</em></p>'
      };

      const prompt = buildScoringPrompt(action, mockPrompt);
      
      expect(prompt).toContain('Always wear safety gear');
      expect(prompt).toContain('Task completed successfully');
      expect(prompt).not.toContain('<p>');
      expect(prompt).not.toContain('<strong>');
    });
  });

  describe('parseAndValidateScores', () => {
    it('should parse valid response', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8,
            reason: 'Good planning'
          },
          execution: {
            score: 7,
            reason: 'Well executed'
          }
        },
        likely_root_causes: ['Lack of tools', 'Time pressure']
      });

      const result = parseAndValidateScores(response);
      
      expect(result.scores.planning.score).toBe(8);
      expect(result.scores.planning.reason).toBe('Good planning');
      expect(result.scores.execution.score).toBe(7);
      expect(result.likely_root_causes).toEqual(['Lack of tools', 'Time pressure']);
      expect(result.raw).toBeDefined();
    });

    it('should handle missing likely_root_causes', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8,
            reason: 'Good planning'
          }
        }
      });

      const result = parseAndValidateScores(response);
      
      expect(result.likely_root_causes).toEqual([]);
    });

    it('should throw on invalid JSON', () => {
      expect(() => {
        parseAndValidateScores('not json');
      }).toThrow('Invalid JSON response');
    });

    it('should throw on missing scores object', () => {
      const response = JSON.stringify({
        likely_root_causes: []
      });

      expect(() => {
        parseAndValidateScores(response);
      }).toThrow('missing or invalid "scores" object');
    });

    it('should throw on invalid score value (not a number)', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 'eight',
            reason: 'Good planning'
          }
        }
      });

      expect(() => {
        parseAndValidateScores(response);
      }).toThrow('must be a number');
    });

    it('should throw on score out of range', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 11,
            reason: 'Too high'
          }
        }
      });

      expect(() => {
        parseAndValidateScores(response);
      }).toThrow('must be between 1 and 10');
    });

    it('should throw on missing reason', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8
          }
        }
      });

      expect(() => {
        parseAndValidateScores(response);
      }).toThrow('Invalid reason');
    });

    it('should throw on empty reason', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8,
            reason: '   '
          }
        }
      });

      expect(() => {
        parseAndValidateScores(response);
      }).toThrow('must be a non-empty string');
    });

    it('should filter out non-string root causes', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8,
            reason: 'Good'
          }
        },
        likely_root_causes: ['Valid cause', 123, null, '', 'Another valid']
      });

      const result = parseAndValidateScores(response);
      
      expect(result.likely_root_causes).toEqual(['Valid cause', 'Another valid']);
    });

    it('should trim whitespace from reasons', () => {
      const response = JSON.stringify({
        scores: {
          planning: {
            score: 8,
            reason: '  Good planning  '
          }
        }
      });

      const result = parseAndValidateScores(response);
      
      expect(result.scores.planning.reason).toBe('Good planning');
    });
  });
});
