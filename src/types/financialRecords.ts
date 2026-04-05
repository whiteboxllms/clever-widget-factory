import type { ObservationPhoto } from './observations';

export interface FinancialRecord {
  id: string;
  organization_id: string;
  created_by: string | null;
  created_by_name?: string;
  transaction_date: string;
  amount: number;
  payment_method: 'Cash' | 'SCash' | 'GCash' | 'Wise';
  description?: string;
  photos?: ObservationPhoto[];
  state_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialRecordEdit {
  id: string;
  record_id: string;
  edited_by: string;
  edited_by_name?: string;
  edited_at: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
}

export interface FinancialRecordFilters {
  payment_method?: 'Cash' | 'SCash' | 'GCash' | 'Wise';
  start_date?: string;
  end_date?: string;
  created_by?: string;
  limit?: number;
  offset?: number;
}

export interface FinancialRecordListResponse {
  records: FinancialRecord[];
  running_balance: number;
  total_count: number;
}
