// Report System Types
// Centralized type definitions for the report system

export interface Report {
  id: string;
  name: string;
  last_run?: string;
  run_frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface ReportSection {
  id: string;
  section_focus: string;
  title: string;
  report: any; // JSONB - structure determined by AI/prompt
  created_by: string;
  prompt_id: string;
  created_at: string;
  updated_at: string;
}

export interface ReportSectionAssignment {
  id: string;
  report_id: string;
  section_id: string;
  sort_order: number;
  added_at: string;
  added_by: string;
}

export interface Prompt {
  id: string;
  name: string;
  prompt_text: string;
  intended_usage: 'scoring' | 'report_generation' | 'image_captioning' | 'custom';
  expected_response_json?: any; // JSONB - optional schema for validation
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GeneratedReport {
  headline?: string;
  sections: Array<{
    sectionType: string;
    title: string;
    content: string;
    visibleTo?: string[];
    images?: Array<{
      url: string;
      caption: string;
    }>;
    relatedActionIds?: string[];
    relatedIssueIds?: string[];
    relatedCheckoutIds?: string[];
    relatedAssetIds?: string[];
    participants?: string[];
  }>;
}

// Re-export types from reportDataService for convenience
export type {
  Action,
  ImplementationUpdate,
  MissionAttachment,
  Issue,
  Tool,
  Part,
  PartsHistory,
  ReportContext,
  ActionScore
} from './reportDataService';
