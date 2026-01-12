/**
 * ActionService
 * 
 * Handles action CRUD operations with exploration support
 * Extends existing action functionality to support exploration fields
 * 
 * Requirements: 2.1, 2.2, 6.1, 1.4, 8.1
 */

import { apiService } from '../lib/apiService';
import { BaseAction } from '../types/actions';
import { explorationCodeGenerator } from './explorationCodeGenerator';
import { embeddingQueue } from './embeddingQueue';

export interface CreateActionRequest extends Partial<BaseAction> {
  // Logical field names - map to existing schema columns
  state_text?: string; // Maps to description field
  policy_text?: string; // Maps to policy field  
  summary_policy_text?: string; // New field
  is_exploration?: boolean;
  exploration_code_override?: string; // Allow manual override of auto-generated code
}

export interface ActionResponse extends BaseAction {
  state_text?: string;
  policy_text?: string;
  summary_policy_text?: string;
  policy_id?: number;
  exploration?: ExplorationResponse;
}

export interface ExplorationResponse {
  id: number;
  action_id: string;
  exploration_code: string;
  exploration_notes_text?: string;
  metrics_text?: string;
  public_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateActionRequest extends Partial<CreateActionRequest> {
  id: string;
}

export class ActionService {
  /**
   * Create a new action with optional exploration support
   * @param data - Action creation data
   * @returns Promise<ActionResponse> - The created action
   */
  async createAction(data: CreateActionRequest): Promise<ActionResponse> {
    try {
      // Prepare action data - map logical fields to existing schema
      const actionData = {
        ...data,
        // Map logical field names to existing columns
        description: data.state_text || data.description,
        policy: data.policy_text || data.policy,
        // summary_policy_text is a new field, pass as-is
        summary_policy_text: data.summary_policy_text,
        // Include is_exploration flag
        is_exploration: Boolean(data.is_exploration),
      };

      // Remove logical field names from the request to avoid confusion
      const { state_text, policy_text, exploration_code_override, ...cleanActionData } = actionData;

      // Create the action first
      const response = await apiService.post('/actions', cleanActionData);
      const action = response.data || response;

      // If this is an exploration, create the exploration record
      // This must happen in the same logical operation to maintain consistency
      if (data.is_exploration) {
        try {
          const explorationCode = data.exploration_code_override || 
            await explorationCodeGenerator.generateCode(new Date());

          const explorationData = {
            action_id: action.id,
            exploration_code: explorationCode,
            exploration_notes_text: '',
            metrics_text: '',
            public_flag: false
          };

          const explorationResponse = await apiService.post('/explorations', explorationData);
          action.exploration = explorationResponse.data || explorationResponse;
        } catch (explorationError) {
          // If exploration creation fails, we need to clean up the action
          // to maintain consistency (action with is_exploration=true must have exploration record)
          try {
            await apiService.delete(`/actions/${action.id}`);
          } catch (cleanupError) {
            console.error('Failed to cleanup action after exploration creation failure:', cleanupError);
          }
          throw new Error(`Failed to create exploration record: ${explorationError}`);
        }
      }

      // Map response fields back to logical names for consistency
      const actionResult = {
        ...action,
        state_text: action.description,
        policy_text: action.policy,
        summary_policy_text: action.summary_policy_text
      };

      // Enqueue embedding jobs after successful creation
      try {
        await embeddingQueue.enqueueActionEmbeddings(action.id, {
          state_text: actionResult.state_text,
          policy_text: actionResult.policy_text,
          summary_policy_text: actionResult.summary_policy_text
        });
      } catch (embeddingError) {
        console.warn('Failed to enqueue action embeddings:', embeddingError);
        // Don't fail the action creation if embedding fails
      }

      return actionResult;
    } catch (error) {
      console.error('Error creating action:', error);
      throw error;
    }
  }

  /**
   * Update an existing action
   * Enforces exploration flag consistency requirements
   * @param id - Action ID
   * @param data - Action update data
   * @returns Promise<ActionResponse> - The updated action
   */
  async updateAction(id: string, data: UpdateActionRequest): Promise<ActionResponse> {
    try {
      // Get current action state to check for exploration flag changes
      const currentAction = await this.getAction(id);
      const wasExploration = currentAction.is_exploration;
      const willBeExploration = data.is_exploration !== undefined ? data.is_exploration : wasExploration;

      // Handle exploration flag transitions
      if (wasExploration && !willBeExploration) {
        // Changing from exploration to non-exploration
        // Database triggers will prevent this if exploration records exist
        // The API should handle this gracefully or require explicit exploration deletion
        console.warn(`Attempting to change action ${id} from exploration to non-exploration`);
      } else if (!wasExploration && willBeExploration) {
        // Changing from non-exploration to exploration
        // We need to create an exploration record
        const explorationCode = data.exploration_code_override || 
          await explorationCodeGenerator.generateCode(new Date());

        const explorationData = {
          action_id: id,
          exploration_code: explorationCode,
          exploration_notes_text: '',
          metrics_text: '',
          public_flag: false
        };

        try {
          const explorationResponse = await apiService.post('/explorations', explorationData);
          // Continue with action update after successful exploration creation
        } catch (explorationError) {
          throw new Error(`Cannot change action to exploration: ${explorationError}`);
        }
      }

      // Prepare update data - map logical fields to existing schema
      const updateData = {
        ...data,
        // Map logical field names to existing columns
        description: data.state_text !== undefined ? data.state_text : data.description,
        policy: data.policy_text !== undefined ? data.policy_text : data.policy,
        summary_policy_text: data.summary_policy_text,
        // Include is_exploration flag if provided
        is_exploration: data.is_exploration !== undefined ? Boolean(data.is_exploration) : undefined,
      };

      // Remove logical field names and id from the request
      const { state_text, policy_text, id: _, exploration_code_override, ...cleanUpdateData } = updateData;

      const response = await apiService.put(`/actions/${id}`, cleanUpdateData);
      const action = response.data || response;

      // Map response fields back to logical names for consistency
      const actionResult = {
        ...action,
        state_text: action.description,
        policy_text: action.policy,
        summary_policy_text: action.summary_policy_text
      };

      // Enqueue embedding jobs if text fields were updated
      const hasTextUpdates = data.state_text !== undefined || 
                           data.policy_text !== undefined || 
                           data.summary_policy_text !== undefined;
      
      if (hasTextUpdates) {
        try {
          await embeddingQueue.enqueueActionEmbeddings(id, {
            state_text: actionResult.state_text,
            policy_text: actionResult.policy_text,
            summary_policy_text: actionResult.summary_policy_text
          });
        } catch (embeddingError) {
          console.warn('Failed to enqueue action embeddings after update:', embeddingError);
          // Don't fail the update if embedding fails
        }
      }

      return actionResult;
    } catch (error) {
      console.error('Error updating action:', error);
      throw error;
    }
  }

  /**
   * Get an action by ID
   * @param id - Action ID
   * @returns Promise<ActionResponse> - The action
   */
  async getAction(id: string): Promise<ActionResponse> {
    try {
      const response = await apiService.get(`/actions/${id}`);
      const action = response.data || response;

      // Map response fields to logical names for consistency
      return {
        ...action,
        state_text: action.description,
        policy_text: action.policy,
        summary_policy_text: action.summary_policy_text
      };
    } catch (error) {
      console.error('Error fetching action:', error);
      throw error;
    }
  }

  /**
   * Generate AI-assisted summary policy text
   * @param actionId - Action ID
   * @returns Promise<string> - Generated summary policy text
   */
  async generateSummaryPolicy(actionId: string): Promise<string> {
    try {
      // Get the action data first
      const action = await this.getAction(actionId);
      
      // Call AI service to generate summary policy
      const response = await apiService.post('/ai/generate-summary-policy', {
        action_id: actionId,
        state_text: action.state_text,
        policy_text: action.policy_text,
        title: action.title,
        description: action.description
      });

      return response.summary_policy_text || response.data?.summary_policy_text || '';
    } catch (error) {
      console.error('Error generating summary policy:', error);
      // Return empty string if AI service fails - feature should be optional
      return '';
    }
  }

  /**
   * List actions with optional filters
   * @param filters - Optional filters
   * @returns Promise<ActionResponse[]> - List of actions
   */
  async listActions(filters: Record<string, any> = {}): Promise<ActionResponse[]> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const endpoint = queryParams.toString() 
        ? `/actions?${queryParams.toString()}`
        : '/actions';

      const response = await apiService.get(endpoint);
      const actions = response.data || response || [];

      // Map response fields to logical names for consistency
      return actions.map((action: any) => ({
        ...action,
        state_text: action.description,
        policy_text: action.policy,
        summary_policy_text: action.summary_policy_text
      }));
    } catch (error) {
      console.error('Error listing actions:', error);
      throw error;
    }
  }
}

// Export a singleton instance for convenience
export const actionService = new ActionService();