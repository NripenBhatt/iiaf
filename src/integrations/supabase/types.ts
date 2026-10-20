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
      assistant_messages: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          parts: Json
          role: string
          thread_id: string
          ui_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          parts: Json
          role: string
          thread_id: string
          ui_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          parts?: Json
          role?: string
          thread_id?: string
          ui_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      canonical_field_mappings: {
        Row: {
          agency_field_id: string
          basis: string
          canonical_field: string
          id: string
          organization_id: string
          proposed_at: string
          proposed_by: string
          rationale: string
          requirement_identifier: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
        }
        Insert: {
          agency_field_id: string
          basis?: string
          canonical_field: string
          id?: string
          organization_id: string
          proposed_at?: string
          proposed_by: string
          rationale: string
          requirement_identifier: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          agency_field_id?: string
          basis?: string
          canonical_field?: string
          id?: string
          organization_id?: string
          proposed_at?: string
          proposed_by?: string
          rationale?: string
          requirement_identifier?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_field_mappings_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_field_mappings_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_processing_jobs: {
        Row: {
          document_id: string
          error: string | null
          fact_count: number
          finished_at: string | null
          id: string
          organization_id: string
          processor: string | null
          processor_version: string | null
          segment_count: number
          started_at: string
          started_by: string
          state: string
        }
        Insert: {
          document_id: string
          error?: string | null
          fact_count?: number
          finished_at?: string | null
          id?: string
          organization_id: string
          processor?: string | null
          processor_version?: string | null
          segment_count?: number
          started_at?: string
          started_by: string
          state?: string
        }
        Update: {
          document_id?: string
          error?: string | null
          fact_count?: number
          finished_at?: string | null
          id?: string
          organization_id?: string
          processor?: string | null
          processor_version?: string | null
          segment_count?: number
          started_at?: string
          started_by?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_processing_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_processing_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_segments: {
        Row: {
          cell_ref: string | null
          content: string
          document_id: string
          extracted_at: string
          id: string
          job_id: string
          locator: Json
          locator_key: string
          method: string
          method_version: string
          organization_id: string
          page_number: number | null
          seq: number
          sheet_name: string | null
        }
        Insert: {
          cell_ref?: string | null
          content: string
          document_id: string
          extracted_at?: string
          id?: string
          job_id: string
          locator: Json
          locator_key: string
          method: string
          method_version: string
          organization_id: string
          page_number?: number | null
          seq: number
          sheet_name?: string | null
        }
        Update: {
          cell_ref?: string | null
          content?: string
          document_id?: string
          extracted_at?: string
          id?: string
          job_id?: string
          locator?: Json
          locator_key?: string
          method?: string
          method_version?: string
          organization_id?: string
          page_number?: number | null
          seq?: number
          sheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_segments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_segments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "document_processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_packages: {
        Row: {
          certification_status: string
          content: Json
          content_sha256: string
          generated_at: string
          generated_by: string
          id: string
          organization_id: string
          reporting_period: string
          requirement_identifier: string
          requirement_record_id: string
          status: string
          version: number
        }
        Insert: {
          certification_status?: string
          content: Json
          content_sha256: string
          generated_at?: string
          generated_by: string
          id?: string
          organization_id: string
          reporting_period?: string
          requirement_identifier: string
          requirement_record_id: string
          status?: string
          version: number
        }
        Update: {
          certification_status?: string
          content?: Json
          content_sha256?: string
          generated_at?: string
          generated_by?: string
          id?: string
          organization_id?: string
          reporting_period?: string
          requirement_identifier?: string
          requirement_record_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_packages_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_packages_requirement_record_id_fkey"
            columns: ["requirement_record_id"]
            isOneToOne: false
            referencedRelation: "master_reference_records"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_reviews: {
        Row: {
          created_at: string
          decision: string
          fact_id: string
          id: string
          note: string | null
          organization_id: string
          previous_state: string
          reviewer_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          fact_id: string
          id?: string
          note?: string | null
          organization_id: string
          previous_state: string
          reviewer_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          fact_id?: string
          id?: string
          note?: string | null
          organization_id?: string
          previous_state?: string
          reviewer_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fact_reviews_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "proposed_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      held_record_reviews: {
        Row: {
          affected_fields: string | null
          correction: string | null
          created_at: string
          decision: string
          explanation: string
          finding: string | null
          id: string
          organization_id: string
          revalidation_result: string | null
          reviewer_id: string
          source_identifier: string
          source_row: number
          source_sheet: string
        }
        Insert: {
          affected_fields?: string | null
          correction?: string | null
          created_at?: string
          decision: string
          explanation: string
          finding?: string | null
          id?: string
          organization_id: string
          revalidation_result?: string | null
          reviewer_id?: string
          source_identifier: string
          source_row: number
          source_sheet: string
        }
        Update: {
          affected_fields?: string | null
          correction?: string | null
          created_at?: string
          decision?: string
          explanation?: string
          finding?: string | null
          id?: string
          organization_id?: string
          revalidation_result?: string | null
          reviewer_id?: string
          source_identifier?: string
          source_row?: number
          source_sheet?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_record_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_record_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      package_reviews: {
        Row: {
          content_sha256: string
          created_at: string
          decision: string
          id: string
          note: string
          organization_id: string
          package_id: string
          reviewer_id: string
        }
        Insert: {
          content_sha256: string
          created_at?: string
          decision: string
          id?: string
          note: string
          organization_id: string
          package_id: string
          reviewer_id: string
        }
        Update: {
          content_sha256?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string
          organization_id?: string
          package_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_reviews_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "evidence_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      proposed_facts: {
        Row: {
          canonical_field: string | null
          confidence: number | null
          created_at: string
          document_id: string
          extracted_value: string
          id: string
          integrity: string
          locator: Json
          locator_key: string
          method: string
          method_version: string
          organization_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_value: string | null
          reviewer_id: string | null
          segment_id: string
          source_label: string
          spec_source: string | null
          state: string
          validation_issues: Json
        }
        Insert: {
          canonical_field?: string | null
          confidence?: number | null
          created_at?: string
          document_id: string
          extracted_value: string
          id?: string
          integrity?: string
          locator: Json
          locator_key: string
          method: string
          method_version: string
          organization_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_value?: string | null
          reviewer_id?: string | null
          segment_id: string
          source_label: string
          spec_source?: string | null
          state?: string
          validation_issues?: Json
        }
        Update: {
          canonical_field?: string | null
          confidence?: number | null
          created_at?: string
          document_id?: string
          extracted_value?: string
          id?: string
          integrity?: string
          locator?: Json
          locator_key?: string
          method?: string
          method_version?: string
          organization_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_value?: string | null
          reviewer_id?: string | null
          segment_id?: string
          source_label?: string
          spec_source?: string | null
          state?: string
          validation_issues?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proposed_facts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_facts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_facts_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_facts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "document_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          provenance: Json
          relation_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          rule_id: string
          rule_version: string
          source_id: string
          source_label: string
          source_type: string
          status: string
          target_id: string
          target_label: string
          target_type: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          provenance: Json
          relation_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_id: string
          rule_version: string
          source_id: string
          source_label: string
          source_type: string
          status?: string
          target_id: string
          target_label: string
          target_type: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          provenance?: Json
          relation_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_id?: string
          rule_version?: string
          source_id?: string
          source_label?: string
          source_type?: string
          status?: string
          target_id?: string
          target_label?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_runs: {
        Row: {
          actor_id: string | null
          created_at: string
          created_count: number
          existing_count: number
          gaps: Json
          id: string
          input_ref: Json
          organization_id: string
          rule_id: string
          rule_version: string
          trigger_event: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          created_count?: number
          existing_count?: number
          gaps?: Json
          id?: string
          input_ref: Json
          organization_id: string
          rule_id: string
          rule_version: string
          trigger_event: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          created_count?: number
          existing_count?: number
          gaps?: Json
          id?: string
          input_ref?: Json
          organization_id?: string
          rule_id?: string
          rule_version?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_runs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          attempts: number
          category_code: string
          created_at: string
          declared_mime_type: string | null
          declared_purpose: string | null
          department_or_owner: string | null
          detected_mime_type: string | null
          document_date_raw: string | null
          document_type_id: string
          document_version_or_status: string | null
          extraction_status: string
          file_extension: string
          file_size_bytes: number
          id: string
          language: string | null
          module: string
          organization_id: string
          original_filename: string
          processing_status: string
          reporting_period: string | null
          schema_version: string
          sha256_hash: string
          storage_object_key: string
          updated_at: string
          upload_id: string
          uploaded_at: string | null
          uploader_id: string
          validation_errors: Json
        }
        Insert: {
          attempts?: number
          category_code: string
          created_at?: string
          declared_mime_type?: string | null
          declared_purpose?: string | null
          department_or_owner?: string | null
          detected_mime_type?: string | null
          document_date_raw?: string | null
          document_type_id?: string
          document_version_or_status?: string | null
          extraction_status?: string
          file_extension: string
          file_size_bytes: number
          id?: string
          language?: string | null
          module: string
          organization_id: string
          original_filename: string
          processing_status?: string
          reporting_period?: string | null
          schema_version?: string
          sha256_hash: string
          storage_object_key: string
          updated_at?: string
          upload_id?: string
          uploaded_at?: string | null
          uploader_id: string
          validation_errors?: Json
        }
        Update: {
          attempts?: number
          category_code?: string
          created_at?: string
          declared_mime_type?: string | null
          declared_purpose?: string | null
          department_or_owner?: string | null
          detected_mime_type?: string | null
          document_date_raw?: string | null
          document_type_id?: string
          document_version_or_status?: string | null
          extraction_status?: string
          file_extension?: string
          file_size_bytes?: number
          id?: string
          language?: string | null
          module?: string
          organization_id?: string
          original_filename?: string
          processing_status?: string
          reporting_period?: string | null
          schema_version?: string
          sha256_hash?: string
          storage_object_key?: string
          updated_at?: string
          upload_id?: string
          uploaded_at?: string | null
          uploader_id?: string
          validation_errors?: Json
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      apply_fact_rules: { Args: { _fact: string }; Returns: Json }
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
      begin_processing: { Args: { _doc: string }; Returns: string }
      bootstrap_operator: { Args: { _user: string }; Returns: string }
      can_manage: { Args: { _org: string }; Returns: boolean }
      can_read_org: { Args: { _org: string }; Returns: boolean }
      complete_processing: {
        Args: {
          _error: string
          _facts: Json
          _job: string
          _processor: string
          _segments: Json
          _status: string
          _version: string
        }
        Returns: Json
      }
      complete_processing_trusted: {
        Args: {
          _actor: string
          _error: string
          _facts: Json
          _job: string
          _processor: string
          _segments: Json
          _status: string
          _version: string
        }
        Returns: Json
      }
      finalize_document: {
        Args: {
          _detected_mime: string
          _errors: Json
          _id: string
          _sha: string
        }
        Returns: string
      }
      finish_master_import: { Args: { _run: string }; Returns: Json }
      is_member: { Args: { _org: string }; Returns: boolean }
      is_operator: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      mark_document_failed: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      may_review_facts: { Args: { _org: string }; Returns: boolean }
      may_upload: { Args: { _org: string }; Returns: boolean }
      process_master_import: {
        Args: { _rows: Json; _run: string }
        Returns: number
      }
      propose_field_mapping: {
        Args: {
          _canonical: string
          _field: string
          _org: string
          _rationale: string
        }
        Returns: string
      }
      record_document_access: { Args: { _id: string }; Returns: undefined }
      record_security_event: {
        Args: { _event: string; _org: string }
        Returns: undefined
      }
      register_document: {
        Args: {
          _category: string
          _ext: string
          _filename: string
          _meta: Json
          _mime: string
          _module: string
          _org: string
          _sha: string
          _size: number
          _type: string
        }
        Returns: Json
      }
      relationship_endpoint_exists: {
        Args: { _id: string; _org: string; _type: string }
        Returns: boolean
      }
      retry_document: { Args: { _id: string }; Returns: string }
      review_evidence_package: {
        Args: { _decision: string; _note: string; _pkg: string; _sha: string }
        Returns: undefined
      }
      review_fact: {
        Args: {
          _decision: string
          _fact: string
          _note: string
          _value: string
        }
        Returns: Json
      }
      review_field_mapping: {
        Args: { _decision: string; _id: string; _note: string }
        Returns: undefined
      }
      review_relationship: {
        Args: { _decision: string; _note: string; _rel: string }
        Returns: undefined
      }
      save_evidence_package: {
        Args: {
          _content: Json
          _org: string
          _period: string
          _req: string
          _sha: string
        }
        Returns: Json
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
