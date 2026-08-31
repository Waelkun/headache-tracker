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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_intakes: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          parsed_payload: Json | null
          raw_text: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          parsed_payload?: Json | null
          raw_text: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          parsed_payload?: Json | null
          raw_text?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_intakes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_contexts: {
        Row: {
          context_code: string
          created_at: string
          episode_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          context_code: string
          created_at?: string
          episode_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          context_code?: string
          created_at?: string
          episode_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_contexts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_interventions: {
        Row: {
          amount: number | null
          created_at: string
          effect: string | null
          effect_delay_minutes: number | null
          episode_id: string
          id: string
          intensity_after: number | null
          intensity_before: number | null
          intervention_type: string
          label: string | null
          notes: string | null
          performed_at: string
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          effect?: string | null
          effect_delay_minutes?: number | null
          episode_id: string
          id?: string
          intensity_after?: number | null
          intensity_before?: number | null
          intervention_type: string
          label?: string | null
          notes?: string | null
          performed_at: string
          unit?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          effect?: string | null
          effect_delay_minutes?: number | null
          episode_id?: string
          id?: string
          intensity_after?: number | null
          intensity_before?: number | null
          intervention_type?: string
          label?: string | null
          notes?: string | null
          performed_at?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_interventions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_symptoms: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          notes: string | null
          severity: number | null
          symptom_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          notes?: string | null
          severity?: number | null
          symptom_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          notes?: string | null
          severity?: number | null
          symptom_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_symptoms_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      headache_episodes: {
        Row: {
          ai_source_text: string | null
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          onset_kind: string
          pain_character: string[]
          start_precision: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_source_text?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          onset_kind?: string
          pain_character?: string[]
          start_precision?: string
          started_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_source_text?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          onset_kind?: string
          pain_character?: string[]
          start_precision?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intensity_segments: {
        Row: {
          created_at: string
          ended_at: string | null
          episode_id: string
          id: string
          intensity: number
          is_approximate: boolean
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          episode_id: string
          id?: string
          intensity: number
          is_approximate?: boolean
          source?: string
          started_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          episode_id?: string
          id?: string
          intensity?: number
          is_approximate?: boolean
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intensity_segments_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_templates: {
        Row: {
          created_at: string
          default_unit: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_unit?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_unit?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pain_locations: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          intensity: number | null
          mark_type: string
          points: Json
          region_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          intensity?: number | null
          mark_type: string
          points?: Json
          region_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          intensity?: number | null
          mark_type?: string
          points?: Json
          region_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_locations_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "headache_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          timezone: string
          tracking_started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          timezone?: string
          tracking_started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          timezone?: string
          tracking_started_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
