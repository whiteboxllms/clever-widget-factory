export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      action_scores: {
        Row: {
          action_id: string
          ai_response: Json | null
          asset_context_id: string | null
          asset_context_name: string | null
          created_at: string
          id: string
          likely_root_causes: string[] | null
          organization_id: string
          prompt_id: string
          prompt_text: string
          score_attribution_type: string | null
          scores: Json
          source_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          action_id: string
          ai_response?: Json | null
          asset_context_id?: string | null
          asset_context_name?: string | null
          created_at?: string
          id?: string
          likely_root_causes?: string[] | null
          organization_id?: string
          prompt_id: string
          prompt_text: string
          score_attribution_type?: string | null
          scores?: Json
          source_id: string
          source_type?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          ai_response?: Json | null
          asset_context_id?: string | null
          asset_context_name?: string | null
          created_at?: string
          id?: string
          likely_root_causes?: string[] | null
          organization_id?: string
          prompt_id?: string
          prompt_text?: string
          score_attribution_type?: string | null
          scores?: Json
          source_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_scores_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_scores_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          actual_duration: string | null
          asset_id: string | null
          assigned_to: string | null
          attachments: string[] | null
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_duration: string | null
          evidence_description: string | null
          id: string
          issue_reference: string | null
          linked_issue_id: string | null
          mission_id: string | null
          observations: string | null
          organization_id: string
          participants: string[] | null
          plan_commitment: boolean | null
          policy: string | null
          qa_approved_at: string | null
          required_stock: Json | null
          required_tools: string[] | null
          score: number | null
          scoring_data: Json | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_duration?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_duration?: string | null
          evidence_description?: string | null
          id?: string
          issue_reference?: string | null
          linked_issue_id?: string | null
          mission_id?: string | null
          observations?: string | null
          organization_id?: string
          participants?: string[] | null
          plan_commitment?: boolean | null
          policy?: string | null
          qa_approved_at?: string | null
          required_stock?: Json | null
          required_tools?: string[] | null
          score?: number | null
          scoring_data?: Json | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_duration?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_duration?: string | null
          evidence_description?: string | null
          id?: string
          issue_reference?: string | null
          linked_issue_id?: string | null
          mission_id?: string | null
          observations?: string | null
          organization_id?: string
          participants?: string[] | null
          plan_commitment?: boolean | null
          policy?: string | null
          qa_approved_at?: string | null
          required_stock?: Json | null
          required_tools?: string[] | null
          score?: number | null
          scoring_data?: Json | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_actions_assigned_to_organization_members"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["user_id"]
          },
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
      checkins: {
        Row: {
          after_image_urls: string[] | null
          checkin_date: string
          checkin_reason: string | null
          checkout_id: string | null
          created_at: string
          hours_used: number | null
          id: string
          notes: string | null
          organization_id: string
          problems_reported: string | null
          sop_best_practices: string
          tool_id: string
          user_name: string
          what_did_you_do: string
        }
        Insert: {
          after_image_urls?: string[] | null
          checkin_date?: string
          checkin_reason?: string | null
          checkout_id?: string | null
          created_at?: string
          hours_used?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          problems_reported?: string | null
          sop_best_practices?: string
          tool_id: string
          user_name: string
          what_did_you_do?: string
        }
        Update: {
          after_image_urls?: string[] | null
          checkin_date?: string
          checkin_reason?: string | null
          checkout_id?: string | null
          created_at?: string
          hours_used?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          problems_reported?: string | null
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
            foreignKeyName: "checkins_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          pre_existing_issues?: string | null
          tool_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_usage: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          part_id?: string
          quantity_used?: number
          task_id?: string | null
          usage_description?: string | null
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_usage_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      issue_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          field_changed: string | null
          id: string
          issue_id: string
          new_status: string
          new_value: string | null
          notes: string | null
          old_status: string | null
          old_value: string | null
          organization_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          field_changed?: string | null
          id?: string
          issue_id: string
          new_status: string
          new_value?: string | null
          notes?: string | null
          old_status?: string | null
          old_value?: string | null
          organization_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          issue_id?: string
          new_status?: string
          new_value?: string | null
          notes?: string | null
          old_status?: string | null
          old_value?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_history_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_requirements: {
        Row: {
          attribute_type: Database["public"]["Enums"]["attribute_type"]
          created_at: string | null
          id: string
          issue_id: string | null
          organization_id: string
          required_level: number
        }
        Insert: {
          attribute_type: Database["public"]["Enums"]["attribute_type"]
          created_at?: string | null
          id?: string
          issue_id?: string | null
          organization_id: string
          required_level: number
        }
        Update: {
          attribute_type?: Database["public"]["Enums"]["attribute_type"]
          created_at?: string | null
          id?: string
          issue_id?: string | null
          organization_id?: string
          required_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "issue_requirements_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          action_required:
            | Database["public"]["Enums"]["action_required_type"]
            | null
          actual_hours: number | null
          ai_analysis: string | null
          assigned_to: string | null
          can_self_claim: boolean | null
          context_id: string
          context_type: Database["public"]["Enums"]["context_type"]
          created_at: string
          damage_assessment: string | null
          description: string
          diagnosed_at: string | null
          diagnosed_by: string | null
          efficiency_loss_percentage: number | null
          estimated_hours: number | null
          id: string
          is_misuse: boolean
          issue_metadata: Json | null
          issue_type: string
          materials_needed: Json | null
          next_steps: string | null
          organization_id: string
          ready_to_work: boolean | null
          related_checkout_id: string | null
          report_photo_urls: string[] | null
          reported_at: string
          reported_by: string
          resolution_notes: string | null
          resolution_photo_urls: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          responsibility_assigned: boolean
          root_cause: string | null
          status: string
          updated_at: string
          work_progress: string | null
          workflow_status: Database["public"]["Enums"]["workflow_status_type"]
        }
        Insert: {
          action_required?:
            | Database["public"]["Enums"]["action_required_type"]
            | null
          actual_hours?: number | null
          ai_analysis?: string | null
          assigned_to?: string | null
          can_self_claim?: boolean | null
          context_id: string
          context_type?: Database["public"]["Enums"]["context_type"]
          created_at?: string
          damage_assessment?: string | null
          description: string
          diagnosed_at?: string | null
          diagnosed_by?: string | null
          efficiency_loss_percentage?: number | null
          estimated_hours?: number | null
          id?: string
          is_misuse?: boolean
          issue_metadata?: Json | null
          issue_type?: string
          materials_needed?: Json | null
          next_steps?: string | null
          organization_id: string
          ready_to_work?: boolean | null
          related_checkout_id?: string | null
          report_photo_urls?: string[] | null
          reported_at?: string
          reported_by: string
          resolution_notes?: string | null
          resolution_photo_urls?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsibility_assigned?: boolean
          root_cause?: string | null
          status?: string
          updated_at?: string
          work_progress?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status_type"]
        }
        Update: {
          action_required?:
            | Database["public"]["Enums"]["action_required_type"]
            | null
          actual_hours?: number | null
          ai_analysis?: string | null
          assigned_to?: string | null
          can_self_claim?: boolean | null
          context_id?: string
          context_type?: Database["public"]["Enums"]["context_type"]
          created_at?: string
          damage_assessment?: string | null
          description?: string
          diagnosed_at?: string | null
          diagnosed_by?: string | null
          efficiency_loss_percentage?: number | null
          estimated_hours?: number | null
          id?: string
          is_misuse?: boolean
          issue_metadata?: Json | null
          issue_type?: string
          materials_needed?: Json | null
          next_steps?: string | null
          organization_id?: string
          ready_to_work?: boolean | null
          related_checkout_id?: string | null
          report_photo_urls?: string[] | null
          reported_at?: string
          reported_by?: string
          resolution_notes?: string | null
          resolution_photo_urls?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsibility_assigned?: boolean
          root_cause?: string | null
          status?: string
          updated_at?: string
          work_progress?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "issues_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "mission_attachments_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "actions"
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
      mission_tool_usage: {
        Row: {
          checkout_id: string
          created_at: string
          id: string
          mission_id: string
          organization_id: string
          task_id: string | null
        }
        Insert: {
          checkout_id: string
          created_at?: string
          id?: string
          mission_id: string
          organization_id: string
          task_id?: string | null
        }
        Update: {
          checkout_id?: string
          created_at?: string
          id?: string
          mission_id?: string
          organization_id?: string
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
            foreignKeyName: "mission_tool_usage_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_tool_usage_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "actions"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "missions_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      organization_members: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          organization_id: string
          role: string
          super_admin: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          organization_id: string
          role?: string
          super_admin?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          organization_id?: string
          role?: string
          super_admin?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          subdomain: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          subdomain?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          subdomain?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          category: string | null
          cost_evidence_url: string | null
          cost_per_unit: number | null
          created_at: string
          current_quantity: number
          description: string | null
          id: string
          image_url: string | null
          legacy_storage_vicinity: string | null
          minimum_quantity: number | null
          name: string
          organization_id: string
          storage_location: string | null
          storage_vicinity: string | null
          supplier: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_evidence_url?: string | null
          cost_per_unit?: number | null
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          image_url?: string | null
          legacy_storage_vicinity?: string | null
          minimum_quantity?: number | null
          name: string
          organization_id: string
          storage_location?: string | null
          storage_vicinity?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_evidence_url?: string | null
          cost_per_unit?: number | null
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          image_url?: string | null
          legacy_storage_vicinity?: string | null
          minimum_quantity?: number | null
          name?: string
          organization_id?: string
          storage_location?: string | null
          storage_vicinity?: string | null
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
          {
            foreignKeyName: "parts_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          order_id: string | null
          organization_id: string
          part_id: string
          quantity_change: number | null
          supplier_name: string | null
          supplier_url: string | null
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
          order_id?: string | null
          organization_id: string
          part_id: string
          quantity_change?: number | null
          supplier_name?: string | null
          supplier_url?: string | null
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
          order_id?: string | null
          organization_id?: string
          part_id?: string
          quantity_change?: number | null
          supplier_name?: string | null
          supplier_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parts_history_changed_by"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "parts_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "parts_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_history_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_orders: {
        Row: {
          created_at: string
          estimated_cost: number | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_details: string | null
          ordered_at: string
          ordered_by: string
          organization_id: string
          part_id: string
          quantity_ordered: number
          quantity_received: number
          status: string
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_details?: string | null
          ordered_at?: string
          ordered_by: string
          organization_id: string
          part_id: string
          quantity_ordered: number
          quantity_received?: number
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_details?: string | null
          ordered_at?: string
          ordered_by?: string
          organization_id?: string
          part_id?: string
          quantity_ordered?: number
          quantity_received?: number
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_orders_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          super_admin: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          super_admin?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          super_admin?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scoring_prompts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_prompts_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_vicinities: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_vicinities_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          quality_rating?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_audits: {
        Row: {
          audit_comments: string | null
          audited_at: string
          audited_by: string
          created_at: string
          flagged_for_maintenance: boolean
          id: string
          last_user_identified: string | null
          organization_id: string
          photo_urls: string[] | null
          tool_id: string
        }
        Insert: {
          audit_comments?: string | null
          audited_at?: string
          audited_by: string
          created_at?: string
          flagged_for_maintenance?: boolean
          id?: string
          last_user_identified?: string | null
          organization_id: string
          photo_urls?: string[] | null
          tool_id: string
        }
        Update: {
          audit_comments?: string | null
          audited_at?: string
          audited_by?: string
          created_at?: string
          flagged_for_maintenance?: boolean
          id?: string
          last_user_identified?: string | null
          organization_id?: string
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
            foreignKeyName: "tool_audits_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          created_at: string
          description: string | null
          has_motor: boolean
          id: string
          image_url: string | null
          known_issues: string | null
          last_audited_at: string | null
          last_maintenance: string | null
          legacy_storage_vicinity: string | null
          manual_url: string | null
          name: string
          organization_id: string
          parent_structure_id: string | null
          serial_number: string | null
          stargazer_sop: string | null
          status: Database["public"]["Enums"]["tool_status"]
          storage_location: string | null
          updated_at: string
        }
        Insert: {
          actual_location?: string | null
          audit_status?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          has_motor?: boolean
          id?: string
          image_url?: string | null
          known_issues?: string | null
          last_audited_at?: string | null
          last_maintenance?: string | null
          legacy_storage_vicinity?: string | null
          manual_url?: string | null
          name: string
          organization_id: string
          parent_structure_id?: string | null
          serial_number?: string | null
          stargazer_sop?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
          storage_location?: string | null
          updated_at?: string
        }
        Update: {
          actual_location?: string | null
          audit_status?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          has_motor?: boolean
          id?: string
          image_url?: string | null
          known_issues?: string | null
          last_audited_at?: string | null
          last_maintenance?: string | null
          legacy_storage_vicinity?: string | null
          manual_url?: string | null
          name?: string
          organization_id?: string
          parent_structure_id?: string | null
          serial_number?: string | null
          stargazer_sop?: string | null
          status?: Database["public"]["Enums"]["tool_status"]
          storage_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_parent_structure_id_fkey"
            columns: ["parent_structure_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_attributes: {
        Row: {
          attribute_type: Database["public"]["Enums"]["attribute_type"]
          created_at: string | null
          earned_at: string | null
          id: string
          level: number | null
          organization_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attribute_type: Database["public"]["Enums"]["attribute_type"]
          created_at?: string | null
          earned_at?: string | null
          id?: string
          level?: number | null
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attribute_type?: Database["public"]["Enums"]["attribute_type"]
          created_at?: string | null
          earned_at?: string | null
          id?: string
          level?: number | null
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_attributes_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attributes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      worker_performance: {
        Row: {
          attributes_used:
            | Database["public"]["Enums"]["attribute_type"][]
            | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          hours_worked: number | null
          id: string
          issue_id: string | null
          level_at_completion: number | null
          organization_id: string
          outcome: string | null
          supervisor_notes: string | null
          user_id: string | null
        }
        Insert: {
          attributes_used?:
            | Database["public"]["Enums"]["attribute_type"][]
            | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          hours_worked?: number | null
          id?: string
          issue_id?: string | null
          level_at_completion?: number | null
          organization_id: string
          outcome?: string | null
          supervisor_notes?: string | null
          user_id?: string | null
        }
        Update: {
          attributes_used?:
            | Database["public"]["Enums"]["attribute_type"][]
            | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          hours_worked?: number | null
          id?: string
          issue_id?: string | null
          level_at_completion?: number | null
          organization_id?: string
          outcome?: string | null
          supervisor_notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_performance_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      worker_strategic_attributes: {
        Row: {
          attribute_type: Database["public"]["Enums"]["strategic_attribute_type"]
          created_at: string | null
          earned_at: string | null
          id: string
          level: number | null
          organization_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attribute_type: Database["public"]["Enums"]["strategic_attribute_type"]
          created_at?: string | null
          earned_at?: string | null
          id?: string
          level?: number | null
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attribute_type?: Database["public"]["Enums"]["strategic_attribute_type"]
          created_at?: string | null
          earned_at?: string | null
          id?: string
          level?: number | null
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_strategic_attributes_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_strategic_attributes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_role_update_permission: {
        Args: { new_role: string; old_role: string; target_user_id: string }
        Returns: boolean
      }
      create_organization_with_admin: {
        Args: {
          admin_user_id?: string
          org_name: string
          org_subdomain?: string
        }
        Returns: string
      }
      get_user_display_name: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_user_display_names: {
        Args: Record<PropertyKey, never>
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_organization_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      action_required_type: "repair" | "replace_part" | "not_fixable" | "remove"
      attribute_type:
        | "communication"
        | "quality"
        | "transparency"
        | "reliability"
        | "mechanical"
        | "electrical"
        | "it"
        | "carpentry"
        | "plumbing"
        | "hydraulics"
        | "welding"
        | "fabrication"
      context_type: "tool" | "order" | "inventory" | "facility"
      strategic_attribute_type:
        | "growth_mindset"
        | "root_cause_problem_solving"
        | "teamwork"
        | "quality"
        | "proactive_documentation"
        | "safety_focus"
        | "efficiency"
        | "asset_stewardship"
        | "financial_impact"
        | "energy_morale_impact"
      tool_status:
        | "available"
        | "checked_out"
        | "unavailable"
        | "needs_attention"
        | "under_repair"
        | "removed"
      workflow_status_type:
        | "reported"
        | "diagnosed"
        | "in_progress"
        | "completed"
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
      action_required_type: ["repair", "replace_part", "not_fixable", "remove"],
      attribute_type: [
        "communication",
        "quality",
        "transparency",
        "reliability",
        "mechanical",
        "electrical",
        "it",
        "carpentry",
        "plumbing",
        "hydraulics",
        "welding",
        "fabrication",
      ],
      context_type: ["tool", "order", "inventory", "facility"],
      strategic_attribute_type: [
        "growth_mindset",
        "root_cause_problem_solving",
        "teamwork",
        "quality",
        "proactive_documentation",
        "safety_focus",
        "efficiency",
        "asset_stewardship",
        "financial_impact",
        "energy_morale_impact",
      ],
      tool_status: [
        "available",
        "checked_out",
        "unavailable",
        "needs_attention",
        "under_repair",
        "removed",
      ],
      workflow_status_type: [
        "reported",
        "diagnosed",
        "in_progress",
        "completed",
      ],
    },
  },
} as const
