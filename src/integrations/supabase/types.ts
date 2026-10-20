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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event: string
          id: string
          organization_id: string | null
          outcome: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event: string
          id?: string
          organization_id?: string | null
          outcome: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event?: string
          id?: string
          organization_id?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_import_outcomes: {
        Row: {
          created_at: string
          id: string
          mapping_log: Json
          outcome: string
          reason: string
          run_id: string
          source_fields: Json | null
          source_identifier: string | null
          source_row: number
          source_sheet: string
          target_record_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_log?: Json
          outcome: string
          reason: string
          run_id: string
          source_fields?: Json | null
          source_identifier?: string | null
          source_row: number
          source_sheet: string
          target_record_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mapping_log?: Json
          outcome?: string
          reason?: string
          run_id?: string
          source_fields?: Json | null
          source_identifier?: string | null
          source_row?: number
          source_sheet?: string
          target_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_import_outcomes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "master_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_import_outcomes_target_record_id_fkey"
            columns: ["target_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
        ]
      }
      master_import_runs: {
        Row: {
          approved_at: string
          completed_at: string | null
          created_at: string
          expected_rows: number
          id: string
          initiated_by: string
          mode: string
          organization_id: string
          source_sha256: string
          source_workbook: string
          state: string
          validation_summary: Json
        }
        Insert: {
          approved_at?: string
          completed_at?: string | null
          created_at?: string
          expected_rows: number
          id?: string
          initiated_by: string
          mode: string
          organization_id: string
          source_sha256: string
          source_workbook: string
          state?: string
          validation_summary?: Json
        }
        Update: {
          approved_at?: string
          completed_at?: string | null
          created_at?: string
          expected_rows?: number
          id?: string
          initiated_by?: string
          mode?: string
          organization_id?: string
          source_sha256?: string
          source_workbook?: string
          state?: string
          validation_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "master_import_runs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_import_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_reference_records: {
        Row: {
          agency_record_id: string | null
          created_at: string
          evidence_record_id: string | null
          field_record_id: string | null
          first_run_id: string
          id: string
          parent_record_id: string | null
          requirement_record_id: string | null
          source_fields: Json
          source_identifier: string
          source_row: number
          source_sha256: string
          source_sheet: string
          source_workbook: string
        }
        Insert: {
          agency_record_id?: string | null
          created_at?: string
          evidence_record_id?: string | null
          field_record_id?: string | null
          first_run_id: string
          id?: string
          parent_record_id?: string | null
          requirement_record_id?: string | null
          source_fields: Json
          source_identifier: string
          source_row: number
          source_sha256: string
          source_sheet: string
          source_workbook: string
        }
        Update: {
          agency_record_id?: string | null
          created_at?: string
          evidence_record_id?: string | null
          field_record_id?: string | null
          first_run_id?: string
          id?: string
          parent_record_id?: string | null
          requirement_record_id?: string | null
          source_fields?: Json
          source_identifier?: string
          source_row?: number
          source_sha256?: string
          source_sheet?: string
          source_workbook?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_reference_records_agency_record_id_fkey"
            columns: ["agency_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_reference_records_evidence_record_id_fkey"
            columns: ["evidence_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_reference_records_field_record_id_fkey"
            columns: ["field_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_reference_records_first_run_id_fkey"
            columns: ["first_run_id"]
            isOneToOne: false
            referencedRelation: "master_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_reference_records_parent_record_id_fkey"
            columns: ["parent_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_reference_records_requirement_record_id_fkey"
            columns: ["requirement_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["organization_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_membership_id_user_id_organization_id_fkey"
            columns: ["membership_id", "user_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "user_id", "organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_master_import: {
        Args: {
          _approval: boolean
          _expected: number
          _mode: string
          _org: string
          _sha: string
          _workbook: string
        }
        Returns: string
      }
      bootstrap_operator: { Args: { _user: string }; Returns: string }
      can_manage: { Args: { _org: string }; Returns: boolean }
      can_read_org: { Args: { _org: string }; Returns: boolean }
      finish_master_import: { Args: { _run: string }; Returns: Json }
      is_member: { Args: { _org: string }; Returns: boolean }
      is_operator: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      process_master_import: {
        Args: { _rows: Json; _run: string }
        Returns: number
      }
      record_security_event: {
        Args: { _event: string; _org: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          _active?: boolean
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "authorized_operator"
        | "internal_reviewer"
        | "university_administrator"
        | "registrar"
        | "iqac_manager"
        | "department_head_dean"
        | "faculty_staff_uploader"
        | "read_only_decision_maker"
      organization_kind: "internal" | "university"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "authorized_operator",
        "internal_reviewer",
        "university_administrator",
        "registrar",
        "iqac_manager",
        "department_head_dean",
        "faculty_staff_uploader",
        "read_only_decision_maker",
      ],
      organization_kind: ["internal", "university"],
    },
  },
} as const
