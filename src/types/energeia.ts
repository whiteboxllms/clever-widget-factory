// Energeia Schema Types - Shared types for the Energeia Schema visualization feature

export type ActionStatus = 'not_started' | 'in_progress' | 'completed';

export type SizeMetric = 'bloom_level' | 'observation_count';

export type EnergyType = 'dynamis' | 'oikonomia' | 'techne';

export type BoundaryType = 'internal' | 'external';

export interface ActionPoint {
  id: string;              // "{action_id}::{person_id}"
  action_id: string;
  person_id: string;
  person_name: string;
  relationship_type: 'assigned' | 'participant';
  cluster_id: number;
  x: number;
  y: number;
  z: number;
  bloom_level: number;          // 1–6, derived from scoring_data
  action_title: string;
  status: ActionStatus;
  observation_count: number;
  energy_type: EnergyType;      // dynamis | oikonomia | techne
}

export interface ClusterInfo {
  id: number;
  title: string;           // Claude-generated, 2-3 words
  description: string;     // Claude-generated, one sentence
  centroid_x: number;
  centroid_y: number;
  centroid_z: number;
  boundary_type: BoundaryType;  // internal | external
}

export interface EnergeiaSchemaData {
  computed_at: string;
  k: number;
  time_window_days: number;
  reduction_method: 'pca' | 'tsne';
  center_of_mass: { x: number; y: number; z: number };
  membrane_boundary_distance: number;
  points: ActionPoint[];
  clusters: ClusterInfo[];
}

export interface EnergeiaFilters {
  personIds: string[];
  relationshipTypes: ('assigned' | 'participant')[];
  statuses: ActionStatus[];
  timeWindowDays: number;
  sizeMetric: SizeMetric;
}
