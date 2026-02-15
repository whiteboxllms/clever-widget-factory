import { Observation } from './observations';
import { BaseAction } from './actions';

/**
 * Experience - Represents a state transition (S → A → S') for learning and analysis
 * Captures observed changes in entities (tools, parts) across time
 */
export interface Experience {
  id: string;
  entity_type: 'tool' | 'part';
  entity_id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  
  // Populated from joins
  entity?: Tool | Part;
  components?: {
    initial_state?: ExperienceComponent;
    action?: ExperienceComponent;
    final_state?: ExperienceComponent;
  };
}

/**
 * ExperienceComponent - Links experiences to states or actions
 * Represents one component of the state transition tuple (S, A, or S')
 */
export interface ExperienceComponent {
  id: string;
  experience_id: string;
  component_type: 'initial_state' | 'action' | 'final_state';
  state_id?: string;
  action_id?: string;
  organization_id: string;
  created_at: string;
  
  // Populated from joins
  state?: Observation;
  action?: BaseAction;
}

/**
 * Tool - Basic tool entity structure
 * Full definition should exist elsewhere, this is a minimal reference
 */
export interface Tool {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

/**
 * Part - Basic part entity structure
 * Full definition should exist elsewhere, this is a minimal reference
 */
export interface Part {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

/**
 * CreateExperienceRequest - Request payload for creating a new experience
 */
export interface CreateExperienceRequest {
  entity_type: 'tool' | 'part';
  entity_id: string;
  initial_state_id: string;
  action_id?: string; // Optional - experience can exist without documented action
  final_state_id: string;
}

/**
 * ExperienceListParams - Query parameters for listing experiences
 */
export interface ExperienceListParams {
  entity_type?: 'tool' | 'part';
  entity_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * ExperienceListResponse - Paginated response for experience list
 */
export interface ExperienceListResponse {
  data: Experience[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
