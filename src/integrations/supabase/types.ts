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
          after_image_url: string | null
          checkin_date: string
          checkout_id: string | null
          condition_after: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          id: string
          location_found: string | null
          notes: string | null
          problems_reported: string | null
          returned_to_correct_location: boolean
          tool_id: string
          user_name: string
        }
        Insert: {
          after_image_url?: string | null
          checkin_date?: string
          checkout_id?: string | null
          condition_after: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          id?: string
          location_found?: string | null
          notes?: string | null
          problems_reported?: string | null
          returned_to_correct_location?: boolean
          tool_id: string
          user_name: string
        }
        Update: {
          after_image_url?: string | null
          checkin_date?: string
          checkout_id?: string | null
          condition_after?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          id?: string
          location_found?: string | null
          notes?: string | null
          problems_reported?: string | null
          returned_to_correct_location?: boolean
          tool_id?: string
          user_name?: string
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
          tool_id: string
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
          tool_id: string
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
          tool_id?: string
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
      parts: {
        Row: {
          category: string | null
          cost_per_unit: number | null
          created_at: string
          current_quantity: number
          description: string | null
          id: string
          image_url: string | null
          intended_storage_location: string
          minimum_quantity: number | null
          name: string
          supplier: string | null
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
          intended_storage_location: string
          minimum_quantity?: number | null
          name: string
          supplier?: string | null
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
          intended_storage_location?: string
          minimum_quantity?: number | null
          name?: string
          supplier?: string | null
          unit?: string | null
          updated_at?: string
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
      tools: {
        Row: {
          actual_location: string | null
          category: string | null
          condition: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          intended_storage_location: string
          last_maintenance: string | null
          manual_url: string | null
          name: string
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["tool_status"]
          updated_at: string
        }
        Insert: {
          actual_location?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          intended_storage_location: string
          last_maintenance?: string | null
          manual_url?: string | null
          name: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
          updated_at?: string
        }
        Update: {
          actual_location?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          intended_storage_location?: string
          last_maintenance?: string | null
          manual_url?: string | null
          name?: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
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
      tool_condition: "excellent" | "good" | "fair" | "poor" | "broken"
      tool_status: "available" | "checked_out" | "broken" | "maintenance"
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
      tool_condition: ["excellent", "good", "fair", "poor", "broken"],
      tool_status: ["available", "checked_out", "broken", "maintenance"],
    },
  },
} as const
