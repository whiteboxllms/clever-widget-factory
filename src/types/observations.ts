export interface Observation {
  id: string;
  organization_id: string;
  observation_text: string | null;
  observed_by: string;
  observed_by_name?: string;
  observed_at: string;
  created_at: string;
  updated_at: string;
  photos: ObservationPhoto[];
  links: ObservationLink[];
}

export interface ObservationPhoto {
  id: string;
  observation_id: string;
  photo_url: string;
  photo_description: string | null;
  photo_order: number;
}

export interface ObservationLink {
  id: string;
  observation_id: string;
  entity_type: string;
  entity_id: string;
}

export interface CreateObservationData {
  observation_text?: string;
  observed_at?: string;
  photos: Array<{
    photo_url: string;
    photo_description?: string;
    photo_order?: number;
  }>;
  links?: Array<{
    entity_type: string;
    entity_id: string;
  }>;
}
