// Generated from the applied Postgres migration.
export type Database = {
  public: {
    Tables: {
      entries: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          report_date: string;
          created_at: string;
        };
        Insert: {
          id: string;
          project_id: string;
          user_id: string;
          report_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          report_date?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "entries_project_id_user_id_fkey"; columns: ["project_id","user_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id","user_id"] },
        ];
      };
      photos: {
        Row: {
          id: string;
          entry_id: string;
          project_id: string;
          user_id: string;
          lat: number;
          lng: number;
          accuracy: number;
          captured_at: string;
          note: string;
          description: string;
          description_approved_at: string | null;
          ai_ok: boolean | null;
          storage_path: string;
          size_bytes: number;
        };
        Insert: {
          id: string;
          entry_id: string;
          project_id: string;
          user_id: string;
          lat: number;
          lng: number;
          accuracy: number;
          captured_at: string;
          note?: string;
          description?: string;
          description_approved_at?: string | null;
          ai_ok?: boolean | null;
          storage_path: string;
          size_bytes: number;
        };
        Update: {
          id?: string;
          entry_id?: string;
          project_id?: string;
          user_id?: string;
          lat?: number;
          lng?: number;
          accuracy?: number;
          captured_at?: string;
          note?: string;
          description?: string;
          description_approved_at?: string | null;
          ai_ok?: boolean | null;
          storage_path?: string;
          size_bytes?: number;
        };
        Relationships: [
          { foreignKeyName: "photos_entry_id_project_id_user_id_fkey"; columns: ["entry_id","project_id","user_id"]; isOneToOne: false; referencedRelation: "entries"; referencedColumns: ["id","project_id","user_id"] },
        ];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company_name: string | null;
          prepared_by: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          company_name?: string | null;
          prepared_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          company_name?: string | null;
          prepared_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "projects_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      reports: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          report_date: string;
          pdf_path: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id: string;
          project_id: string;
          user_id: string;
          report_date: string;
          pdf_path: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          report_date?: string;
          pdf_path?: string;
          size_bytes?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "reports_project_id_report_date_fkey"; columns: ["project_id","report_date"]; isOneToOne: false; referencedRelation: "entries"; referencedColumns: ["project_id","report_date"] },
          { foreignKeyName: "reports_project_id_user_id_fkey"; columns: ["project_id","user_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id","user_id"] },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: { diary_storage_bytes: { Args: never; Returns: number } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
