export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          after_image_urls: string[] | null
          checkin_date: string
          checkout_id: string | null
          condition_after: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          hours_used: number | null
          id: string
          location_found: string | null
          notes: string | null
          problems_reported: string | null
          returned_to_correct_location: boolean
          sop_best_practices: string
          tool_id: string
          user_name: string
          what_did_you_do: string
        }
        Insert: {
          after_image_urls?: string[] | null
          checkin_date?: string
          checkout_id?: string | null
          condition_after: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          hours_used?: number | null
          id?: string
          location_found?: string | null
          notes?: string | null
          problems_reported?: string | null
          returned_to_correct_location?: boolean
          sop_best_practices?: string
          tool_id: string
          user_name: string
          what_did_you_do?: string
        }
        Update: {
          after_image_urls?: string[] | null
          checkin_date?: string
          checkout_id?: string | null
          condition_after?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          hours_used?: number | null
          id?: string
          location_found?: string | null
          notes?: string | null
          problems_reported?: string | null
          returned_to_correct_location?: boolean
          sop_best_practices?: string
          tool_id?: string
          user_name?: string
          what_did_you_do?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          before_image_url: string | null
          checkout_date: string
          created_at: string
          expected_return_date: string | null
          id: string
          intended_usage: string | null
          is_returned: boolean
          notes: string | null
          pre_existing_issues: string | null
          tool_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          before_image_url?: string | null
          checkout_date?: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          intended_usage?: string | null
          is_returned?: boolean
          notes?: string | null
          pre_existing_issues?: string | null
          tool_id: string
          user_id: string
          user_name: string
        }
        Update: {
          before_image_url?: string | null
          checkout_date?: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          intended_usage?: string | null
          is_returned?: boolean
          notes?: string | null
          pre_existing_issues?: string | null
          tool_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          mission_id: string | null
          task_id: string | null
          uploaded_by: string
        }
        Insert: {
          attachment_type: string
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          mission_id?: string | null
          task_id?: string | null
          uploaded_by: string
        }
        Update: {
          attachment_type?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          mission_id?: string | null
          task_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_attachments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mission_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_inventory_usage: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          part_id: string
          quantity_used: number
          task_id: string | null
          usage_description: string | null
          used_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          part_id: string
          quantity_used: number
          task_id?: string | null
          usage_description?: string | null
          used_by: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          part_id?: string
          quantity_used?: number
          task_id?: string | null
          usage_description?: string | null
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_inventory_usage_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_inventory_usage_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_inventory_usage_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mission_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_inventory_usage_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          evidence_description: string | null
          id: string
          mission_id: string
          observations: string | null
          plan: string | null
          qa_approved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          evidence_description?: string | null
          id?: string
          mission_id: string
          observations?: string | null
          plan?: string | null
          qa_approved_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          evidence_description?: string | null
          id?: string
          mission_id?: string
          observations?: string | null
          plan?: string | null
          qa_approved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mission_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_tool_usage: {
        Row: {
          checkout_id: string
          created_at: string
          id: string
          mission_id: string
          task_id: string | null
        }
        Insert: {
          checkout_id: string
          created_at?: string
          id?: string
          mission_id: string
          task_id?: string | null
        }
        Update: {
          checkout_id?: string
          created_at?: string
          id?: string
          mission_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_tool_usage_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_tool_usage_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_tool_usage_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mission_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          all_materials_available: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          mission_number: number
          plan: string
          problem_statement: string
          qa_assigned_to: string | null
          qa_feedback: string | null
          resources_required: string | null
          status: string
          template_color: string | null
          template_icon: string | null
          template_id: string | null
          template_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_materials_available?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          mission_number?: number
          plan: string
          problem_statement: string
          qa_assigned_to?: string | null
          qa_feedback?: string | null
          resources_required?: string | null
          status?: string
          template_color?: string | null
          template_icon?: string | null
          template_id?: string | null
          template_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_materials_available?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mission_number?: number
          plan?: string
          problem_statement?: string
          qa_assigned_to?: string | null
          qa_feedback?: string | null
          resources_required?: string | null
          status?: string
          template_color?: string | null
          template_icon?: string | null
          template_id?: string | null
          template_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missions_qa_assigned_to_fkey"
            columns: ["qa_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      parts: {
        Row: {
          category: string | null
          cost_per_unit: number | null
          created_at: string
          current_quantity: number
          description: string | null
          id: string
          image_url: string | null
          minimum_quantity: number | null
          name: string
          storage_location: string | null
          storage_vicinity: string
          supplier: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          image_url?: string | null
          minimum_quantity?: number | null
          name: string
          storage_location?: string | null
          storage_vicinity: string
          supplier?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          image_url?: string | null
          minimum_quantity?: number | null
          name?: string
          storage_location?: string | null
          storage_vicinity?: string
          supplier?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_parts_supplier"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_history: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          new_quantity: number | null
          old_quantity: number | null
          part_id: string
          quantity_change: number | null
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          part_id: string
          quantity_change?: number | null
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          part_id?: string
          quantity_change?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_vicinities: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          quality_rating: number | null
          updated_at: string
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          quality_rating?: number | null
          updated_at?: string
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          quality_rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tool_audits: {
        Row: {
          audit_comments: string | null
          audited_at: string
          audited_by: string
          condition_found: string
          created_at: string
          flagged_for_maintenance: boolean
          found_in_location: boolean
          found_in_vicinity: boolean
          id: string
          last_user_identified: string | null
          photo_urls: string[] | null
          tool_id: string
        }
        Insert: {
          audit_comments?: string | null
          audited_at?: string
          audited_by: string
          condition_found: string
          created_at?: string
          flagged_for_maintenance?: boolean
          found_in_location: boolean
          found_in_vicinity: boolean
          id?: string
          last_user_identified?: string | null
          photo_urls?: string[] | null
          tool_id: string
        }
        Update: {
          audit_comments?: string | null
          audited_at?: string
          audited_by?: string
          condition_found?: string
          created_at?: string
          flagged_for_maintenance?: boolean
          found_in_location?: boolean
          found_in_vicinity?: boolean
          id?: string
          last_user_identified?: string | null
          photo_urls?: string[] | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_audits_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tool_audits_last_user_identified_fkey"
            columns: ["last_user_identified"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tool_audits_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          actual_location: string | null
          audit_status: string | null
          category: string | null
          condition: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          description: string | null
          has_motor: boolean
          id: string
          image_url: string | null
          known_issues: string | null
          last_audited_at: string | null
          last_maintenance: string | null
          manual_url: string | null
          name: string
          purchase_date: string | null
          serial_number: string | null
          stargazer_sop: string | null
          status: Database["public"]["Enums"]["tool_status"]
          storage_location: string | null
          storage_vicinity: string
          updated_at: string
        }
        Insert: {
          actual_location?: string | null
          audit_status?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          description?: string | null
          has_motor?: boolean
          id?: string
          image_url?: string | null
          known_issues?: string | null
          last_audited_at?: string | null
          last_maintenance?: string | null
          manual_url?: string | null
          name: string
          purchase_date?: string | null
          serial_number?: string | null
          stargazer_sop?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
          storage_location?: string | null
          storage_vicinity: string
          updated_at?: string
        }
        Update: {
          actual_location?: string | null
          audit_status?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          description?: string | null
          has_motor?: boolean
          id?: string
          image_url?: string | null
          known_issues?: string | null
          last_audited_at?: string | null
          last_maintenance?: string | null
          manual_url?: string | null
          name?: string
          purchase_date?: string | null
          serial_number?: string | null
          stargazer_sop?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
          storage_location?: string | null
          storage_vicinity?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tool_condition:
        | "no_problems_observed"
        | "functional_but_not_efficient"
        | "not_functional"
      tool_status:
        | "available"
        | "checked_out"
        | "unavailable"
        | "unable_to_find"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tool_condition: [
        "no_problems_observed",
        "functional_but_not_efficient",
        "not_functional",
      ],
      tool_status: [
        "available",
        "checked_out",
        "unavailable",
        "unable_to_find",
      ],
    },
  },
} as const
