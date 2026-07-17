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
      board_cross_audit_rules: {
        Row: {
          aciklama: string
          created_at: string
          degerlendirme_tipi: string
          icerik_durumu: string
          id: string
          kod: string
          onerilen_bulgu: string
          parametreler: Json
          question_id: string | null
          risk_seviyesi: string
          tetikleyici: string
          veri_kaynagi_durumu: string
        }
        Insert: {
          aciklama: string
          created_at?: string
          degerlendirme_tipi: string
          icerik_durumu?: string
          id?: string
          kod: string
          onerilen_bulgu: string
          parametreler?: Json
          question_id?: string | null
          risk_seviyesi: string
          tetikleyici: string
          veri_kaynagi_durumu?: string
        }
        Update: {
          aciklama?: string
          created_at?: string
          degerlendirme_tipi?: string
          icerik_durumu?: string
          id?: string
          kod?: string
          onerilen_bulgu?: string
          parametreler?: Json
          question_id?: string | null
          risk_seviyesi?: string
          tetikleyici?: string
          veri_kaynagi_durumu?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_cross_audit_rules_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "board_declaration_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      board_declaration_answers: {
        Row: {
          aciklama: string | null
          beyan: string
          created_at: string
          declaration_id: string
          id: string
          question_id: string
          son_dogrulama_tarihi: string | null
          sorumlu_yonetici: string | null
          tarih: string | null
          tenant_id: string
          yk_karar_referansi: string | null
        }
        Insert: {
          aciklama?: string | null
          beyan: string
          created_at?: string
          declaration_id: string
          id?: string
          question_id: string
          son_dogrulama_tarihi?: string | null
          sorumlu_yonetici?: string | null
          tarih?: string | null
          tenant_id: string
          yk_karar_referansi?: string | null
        }
        Update: {
          aciklama?: string | null
          beyan?: string
          created_at?: string
          declaration_id?: string
          id?: string
          question_id?: string
          son_dogrulama_tarihi?: string | null
          sorumlu_yonetici?: string | null
          tarih?: string | null
          tenant_id?: string
          yk_karar_referansi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_declaration_answers_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "board_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "board_declaration_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_answers_sorumlu_yonetici_fkey"
            columns: ["sorumlu_yonetici"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      board_declaration_evidence_links: {
        Row: {
          answer_id: string
          evidence_id: string
          tenant_id: string
        }
        Insert: {
          answer_id: string
          evidence_id: string
          tenant_id: string
        }
        Update: {
          answer_id?: string
          evidence_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_declaration_evidence_links_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "board_declaration_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_evidence_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_evidence_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      board_declaration_questions: {
        Row: {
          beklenen_kanit: string
          created_at: string
          icerik_durumu: string
          id: string
          kod: string
          mevzuat_notu: string | null
          sira: number
          soru: string
        }
        Insert: {
          beklenen_kanit: string
          created_at?: string
          icerik_durumu?: string
          id?: string
          kod: string
          mevzuat_notu?: string | null
          sira: number
          soru: string
        }
        Update: {
          beklenen_kanit?: string
          created_at?: string
          icerik_durumu?: string
          id?: string
          kod?: string
          mevzuat_notu?: string | null
          sira?: number
          soru?: string
        }
        Relationships: []
      }
      board_declaration_simulation_links: {
        Row: {
          answer_id: string
          run_id: string
          tenant_id: string
        }
        Insert: {
          answer_id: string
          run_id: string
          tenant_id: string
        }
        Update: {
          answer_id?: string
          run_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_declaration_simulation_links_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "board_declaration_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_simulation_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declaration_simulation_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      board_declarations: {
        Row: {
          created_at: string
          donem_baslangic: string | null
          donem_bitis: string | null
          donem_etiketi: string
          durum: string
          id: string
          sunan: string | null
          sunuldu_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          donem_baslangic?: string | null
          donem_bitis?: string | null
          donem_etiketi: string
          durum?: string
          id?: string
          sunan?: string | null
          sunuldu_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          donem_baslangic?: string | null
          donem_bitis?: string | null
          donem_etiketi?: string
          durum?: string
          id?: string
          sunan?: string | null
          sunuldu_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_declarations_sunan_fkey"
            columns: ["sunan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_declarations_tenant_id_fkey"
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
          captured_at: string | null
          classification: string | null
          control_id: string
          created_at: string
          envelope_schema_version: string | null
          file_size: number | null
          gecerlilik_bitis: string | null
          hash_algorithm: string
          hash_sha256: string | null
          id: string
          legal_hold: boolean
          mime_type: string | null
          previous_envelope_hash: string | null
          previous_evidence_id: string | null
          previous_file_hash: string | null
          retention_class: string | null
          source_system: string | null
          storage_object_key: string | null
          storage_path: string | null
          storage_version_id: string | null
          tenant_id: string
          tip: string
          version_no: number
          yukleyen: string | null
        }
        Insert: {
          captured_at?: string | null
          classification?: string | null
          control_id: string
          created_at?: string
          envelope_schema_version?: string | null
          file_size?: number | null
          gecerlilik_bitis?: string | null
          hash_algorithm?: string
          hash_sha256?: string | null
          id?: string
          legal_hold?: boolean
          mime_type?: string | null
          previous_envelope_hash?: string | null
          previous_evidence_id?: string | null
          previous_file_hash?: string | null
          retention_class?: string | null
          source_system?: string | null
          storage_object_key?: string | null
          storage_path?: string | null
          storage_version_id?: string | null
          tenant_id: string
          tip: string
          version_no?: number
          yukleyen?: string | null
        }
        Update: {
          captured_at?: string | null
          classification?: string | null
          control_id?: string
          created_at?: string
          envelope_schema_version?: string | null
          file_size?: number | null
          gecerlilik_bitis?: string | null
          hash_algorithm?: string
          hash_sha256?: string | null
          id?: string
          legal_hold?: boolean
          mime_type?: string | null
          previous_envelope_hash?: string | null
          previous_evidence_id?: string | null
          previous_file_hash?: string | null
          retention_class?: string | null
          source_system?: string | null
          storage_object_key?: string | null
          storage_path?: string | null
          storage_version_id?: string | null
          tenant_id?: string
          tip?: string
          version_no?: number
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
            foreignKeyName: "evidences_previous_evidence_id_fkey"
            columns: ["previous_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
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
      scenario_control_mappings: {
        Row: {
          control_id: string
          expected_action_id: string
        }
        Insert: {
          control_id: string
          expected_action_id: string
        }
        Update: {
          control_id?: string
          expected_action_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_control_mappings_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_control_mappings_expected_action_id_fkey"
            columns: ["expected_action_id"]
            isOneToOne: false
            referencedRelation: "scenario_expected_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_decision_points: {
        Row: {
          id: string
          inject_id: string | null
          kod: string
          secenekler: Json | null
          soru: string
          sure_limiti_dakika: number | null
          tip: string
          version_id: string
        }
        Insert: {
          id?: string
          inject_id?: string | null
          kod: string
          secenekler?: Json | null
          soru: string
          sure_limiti_dakika?: number | null
          tip: string
          version_id: string
        }
        Update: {
          id?: string
          inject_id?: string | null
          kod?: string
          secenekler?: Json | null
          soru?: string
          sure_limiti_dakika?: number | null
          tip?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_decision_points_inject_id_fkey"
            columns: ["inject_id"]
            isOneToOne: false
            referencedRelation: "scenario_injects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_decision_points_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "scenario_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_expected_actions: {
        Row: {
          aciklama: string
          hedef_dakika: number | null
          id: string
          kod: string
          version_id: string
        }
        Insert: {
          aciklama: string
          hedef_dakika?: number | null
          id?: string
          kod: string
          version_id: string
        }
        Update: {
          aciklama?: string
          hedef_dakika?: number | null
          id?: string
          kod?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_expected_actions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "scenario_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_injects: {
        Row: {
          baslik: string
          beklenen_davranis: string | null
          gorunur_roller: string[]
          icerik: string
          id: string
          sira: number
          t_dakika: number
          version_id: string
        }
        Insert: {
          baslik: string
          beklenen_davranis?: string | null
          gorunur_roller?: string[]
          icerik: string
          id?: string
          sira: number
          t_dakika: number
          version_id: string
        }
        Update: {
          baslik?: string
          beklenen_davranis?: string | null
          gorunur_roller?: string[]
          icerik?: string
          id?: string
          sira?: number
          t_dakika?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_injects_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "scenario_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_scoring_rules: {
        Row: {
          aciklama: string
          agirlik: number
          bilesen: string
          expected_action_id: string | null
          id: string
          kod: string
          parametreler: Json
          tip: string
          version_id: string
        }
        Insert: {
          aciklama: string
          agirlik: number
          bilesen: string
          expected_action_id?: string | null
          id?: string
          kod: string
          parametreler?: Json
          tip: string
          version_id: string
        }
        Update: {
          aciklama?: string
          agirlik?: number
          bilesen?: string
          expected_action_id?: string | null
          id?: string
          kod?: string
          parametreler?: Json
          tip?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_scoring_rules_expected_action_id_fkey"
            columns: ["expected_action_id"]
            isOneToOne: false
            referencedRelation: "scenario_expected_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_scoring_rules_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "scenario_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_template_versions: {
        Row: {
          created_at: string
          durum: string
          hedef_roller: string[]
          id: string
          on_kosullar: string | null
          surum: number
          tahmini_dakika: number
          template_id: string
          yayinlandi_at: string | null
        }
        Insert: {
          created_at?: string
          durum?: string
          hedef_roller?: string[]
          id?: string
          on_kosullar?: string | null
          surum: number
          tahmini_dakika: number
          template_id: string
          yayinlandi_at?: string | null
        }
        Update: {
          created_at?: string
          durum?: string
          hedef_roller?: string[]
          id?: string
          on_kosullar?: string | null
          surum?: number
          tahmini_dakika?: number
          template_id?: string
          yayinlandi_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenario_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scenario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_templates: {
        Row: {
          aciklama: string | null
          ad: string
          created_at: string
          icerik_durumu: string
          id: string
          kod: string
          tehdit_kategorisi: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          icerik_durumu?: string
          id?: string
          kod: string
          tehdit_kategorisi: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          icerik_durumu?: string
          id?: string
          kod?: string
          tehdit_kategorisi?: string
        }
        Relationships: []
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
      simulation_action_results: {
        Row: {
          aciklama: string | null
          created_at: string
          expected_action_id: string
          id: string
          isaretleyen: string
          run_id: string
          senaryo_dakika: number | null
          tamamlandi: boolean
          tenant_id: string
        }
        Insert: {
          aciklama?: string | null
          created_at?: string
          expected_action_id: string
          id?: string
          isaretleyen: string
          run_id: string
          senaryo_dakika?: number | null
          tamamlandi: boolean
          tenant_id: string
        }
        Update: {
          aciklama?: string | null
          created_at?: string
          expected_action_id?: string
          id?: string
          isaretleyen?: string
          run_id?: string
          senaryo_dakika?: number | null
          tamamlandi?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_action_results_expected_action_id_fkey"
            columns: ["expected_action_id"]
            isOneToOne: false
            referencedRelation: "scenario_expected_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_action_results_isaretleyen_fkey"
            columns: ["isaretleyen"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_action_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_action_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_decisions: {
        Row: {
          cevap: string | null
          created_at: string
          decision_point_id: string
          evidence_id: string | null
          id: string
          katilimci_id: string
          run_id: string
          senaryo_dakika: number
          tenant_id: string
        }
        Insert: {
          cevap?: string | null
          created_at?: string
          decision_point_id: string
          evidence_id?: string | null
          id?: string
          katilimci_id: string
          run_id: string
          senaryo_dakika: number
          tenant_id: string
        }
        Update: {
          cevap?: string | null
          created_at?: string
          decision_point_id?: string
          evidence_id?: string | null
          id?: string
          katilimci_id?: string
          run_id?: string
          senaryo_dakika?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_decisions_decision_point_id_fkey"
            columns: ["decision_point_id"]
            isOneToOne: false
            referencedRelation: "scenario_decision_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_decisions_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_decisions_katilimci_id_fkey"
            columns: ["katilimci_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_finding_proposals: {
        Row: {
          baslik: string
          control_id: string | null
          created_at: string
          durum: string
          finding_id: string | null
          gerekce: string
          id: string
          karar_at: string | null
          karar_veren: string | null
          onem: string
          run_id: string
          tenant_id: string
        }
        Insert: {
          baslik: string
          control_id?: string | null
          created_at?: string
          durum?: string
          finding_id?: string | null
          gerekce: string
          id?: string
          karar_at?: string | null
          karar_veren?: string | null
          onem: string
          run_id: string
          tenant_id: string
        }
        Update: {
          baslik?: string
          control_id?: string | null
          created_at?: string
          durum?: string
          finding_id?: string | null
          gerekce?: string
          id?: string
          karar_at?: string | null
          karar_veren?: string | null
          onem?: string
          run_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_finding_proposals_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_finding_proposals_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_finding_proposals_karar_veren_fkey"
            columns: ["karar_veren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_finding_proposals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_finding_proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_inject_deliveries: {
        Row: {
          id: string
          inject_id: string
          run_id: string
          tenant_id: string
          yayinlandi_at: string
          yayinlayan: string | null
        }
        Insert: {
          id?: string
          inject_id: string
          run_id: string
          tenant_id: string
          yayinlandi_at?: string
          yayinlayan?: string | null
        }
        Update: {
          id?: string
          inject_id?: string
          run_id?: string
          tenant_id?: string
          yayinlandi_at?: string
          yayinlayan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_inject_deliveries_inject_id_fkey"
            columns: ["inject_id"]
            isOneToOne: false
            referencedRelation: "scenario_injects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_inject_deliveries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_inject_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_inject_deliveries_yayinlayan_fkey"
            columns: ["yayinlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_manifest_receipts: {
        Row: {
          anchored_at: string
          created_at: string
          id: string
          manifest_id: string
          payload: Json | null
          saglayici: string
          seq: number
          tenant_id: string
        }
        Insert: {
          anchored_at: string
          created_at?: string
          id?: string
          manifest_id: string
          payload?: Json | null
          saglayici: string
          seq?: never
          tenant_id: string
        }
        Update: {
          anchored_at?: string
          created_at?: string
          id?: string
          manifest_id?: string
          payload?: Json | null
          saglayici?: string
          seq?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_manifest_receipts_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "simulation_result_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_manifest_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_observations: {
        Row: {
          control_id: string | null
          created_at: string
          gozlemci_id: string
          id: string
          katilimcilara_acik: boolean
          not_metni: string
          run_id: string
          senaryo_dakika: number | null
          tenant_id: string
        }
        Insert: {
          control_id?: string | null
          created_at?: string
          gozlemci_id: string
          id?: string
          katilimcilara_acik?: boolean
          not_metni: string
          run_id: string
          senaryo_dakika?: number | null
          tenant_id: string
        }
        Update: {
          control_id?: string | null
          created_at?: string
          gozlemci_id?: string
          id?: string
          katilimcilara_acik?: boolean
          not_metni?: string
          run_id?: string
          senaryo_dakika?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_observations_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_observations_gozlemci_id_fkey"
            columns: ["gozlemci_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_observations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_observations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_participants: {
        Row: {
          created_at: string
          id: string
          katilim_tipi: string
          run_id: string
          senaryo_rolu: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          katilim_tipi: string
          run_id: string
          senaryo_rolu: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          katilim_tipi?: string
          run_id?: string
          senaryo_rolu?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_participants_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_result_manifests: {
        Row: {
          core_manifest: Json
          core_manifest_hash: string
          id: string
          merkle_root: string
          muhurlendi_at: string
          report_data: Json | null
          report_data_hash: string
          run_id: string
          seq: number
          signature_jws: string | null
          signature_kid: string | null
          signature_public_jwk: Json | null
          signer_ad: string | null
          tenant_id: string
        }
        Insert: {
          core_manifest: Json
          core_manifest_hash: string
          id?: string
          merkle_root: string
          muhurlendi_at?: string
          report_data?: Json | null
          report_data_hash: string
          run_id: string
          seq?: never
          signature_jws?: string | null
          signature_kid?: string | null
          signature_public_jwk?: Json | null
          signer_ad?: string | null
          tenant_id: string
        }
        Update: {
          core_manifest?: Json
          core_manifest_hash?: string
          id?: string
          merkle_root?: string
          muhurlendi_at?: string
          report_data?: Json | null
          report_data_hash?: string
          run_id?: string
          seq?: never
          signature_jws?: string | null
          signature_kid?: string | null
          signature_public_jwk?: Json | null
          signer_ad?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_result_manifests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_result_manifests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          ad: string
          basladi_at: string | null
          bitti_at: string | null
          created_at: string
          duraklatilan_saniye: number
          duraklatildi_at: string | null
          durum: string
          id: string
          mod: string
          planlanan_baslangic: string | null
          tenant_id: string
          version_id: string
          zaman_olcegi: number
        }
        Insert: {
          ad: string
          basladi_at?: string | null
          bitti_at?: string | null
          created_at?: string
          duraklatilan_saniye?: number
          duraklatildi_at?: string | null
          durum?: string
          id?: string
          mod: string
          planlanan_baslangic?: string | null
          tenant_id: string
          version_id: string
          zaman_olcegi?: number
        }
        Update: {
          ad?: string
          basladi_at?: string | null
          bitti_at?: string | null
          created_at?: string
          duraklatilan_saniye?: number
          duraklatildi_at?: string | null
          durum?: string
          id?: string
          mod?: string
          planlanan_baslangic?: string | null
          tenant_id?: string
          version_id?: string
          zaman_olcegi?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "scenario_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_scores: {
        Row: {
          durum: string
          hesaplandi_at: string
          id: string
          kritik_basarisizliklar: Json
          puan: number
          run_id: string
          satirlar: Json
          tenant_id: string
        }
        Insert: {
          durum: string
          hesaplandi_at?: string
          id?: string
          kritik_basarisizliklar?: Json
          puan: number
          run_id: string
          satirlar: Json
          tenant_id: string
        }
        Update: {
          durum?: string
          hesaplandi_at?: string
          id?: string
          kritik_basarisizliklar?: Json
          puan?: number
          run_id?: string
          satirlar?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scores_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_scores_tenant_id_fkey"
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
      evidence_butunluk_durumu: {
        Args: { target_evidence_id: string }
        Returns: string
      }
      evidence_durumu: { Args: { target_evidence_id: string }; Returns: string }
      manifest_dogrula: {
        Args: { target_hash: string }
        Returns: {
          anchored_at: string
          durum: string
          muhurlendi_at: string
          report_data_hash: string
          saglayici: string
        }[]
      }
      manifest_dogrulama_durumu: {
        Args: { target_manifest_id: string }
        Returns: string
      }
      paylasim_goruntule: { Args: { p_token: string }; Returns: Json }
      simulation_manifest_durumu: {
        Args: { target_manifest_id: string }
        Returns: string
      }
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
