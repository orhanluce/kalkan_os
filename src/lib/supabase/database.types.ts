// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
// Yeniden üretmek için: pnpm db:types

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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anchor_batch_leaves: {
        Row: {
          batch_id: string
          evidence_id: string
          tenant_id: string
        }
        Insert: {
          batch_id: string
          evidence_id: string
          tenant_id: string
        }
        Update: {
          batch_id?: string
          evidence_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anchor_batch_leaves_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "anchor_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_batch_leaves_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_batch_leaves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_batches: {
        Row: {
          created_at: string
          id: string
          merkle_root: string
          seq: number
          tenant_id: string
          yaprak_sayisi: number
        }
        Insert: {
          created_at?: string
          id?: string
          merkle_root: string
          seq?: never
          tenant_id: string
          yaprak_sayisi: number
        }
        Update: {
          created_at?: string
          id?: string
          merkle_root?: string
          seq?: never
          tenant_id?: string
          yaprak_sayisi?: number
        }
        Relationships: [
          {
            foreignKeyName: "anchor_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_receipts: {
        Row: {
          anchored_at: string
          batch_id: string
          created_at: string
          id: string
          payload: Json | null
          saglayici: string
          seq: number
          tenant_id: string
        }
        Insert: {
          anchored_at: string
          batch_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          saglayici: string
          seq?: never
          tenant_id: string
        }
        Update: {
          anchored_at?: string
          batch_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          saglayici?: string
          seq?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anchor_receipts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "anchor_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          detay: Json | null
          event_hash: string | null
          eylem: string
          hedef_id: string | null
          hedef_tablo: string | null
          id: string
          previous_event_hash: string | null
          seq: number
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detay?: Json | null
          event_hash?: string | null
          eylem: string
          hedef_id?: string | null
          hedef_tablo?: string | null
          id?: string
          previous_event_hash?: string | null
          seq?: never
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detay?: Json | null
          event_hash?: string | null
          eylem?: string
          hedef_id?: string | null
          hedef_tablo?: string | null
          id?: string
          previous_event_hash?: string | null
          seq?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      control_mappings: {
        Row: {
          control_id_a: string
          control_id_b: string
          id: string
          iliski: string
        }
        Insert: {
          control_id_a: string
          control_id_b: string
          id?: string
          iliski: string
        }
        Update: {
          control_id_a?: string
          control_id_b?: string
          id?: string
          iliski?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_mappings_control_id_a_fkey"
            columns: ["control_id_a"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_mappings_control_id_b_fkey"
            columns: ["control_id_b"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          aciklama: string | null
          baslik: string
          framework_id: string
          id: string
          kanit_tipi: string[]
          kritiklik: number
          madde_ref: string
          periyot: string
        }
        Insert: {
          aciklama?: string | null
          baslik: string
          framework_id: string
          id?: string
          kanit_tipi?: string[]
          kritiklik: number
          madde_ref: string
          periyot: string
        }
        Update: {
          aciklama?: string | null
          baslik?: string
          framework_id?: string
          id?: string
          kanit_tipi?: string[]
          kritiklik?: number
          madde_ref?: string
          periyot?: string
        }
        Relationships: [
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_reviews: {
        Row: {
          created_at: string
          evidence_id: string
          gerekce: string | null
          id: string
          karar: string
          reviewer_id: string
          seq: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          gerekce?: string | null
          id?: string
          karar: string
          reviewer_id: string
          seq?: never
          tenant_id: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          gerekce?: string | null
          id?: string
          karar?: string
          reviewer_id?: string
          seq?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_reviews_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          control_id: string
          created_at: string
          gecerlilik_bitis: string | null
          hash_sha256: string | null
          id: string
          storage_path: string | null
          tenant_id: string
          tip: string
          yukleyen: string | null
        }
        Insert: {
          control_id: string
          created_at?: string
          gecerlilik_bitis?: string | null
          hash_sha256?: string | null
          id?: string
          storage_path?: string | null
          tenant_id: string
          tip: string
          yukleyen?: string | null
        }
        Update: {
          control_id?: string
          created_at?: string
          gecerlilik_bitis?: string | null
          hash_sha256?: string | null
          id?: string
          storage_path?: string | null
          tenant_id?: string
          tip?: string
          yukleyen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidences_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_yukleyen_fkey"
            columns: ["yukleyen"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          aksiyon_plani: string | null
          baslik: string
          created_at: string
          durum: string
          hedef_kapama: string | null
          id: string
          kaynak: string
          onem: string
          tenant_id: string
          updated_at: string
          yk_onay_tarihi: string | null
        }
        Insert: {
          aksiyon_plani?: string | null
          baslik: string
          created_at?: string
          durum?: string
          hedef_kapama?: string | null
          id?: string
          kaynak: string
          onem: string
          tenant_id: string
          updated_at?: string
          yk_onay_tarihi?: string | null
        }
        Update: {
          aksiyon_plani?: string | null
          baslik?: string
          created_at?: string
          durum?: string
          hedef_kapama?: string | null
          id?: string
          kaynak?: string
          onem?: string
          tenant_id?: string
          updated_at?: string
          yk_onay_tarihi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      frameworks: {
        Row: {
          code: string
          id: string
          name: string
          version: string
          yururluk_tarihi: string | null
        }
        Insert: {
          code: string
          id?: string
          name: string
          version: string
          yururluk_tarihi?: string | null
        }
        Update: {
          code?: string
          id?: string
          name?: string
          version?: string
          yururluk_tarihi?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          id: string
          kapsam: Json
          olusturan: string | null
          son_gecerlilik: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          kapsam?: Json
          olusturan?: string | null
          son_gecerlilik: string
          tenant_id: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          kapsam?: Json
          olusturan?: string | null
          son_gecerlilik?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_controls: {
        Row: {
          control_id: string
          durum: string
          id: string
          not_metni: string | null
          son_degerlendirme: string | null
          sorumlu_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          control_id: string
          durum?: string
          id?: string
          not_metni?: string | null
          son_degerlendirme?: string | null
          sorumlu_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          control_id?: string
          durum?: string
          id?: string
          not_metni?: string | null
          son_degerlendirme?: string | null
          sorumlu_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_controls_sorumlu_user_id_fkey"
            columns: ["sorumlu_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          segment: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          segment: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          segment?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anchor_batch_durumu: {
        Args: { target_batch_id: string }
        Returns: string
      }
      audit_log_canonical: {
        Args: {
          p_actor_id: string
          p_created_at: string
          p_detay: Json
          p_eylem: string
          p_hedef_id: string
          p_hedef_tablo: string
          p_previous_event_hash: string
          p_tenant_id: string
        }
        Returns: string
      }
      current_role: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      evidence_anchor_bilgisi: {
        Args: { target_evidence_id: string }
        Returns: {
          anchored_at: string
          batch_id: string
          durum: string
          merkle_root: string
        }[]
      }
      evidence_durumu: { Args: { target_evidence_id: string }; Returns: string }
      paylasim_goruntule: { Args: { p_token: string }; Returns: Json }
      tenant_has_profiles: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      verify_audit_chain: {
        Args: { target_tenant_id: string }
        Returns: {
          bozuk_id: string
          bozuk_seq: number
          sebep: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
