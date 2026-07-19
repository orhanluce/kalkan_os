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
      activation_events: {
        Row: {
          event_type: string
          id: string
          meta: Json
          occurred_at: string
          tenant_id: string
        }
        Insert: {
          event_type: string
          id?: string
          meta?: Json
          occurred_at?: string
          tenant_id: string
        }
        Update: {
          event_type?: string
          id?: string
          meta?: Json
          occurred_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          ad: string
          ai_system_id: string
          created_at: string
          devre_disi_at: string | null
          durum: string
          id: string
          insan_onay_gerekli: boolean
          izinli_araclar: string[]
          service_identity: string | null
          tenant_id: string
          updated_at: string
          yazma_yetkisi: boolean
        }
        Insert: {
          ad: string
          ai_system_id: string
          created_at?: string
          devre_disi_at?: string | null
          durum?: string
          id?: string
          insan_onay_gerekli?: boolean
          izinli_araclar?: string[]
          service_identity?: string | null
          tenant_id: string
          updated_at?: string
          yazma_yetkisi?: boolean
        }
        Update: {
          ad?: string
          ai_system_id?: string
          created_at?: string
          devre_disi_at?: string | null
          durum?: string
          id?: string
          insan_onay_gerekli?: boolean
          izinli_araclar?: string[]
          service_identity?: string | null
          tenant_id?: string
          updated_at?: string
          yazma_yetkisi?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_data_lineage: {
        Row: {
          aciklama: string | null
          ad: string
          ai_evaluation_id: string
          created_at: string
          id: string
          izin_amaci: string | null
          kaynak_ref: string | null
          label_noise_olcum: string | null
          lisans: string | null
          poisoning_kontrol_kanit: string | null
          poisoning_riski: string
          sentetik_oran: number | null
          surum: string | null
          tenant_id: string
          tur: string
          uretim_yontemi: string | null
          veri_hash: string | null
        }
        Insert: {
          aciklama?: string | null
          ad: string
          ai_evaluation_id: string
          created_at?: string
          id?: string
          izin_amaci?: string | null
          kaynak_ref?: string | null
          label_noise_olcum?: string | null
          lisans?: string | null
          poisoning_kontrol_kanit?: string | null
          poisoning_riski?: string
          sentetik_oran?: number | null
          surum?: string | null
          tenant_id: string
          tur: string
          uretim_yontemi?: string | null
          veri_hash?: string | null
        }
        Update: {
          aciklama?: string | null
          ad?: string
          ai_evaluation_id?: string
          created_at?: string
          id?: string
          izin_amaci?: string | null
          kaynak_ref?: string | null
          label_noise_olcum?: string | null
          lisans?: string | null
          poisoning_kontrol_kanit?: string | null
          poisoning_riski?: string
          sentetik_oran?: number | null
          surum?: string | null
          tenant_id?: string
          tur?: string
          uretim_yontemi?: string | null
          veri_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_data_lineage_ai_evaluation_id_fkey"
            columns: ["ai_evaluation_id"]
            isOneToOne: false
            referencedRelation: "ai_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_data_lineage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_drift_readings: {
        Row: {
          aciklama: string | null
          ai_system_id: string
          baseline: number | null
          created_at: string
          deger: number
          esik: number | null
          esik_kaynagi: string | null
          id: string
          metrik: string
          olcum_tarihi: string
          override_eden: string | null
          override_edildi: boolean
          override_gerekce: string | null
          override_zamani: string | null
          segment: string | null
          tenant_id: string
        }
        Insert: {
          aciklama?: string | null
          ai_system_id: string
          baseline?: number | null
          created_at?: string
          deger: number
          esik?: number | null
          esik_kaynagi?: string | null
          id?: string
          metrik: string
          olcum_tarihi?: string
          override_eden?: string | null
          override_edildi?: boolean
          override_gerekce?: string | null
          override_zamani?: string | null
          segment?: string | null
          tenant_id: string
        }
        Update: {
          aciklama?: string | null
          ai_system_id?: string
          baseline?: number | null
          created_at?: string
          deger?: number
          esik?: number | null
          esik_kaynagi?: string | null
          id?: string
          metrik?: string
          olcum_tarihi?: string
          override_eden?: string | null
          override_edildi?: boolean
          override_gerekce?: string | null
          override_zamani?: string | null
          segment?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_drift_readings_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drift_readings_override_eden_fkey"
            columns: ["override_eden"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drift_readings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluations: {
        Row: {
          ai_system_id: string
          created_at: string
          degerlendiren: string | null
          degerlendirme_at: string
          gecerlilik_bitis: string | null
          id: string
          olcum: string | null
          sonuc: string
          tenant_id: string
          tur: string
        }
        Insert: {
          ai_system_id: string
          created_at?: string
          degerlendiren?: string | null
          degerlendirme_at?: string
          gecerlilik_bitis?: string | null
          id?: string
          olcum?: string | null
          sonuc?: string
          tenant_id: string
          tur: string
        }
        Update: {
          ai_system_id?: string
          created_at?: string
          degerlendiren?: string | null
          degerlendirme_at?: string
          gecerlilik_bitis?: string | null
          id?: string
          olcum?: string | null
          sonuc?: string
          tenant_id?: string
          tur?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluations_degerlendiren_fkey"
            columns: ["degerlendiren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_execution_receipts: {
        Row: {
          ai_agent_id: string | null
          ai_system_id: string
          amac: string
          confidence: number | null
          created_at: string
          fingerprint: string | null
          id: string
          karar: string
          kaynak_hash: string[]
          model_id: string | null
          model_saglayici: string | null
          model_surum: string | null
          prompt_hash: string | null
          reviewer: string | null
          reviewer_karar_zamani: string | null
          tenant_id: string
        }
        Insert: {
          ai_agent_id?: string | null
          ai_system_id: string
          amac: string
          confidence?: number | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          karar?: string
          kaynak_hash?: string[]
          model_id?: string | null
          model_saglayici?: string | null
          model_surum?: string | null
          prompt_hash?: string | null
          reviewer?: string | null
          reviewer_karar_zamani?: string | null
          tenant_id: string
        }
        Update: {
          ai_agent_id?: string | null
          ai_system_id?: string
          amac?: string
          confidence?: number | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          karar?: string
          kaynak_hash?: string[]
          model_id?: string | null
          model_saglayici?: string | null
          model_surum?: string | null
          prompt_hash?: string | null
          reviewer?: string | null
          reviewer_karar_zamani?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_execution_receipts_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_execution_receipts_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_execution_receipts_reviewer_fkey"
            columns: ["reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_execution_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_incidents: {
        Row: {
          ai_system_id: string
          bildirim_esik_saat: number | null
          ciddiyet: string
          created_at: string
          durum: string
          id: string
          kapanis_kanit: string | null
          kapanis_zamani: string | null
          kapatan: string | null
          otorite_bildirildi_at: string | null
          ozet: string
          tenant_id: string
          tespit_at: string
          updated_at: string
        }
        Insert: {
          ai_system_id: string
          bildirim_esik_saat?: number | null
          ciddiyet?: string
          created_at?: string
          durum?: string
          id?: string
          kapanis_kanit?: string | null
          kapanis_zamani?: string | null
          kapatan?: string | null
          otorite_bildirildi_at?: string | null
          ozet: string
          tenant_id: string
          tespit_at?: string
          updated_at?: string
        }
        Update: {
          ai_system_id?: string
          bildirim_esik_saat?: number | null
          ciddiyet?: string
          created_at?: string
          durum?: string
          id?: string
          kapanis_kanit?: string | null
          kapanis_zamani?: string | null
          kapatan?: string | null
          otorite_bildirildi_at?: string | null
          ozet?: string
          tenant_id?: string
          tespit_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_incidents_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_incidents_kapatan_fkey"
            columns: ["kapatan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_rollbacks: {
        Row: {
          ai_system_id: string
          created_at: string
          durum: string
          id: string
          karar_veren: string | null
          karar_zamani: string | null
          kaynak_drift_reading_id: string | null
          onceki_surum: string
          sebep: string
          son_test_kaniti: string | null
          son_test_tarihi: string | null
          tenant_id: string
          updated_at: string
          yeni_surum: string
        }
        Insert: {
          ai_system_id: string
          created_at?: string
          durum?: string
          id?: string
          karar_veren?: string | null
          karar_zamani?: string | null
          kaynak_drift_reading_id?: string | null
          onceki_surum: string
          sebep: string
          son_test_kaniti?: string | null
          son_test_tarihi?: string | null
          tenant_id: string
          updated_at?: string
          yeni_surum: string
        }
        Update: {
          ai_system_id?: string
          created_at?: string
          durum?: string
          id?: string
          karar_veren?: string | null
          karar_zamani?: string | null
          kaynak_drift_reading_id?: string | null
          onceki_surum?: string
          sebep?: string
          son_test_kaniti?: string | null
          son_test_tarihi?: string | null
          tenant_id?: string
          updated_at?: string
          yeni_surum?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_rollbacks_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_rollbacks_karar_veren_fkey"
            columns: ["karar_veren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_rollbacks_kaynak_drift_reading_id_fkey"
            columns: ["kaynak_drift_reading_id"]
            isOneToOne: false
            referencedRelation: "ai_drift_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_rollbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_systems: {
        Row: {
          ad: string
          created_at: string
          dpia_assessment_id: string | null
          durum: string
          id: string
          kendi_ajanimiz: boolean
          kullanim_amaci: string | null
          owner: string | null
          risk_sinifi: string
          rol: string
          saglayici: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          dpia_assessment_id?: string | null
          durum?: string
          id?: string
          kendi_ajanimiz?: boolean
          kullanim_amaci?: string | null
          owner?: string | null
          risk_sinifi?: string
          rol?: string
          saglayici?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          dpia_assessment_id?: string | null
          durum?: string
          id?: string
          kendi_ajanimiz?: boolean
          kullanim_amaci?: string | null
          owner?: string | null
          risk_sinifi?: string
          rol?: string
          saglayici?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_systems_dpia_assessment_id_fkey"
            columns: ["dpia_assessment_id"]
            isOneToOne: false
            referencedRelation: "privacy_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_systems_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_systems_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      applicability_decisions: {
        Row: {
          created_at: string
          durum: string
          fact_snapshot: Json
          fact_snapshot_fingerprint: string
          gerekce: string | null
          id: string
          karar_kaynagi: string
          kosul: string | null
          obligation_id: string
          onay_zamani: string | null
          onaylayan: string | null
          superseded_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          durum: string
          fact_snapshot: Json
          fact_snapshot_fingerprint: string
          gerekce?: string | null
          id?: string
          karar_kaynagi?: string
          kosul?: string | null
          obligation_id: string
          onay_zamani?: string | null
          onaylayan?: string | null
          superseded_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          durum?: string
          fact_snapshot?: Json
          fact_snapshot_fingerprint?: string
          gerekce?: string | null
          id?: string
          karar_kaynagi?: string
          kosul?: string | null
          obligation_id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          superseded_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicability_decisions_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicability_decisions_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicability_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_ledger_links: {
        Row: {
          artifact_id: string
          artifact_table: string
          created_at: string
          id: string
          ledger_entry_id: string
          tenant_id: string
        }
        Insert: {
          artifact_id: string
          artifact_table: string
          created_at?: string
          id?: string
          ledger_entry_id: string
          tenant_id: string
        }
        Update: {
          artifact_id?: string
          artifact_table?: string
          created_at?: string
          id?: string
          ledger_entry_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_ledger_links_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "transparency_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_ledger_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_findings: {
        Row: {
          aciklama: string | null
          assessment_id: string
          baslik: string
          ciddiyet: string
          created_at: string
          durum: string
          hedef_tarih: string | null
          id: string
          kapanis_kanit: string | null
          kapanis_zamani: string | null
          kapatan: string | null
          sahibi: string | null
          tenant_id: string
          third_party_id: string
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          assessment_id: string
          baslik: string
          ciddiyet?: string
          created_at?: string
          durum?: string
          hedef_tarih?: string | null
          id?: string
          kapanis_kanit?: string | null
          kapanis_zamani?: string | null
          kapatan?: string | null
          sahibi?: string | null
          tenant_id: string
          third_party_id: string
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          assessment_id?: string
          baslik?: string
          ciddiyet?: string
          created_at?: string
          durum?: string
          hedef_tarih?: string | null
          id?: string
          kapanis_kanit?: string | null
          kapanis_zamani?: string | null
          kapatan?: string | null
          sahibi?: string | null
          tenant_id?: string
          third_party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_findings_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "third_party_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_kapatan_fkey"
            columns: ["kapatan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_sahibi_fkey"
            columns: ["sahibi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_question_templates: {
        Row: {
          aktif: boolean
          created_at: string
          dogrulama_durumu: string
          dogrulama_zamani: string | null
          dogrulayan: string | null
          id: string
          kategori: string | null
          kaynak_citation: string | null
          kaynak_surumu: string | null
          sira: number
          soru: string
          tenant_id: string
          tur: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          id?: string
          kategori?: string | null
          kaynak_citation?: string | null
          kaynak_surumu?: string | null
          sira?: number
          soru: string
          tenant_id: string
          tur?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          id?: string
          kategori?: string | null
          kaynak_citation?: string | null
          kaynak_surumu?: string | null
          sira?: number
          soru?: string
          tenant_id?: string
          tur?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_question_templates_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_question_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          cevap: string | null
          created_at: string
          id: string
          kaynak_citation: string | null
          risk_seviyesi: string | null
          sira: number
          soru: string
          tenant_id: string
          uygulanabilirlik: string
        }
        Insert: {
          assessment_id: string
          cevap?: string | null
          created_at?: string
          id?: string
          kaynak_citation?: string | null
          risk_seviyesi?: string | null
          sira?: number
          soru: string
          tenant_id: string
          uygulanabilirlik?: string
        }
        Update: {
          assessment_id?: string
          cevap?: string | null
          created_at?: string
          id?: string
          kaynak_citation?: string | null
          risk_seviyesi?: string | null
          sira?: number
          soru?: string
          tenant_id?: string
          uygulanabilirlik?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "third_party_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_engagements: {
        Row: {
          ad: string
          created_at: string
          donem: string | null
          durum: string
          id: string
          kapsam: string | null
          risk_seviyesi: string
          sorumlu: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          donem?: string | null
          durum?: string
          id?: string
          kapsam?: string | null
          risk_seviyesi?: string
          sorumlu?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          donem?: string | null
          durum?: string
          id?: string
          kapsam?: string | null
          risk_seviyesi?: string
          sorumlu?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_engagements_sorumlu_fkey"
            columns: ["sorumlu"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_engagements_tenant_id_fkey"
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
      audit_pbc_requests: {
        Row: {
          alan: string | null
          alinan_kanit: string | null
          alindi_tarihi: string | null
          created_at: string
          durum: string
          engagement_id: string
          id: string
          son_tarih: string | null
          talep_metni: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alan?: string | null
          alinan_kanit?: string | null
          alindi_tarihi?: string | null
          created_at?: string
          durum?: string
          engagement_id: string
          id?: string
          son_tarih?: string | null
          talep_metni: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alan?: string | null
          alinan_kanit?: string | null
          alindi_tarihi?: string | null
          created_at?: string
          durum?: string
          engagement_id?: string
          id?: string
          son_tarih?: string | null
          talep_metni?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_pbc_requests_alan_fkey"
            columns: ["alan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_pbc_requests_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_pbc_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_review_notes: {
        Row: {
          cozuldu: boolean
          created_at: string
          id: string
          not_metni: string
          tenant_id: string
          workpaper_id: string
        }
        Insert: {
          cozuldu?: boolean
          created_at?: string
          id?: string
          not_metni: string
          tenant_id: string
          workpaper_id: string
        }
        Update: {
          cozuldu?: boolean
          created_at?: string
          id?: string
          not_metni?: string
          tenant_id?: string
          workpaper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_review_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_review_notes_workpaper_id_fkey"
            columns: ["workpaper_id"]
            isOneToOne: false
            referencedRelation: "audit_workpapers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_samples: {
        Row: {
          created_at: string
          engagement_id: string
          id: string
          ornek_boyutu: number
          populasyon_boyutu: number
          secilen_indeksler: number[]
          seed: string
          tenant_id: string
          yontem: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          id?: string
          ornek_boyutu: number
          populasyon_boyutu: number
          secilen_indeksler?: number[]
          seed: string
          tenant_id: string
          yontem?: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          id?: string
          ornek_boyutu?: number
          populasyon_boyutu?: number
          secilen_indeksler?: number[]
          seed?: string
          tenant_id?: string
          yontem?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_samples_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_samples_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_workpaper_controls: {
        Row: {
          control_id: string
          created_at: string
          gerekce: string | null
          id: string
          tenant_id: string
          workpaper_id: string
        }
        Insert: {
          control_id: string
          created_at?: string
          gerekce?: string | null
          id?: string
          tenant_id: string
          workpaper_id: string
        }
        Update: {
          control_id?: string
          created_at?: string
          gerekce?: string | null
          id?: string
          tenant_id?: string
          workpaper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_workpaper_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpaper_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpaper_controls_workpaper_id_fkey"
            columns: ["workpaper_id"]
            isOneToOne: false
            referencedRelation: "audit_workpapers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_workpaper_findings: {
        Row: {
          created_at: string
          finding_id: string
          id: string
          tenant_id: string
          workpaper_id: string
        }
        Insert: {
          created_at?: string
          finding_id: string
          id?: string
          tenant_id: string
          workpaper_id: string
        }
        Update: {
          created_at?: string
          finding_id?: string
          id?: string
          tenant_id?: string
          workpaper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_workpaper_findings_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpaper_findings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpaper_findings_workpaper_id_fkey"
            columns: ["workpaper_id"]
            isOneToOne: false
            referencedRelation: "audit_workpapers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_workpapers: {
        Row: {
          baslik: string
          created_at: string
          durum: string
          engagement_id: string
          hazirlama_zamani: string | null
          hazirlayan: string | null
          icerik: string
          id: string
          review_zamani: string | null
          reviewer: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          baslik: string
          created_at?: string
          durum?: string
          engagement_id: string
          hazirlama_zamani?: string | null
          hazirlayan?: string | null
          icerik?: string
          id?: string
          review_zamani?: string | null
          reviewer?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          baslik?: string
          created_at?: string
          durum?: string
          engagement_id?: string
          hazirlama_zamani?: string | null
          hazirlayan?: string | null
          icerik?: string
          id?: string
          review_zamani?: string | null
          reviewer?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_workpapers_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpapers_hazirlayan_fkey"
            columns: ["hazirlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpapers_reviewer_fkey"
            columns: ["reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpapers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_worm_exports: {
        Row: {
          created_at: string
          engagement_id: string
          id: string
          olusturan: string | null
          paket: Json
          paket_hash: string
          seq: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          id?: string
          olusturan?: string | null
          paket: Json
          paket_hash: string
          seq?: never
          tenant_id: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          id?: string
          olusturan?: string | null
          paket?: Json
          paket_hash?: string
          seq?: never
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_worm_exports_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_worm_exports_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_worm_exports_tenant_id_fkey"
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
      control_pack_versions: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          surum: number
          yayin_durumu: string
          yayinlandi_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          surum: number
          yayin_durumu?: string
          yayinlandi_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          surum?: number
          yayin_durumu?: string
          yayinlandi_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_pack_versions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "control_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      control_packs: {
        Row: {
          aciklama: string | null
          ad: string
          audience: string
          created_at: string
          id: string
          kod: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          audience: string
          created_at?: string
          id?: string
          kod: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          audience?: string
          created_at?: string
          id?: string
          kod?: string
        }
        Relationships: []
      }
      control_resilience_domains: {
        Row: {
          control_id: string
          created_at: string
          dogrulama_durumu: string
          dogrulama_zamani: string | null
          dogrulayan: string | null
          eklenme_kaynagi: string
          gerekce: string | null
          id: string
          incelemeye_alan: string | null
          incelemeye_alinma_zamani: string | null
          kategori: string
          updated_at: string
        }
        Insert: {
          control_id: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          gerekce?: string | null
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kategori: string
          updated_at?: string
        }
        Update: {
          control_id?: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          gerekce?: string | null
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kategori?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_resilience_domains_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_resilience_domains_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_resilience_domains_incelemeye_alan_fkey"
            columns: ["incelemeye_alan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      control_test_definitions: {
        Row: {
          aciklama: string | null
          ad: string
          amac: string | null
          basarisizlik_onem: string
          beklenen: Json | null
          control_id: string
          created_at: string
          grace_gun: number | null
          hedef_varlik: string | null
          id: string
          kapsam: string | null
          kritik_hizmet_adi: string | null
          otomatik_bulgu: boolean
          retest_gerekli: boolean
          senaryo_kimligi: string | null
          senaryo_surumu: number | null
          tanim_surumu: number
          tazelik_gun: number | null
          tenant_id: string
          tur: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          amac?: string | null
          basarisizlik_onem?: string
          beklenen?: Json | null
          control_id: string
          created_at?: string
          grace_gun?: number | null
          hedef_varlik?: string | null
          id?: string
          kapsam?: string | null
          kritik_hizmet_adi?: string | null
          otomatik_bulgu?: boolean
          retest_gerekli?: boolean
          senaryo_kimligi?: string | null
          senaryo_surumu?: number | null
          tanim_surumu?: number
          tazelik_gun?: number | null
          tenant_id: string
          tur: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          amac?: string | null
          basarisizlik_onem?: string
          beklenen?: Json | null
          control_id?: string
          created_at?: string
          grace_gun?: number | null
          hedef_varlik?: string | null
          id?: string
          kapsam?: string | null
          kritik_hizmet_adi?: string | null
          otomatik_bulgu?: boolean
          retest_gerekli?: boolean
          senaryo_kimligi?: string | null
          senaryo_surumu?: number | null
          tanim_surumu?: number
          tazelik_gun?: number | null
          tenant_id?: string
          tur?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_test_definitions_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      control_test_finding_proposals: {
        Row: {
          baslik: string
          control_id: string
          created_at: string
          durum: string
          finding_id: string | null
          gerekce: string
          id: string
          karar_at: string | null
          karar_veren: string | null
          onem: string
          tenant_id: string
          test_definition_id: string
          test_run_id: string
        }
        Insert: {
          baslik: string
          control_id: string
          created_at?: string
          durum?: string
          finding_id?: string | null
          gerekce: string
          id?: string
          karar_at?: string | null
          karar_veren?: string | null
          onem: string
          tenant_id: string
          test_definition_id: string
          test_run_id: string
        }
        Update: {
          baslik?: string
          control_id?: string
          created_at?: string
          durum?: string
          finding_id?: string | null
          gerekce?: string
          id?: string
          karar_at?: string | null
          karar_veren?: string | null
          onem?: string
          tenant_id?: string
          test_definition_id?: string
          test_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_test_finding_proposals_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_finding_proposals_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_finding_proposals_karar_veren_fkey"
            columns: ["karar_veren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_finding_proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_finding_proposals_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_test_finding_proposals_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: true
            referencedRelation: "test_runs"
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
      critical_business_services: {
        Row: {
          aciklama: string | null
          ad: string
          created_at: string
          durum: string
          id: string
          sahip: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          durum?: string
          id?: string
          sahip?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          durum?: string
          id?: string
          sahip?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "critical_business_services_sahip_fkey"
            columns: ["sahip"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critical_business_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      critical_service_controls: {
        Row: {
          control_id: string
          created_at: string
          critical_service_id: string
          gerekce: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          control_id: string
          created_at?: string
          critical_service_id: string
          gerekce?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          control_id?: string
          created_at?: string
          critical_service_id?: string
          gerekce?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "critical_service_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critical_service_controls_critical_service_id_fkey"
            columns: ["critical_service_id"]
            isOneToOne: false
            referencedRelation: "critical_business_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critical_service_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          alindi_at: string
          created_at: string
          durum: string
          id: string
          kimlik_dogrulandi: boolean
          tamamlandi_at: string | null
          tenant_id: string
          tur: string
          updated_at: string
          veri_sahibi_hash: string | null
          veri_sahibi_maskeli: string
          yasal_sure_gun: number
        }
        Insert: {
          alindi_at?: string
          created_at?: string
          durum?: string
          id?: string
          kimlik_dogrulandi?: boolean
          tamamlandi_at?: string | null
          tenant_id: string
          tur: string
          updated_at?: string
          veri_sahibi_hash?: string | null
          veri_sahibi_maskeli: string
          yasal_sure_gun?: number
        }
        Update: {
          alindi_at?: string
          created_at?: string
          durum?: string
          id?: string
          kimlik_dogrulandi?: boolean
          tamamlandi_at?: string | null
          tenant_id?: string
          tur?: string
          updated_at?: string
          veri_sahibi_hash?: string | null
          veri_sahibi_maskeli?: string
          yasal_sure_gun?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dsar_fulfillment_packages: {
        Row: {
          aciklanan_kategoriler: string[]
          dsar_id: string
          id: string
          manifest: Json
          manifest_hash: string
          olusturuldu_at: string
          tenant_id: string
        }
        Insert: {
          aciklanan_kategoriler?: string[]
          dsar_id: string
          id?: string
          manifest: Json
          manifest_hash: string
          olusturuldu_at?: string
          tenant_id: string
        }
        Update: {
          aciklanan_kategoriler?: string[]
          dsar_id?: string
          id?: string
          manifest?: Json
          manifest_hash?: string
          olusturuldu_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsar_fulfillment_packages_dsar_id_fkey"
            columns: ["dsar_id"]
            isOneToOne: true
            referencedRelation: "data_subject_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsar_fulfillment_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          redaksiyon_kaynak_envelope_hash: string | null
          redaksiyon_kaynak_file_hash: string | null
          redaksiyon_kaynak_id: string | null
          redaksiyon_notu: string | null
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
          redaksiyon_kaynak_envelope_hash?: string | null
          redaksiyon_kaynak_file_hash?: string | null
          redaksiyon_kaynak_id?: string | null
          redaksiyon_notu?: string | null
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
          redaksiyon_kaynak_envelope_hash?: string | null
          redaksiyon_kaynak_file_hash?: string | null
          redaksiyon_kaynak_id?: string | null
          redaksiyon_notu?: string | null
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
            foreignKeyName: "evidences_redaksiyon_kaynak_id_fkey"
            columns: ["redaksiyon_kaynak_id"]
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
      execution_legal_snapshots: {
        Row: {
          control_id: string
          created_at: string
          id: string
          karar: string
          snapshot: Json
          tenant_id: string
          test_definition_id: string
          test_run_id: string | null
        }
        Insert: {
          control_id: string
          created_at?: string
          id?: string
          karar: string
          snapshot: Json
          tenant_id: string
          test_definition_id: string
          test_run_id?: string | null
        }
        Update: {
          control_id?: string
          created_at?: string
          id?: string
          karar?: string
          snapshot?: Json
          tenant_id?: string
          test_definition_id?: string
          test_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_legal_snapshots_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_legal_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_legal_snapshots_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_legal_snapshots_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_plans: {
        Row: {
          created_at: string
          id: string
          ozet: string
          tenant_id: string
          test_edildi: boolean
          test_kaniti: string | null
          test_tarihi: string | null
          third_party_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ozet: string
          tenant_id: string
          test_edildi?: boolean
          test_kaniti?: string | null
          test_tarihi?: string | null
          third_party_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ozet?: string
          tenant_id?: string
          test_edildi?: boolean
          test_kaniti?: string | null
          test_tarihi?: string | null
          third_party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exit_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_plans_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
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
          kapatan: string | null
          kapatma_onay_at: string | null
          kapatma_retest_run_id: string | null
          kaynak: string
          kaynak_test_definition_id: string | null
          onem: string
          retest_gerekli: boolean
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
          kapatan?: string | null
          kapatma_onay_at?: string | null
          kapatma_retest_run_id?: string | null
          kaynak: string
          kaynak_test_definition_id?: string | null
          onem: string
          retest_gerekli?: boolean
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
          kapatan?: string | null
          kapatma_onay_at?: string | null
          kapatma_retest_run_id?: string | null
          kaynak?: string
          kaynak_test_definition_id?: string | null
          onem?: string
          retest_gerekli?: boolean
          tenant_id?: string
          updated_at?: string
          yk_onay_tarihi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_kapatan_fkey"
            columns: ["kapatan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_kapatma_retest_run_id_fkey"
            columns: ["kapatma_retest_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_kaynak_test_definition_id_fkey"
            columns: ["kaynak_test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fourth_parties: {
        Row: {
          ad: string | null
          bilinmiyor: boolean
          created_at: string
          hizmet_ozeti: string | null
          id: string
          tenant_id: string
          third_party_id: string
          ulke: string | null
        }
        Insert: {
          ad?: string | null
          bilinmiyor?: boolean
          created_at?: string
          hizmet_ozeti?: string | null
          id?: string
          tenant_id: string
          third_party_id: string
          ulke?: string | null
        }
        Update: {
          ad?: string | null
          bilinmiyor?: boolean
          created_at?: string
          hizmet_ozeti?: string | null
          id?: string
          tenant_id?: string
          third_party_id?: string
          ulke?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fourth_parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourth_parties_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
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
      impact_tolerances: {
        Row: {
          created_at: string
          critical_service_id: string
          durum: string
          id: string
          max_kesinti_saat: number | null
          max_mutabakat_farki: string | null
          max_veri_kaybi_saat: number | null
          onay_zamani: string | null
          onaylayan: string | null
          surum: number
          tenant_id: string
          updated_at: string
          yonetim_onayi: boolean
        }
        Insert: {
          created_at?: string
          critical_service_id: string
          durum?: string
          id?: string
          max_kesinti_saat?: number | null
          max_mutabakat_farki?: string | null
          max_veri_kaybi_saat?: number | null
          onay_zamani?: string | null
          onaylayan?: string | null
          surum: number
          tenant_id: string
          updated_at?: string
          yonetim_onayi?: boolean
        }
        Update: {
          created_at?: string
          critical_service_id?: string
          durum?: string
          id?: string
          max_kesinti_saat?: number | null
          max_mutabakat_farki?: string | null
          max_veri_kaybi_saat?: number | null
          onay_zamani?: string | null
          onaylayan?: string | null
          surum?: number
          tenant_id?: string
          updated_at?: string
          yonetim_onayi?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "impact_tolerances_critical_service_id_fkey"
            columns: ["critical_service_id"]
            isOneToOne: false
            referencedRelation: "critical_business_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_tolerances_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_tolerances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      independence_declarations: {
        Row: {
          beyan_at: string
          beyan_eden_ad: string
          cikar_catismasi_yok: boolean
          created_at: string
          engagement_id: string | null
          external_email: string
          id: string
          matter_id: string | null
          tenant_id: string
        }
        Insert: {
          beyan_at?: string
          beyan_eden_ad: string
          cikar_catismasi_yok: boolean
          created_at?: string
          engagement_id?: string | null
          external_email: string
          id?: string
          matter_id?: string | null
          tenant_id: string
        }
        Update: {
          beyan_at?: string
          beyan_eden_ad?: string
          cikar_catismasi_yok?: boolean
          created_at?: string
          engagement_id?: string | null
          external_email?: string
          id?: string
          matter_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "independence_declarations_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independence_declarations_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "regulatory_matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independence_declarations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_42001_27001_crosswalk: {
        Row: {
          created_at: string
          dogrulama_durumu: string
          dogrulama_zamani: string | null
          dogrulayan: string | null
          gerekce: string | null
          id: string
          iliski_turu: string
          incelemeye_alan: string | null
          incelemeye_alinma_zamani: string | null
          iso27001_ref: string
          iso42001_ref: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          gerekce?: string | null
          id?: string
          iliski_turu?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          iso27001_ref: string
          iso42001_ref: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          gerekce?: string | null
          id?: string
          iliski_turu?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          iso27001_ref?: string
          iso42001_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso_42001_27001_crosswalk_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iso_42001_27001_crosswalk_incelemeye_alan_fkey"
            columns: ["incelemeye_alan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_risk_indicators: {
        Row: {
          ad: string
          created_at: string
          esik: number
          id: string
          kategori: string
          tenant_id: string
          updated_at: string
          yon: string
        }
        Insert: {
          ad: string
          created_at?: string
          esik: number
          id?: string
          kategori?: string
          tenant_id: string
          updated_at?: string
          yon?: string
        }
        Update: {
          ad?: string
          created_at?: string
          esik?: number
          id?: string
          kategori?: string
          tenant_id?: string
          updated_at?: string
          yon?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_risk_indicators_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kri_readings: {
        Row: {
          created_at: string
          deger: number
          id: string
          kri_id: string
          olcum_tarihi: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          deger: number
          id?: string
          kri_id: string
          olcum_tarihi?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          deger?: number
          id?: string
          kri_id?: string
          olcum_tarihi?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kri_readings_kri_id_fkey"
            columns: ["kri_id"]
            isOneToOne: false
            referencedRelation: "key_risk_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kri_readings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_outbox: {
        Row: {
          artifact_id: string
          artifact_table: string
          created_at: string
          deneme_sayisi: number
          durum: string
          id: string
          islenme_at: string | null
          seq: number
          son_hata: string | null
          statement_kind: string
          tenant_id: string
        }
        Insert: {
          artifact_id: string
          artifact_table: string
          created_at?: string
          deneme_sayisi?: number
          durum?: string
          id?: string
          islenme_at?: string | null
          seq?: never
          son_hata?: string | null
          statement_kind: string
          tenant_id: string
        }
        Update: {
          artifact_id?: string
          artifact_table?: string
          created_at?: string
          deneme_sayisi?: number
          durum?: string
          id?: string
          islenme_at?: string | null
          seq?: never
          son_hata?: string | null
          statement_kind?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_access_grants: {
        Row: {
          bagimsizlik_beyani_id: string | null
          created_at: string
          external_email: string
          id: string
          iptal_edildi: boolean
          matter_id: string
          olusturan: string | null
          son_gecerlilik: string
          tenant_id: string
          token: string
        }
        Insert: {
          bagimsizlik_beyani_id?: string | null
          created_at?: string
          external_email: string
          id?: string
          iptal_edildi?: boolean
          matter_id: string
          olusturan?: string | null
          son_gecerlilik: string
          tenant_id: string
          token?: string
        }
        Update: {
          bagimsizlik_beyani_id?: string | null
          created_at?: string
          external_email?: string
          id?: string
          iptal_edildi?: boolean
          matter_id?: string
          olusturan?: string | null
          son_gecerlilik?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_access_grants_bagimsizlik_beyani_id_fkey"
            columns: ["bagimsizlik_beyani_id"]
            isOneToOne: false
            referencedRelation: "independence_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_access_grants_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "regulatory_matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_access_grants_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_access_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_control_mappings: {
        Row: {
          control_id: string
          created_at: string
          dogrulama_durumu: string
          dogrulama_zamani: string | null
          dogrulayan: string | null
          eklenme_kaynagi: string
          gerekce: string | null
          id: string
          incelemeye_alan: string | null
          incelemeye_alinma_zamani: string | null
          kapsam: string
          obligation_id: string
          updated_at: string
        }
        Insert: {
          control_id: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          gerekce?: string | null
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kapsam?: string
          obligation_id: string
          updated_at?: string
        }
        Update: {
          control_id?: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          gerekce?: string | null
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kapsam?: string
          obligation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligation_control_mappings_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_control_mappings_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_control_mappings_incelemeye_alan_fkey"
            columns: ["incelemeye_alan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_control_mappings_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          amac: string
          baslik: string
          created_at: string
          dogrulama_durumu: string
          dogrulama_zamani: string | null
          dogrulayan: string | null
          eklenme_kaynagi: string
          id: string
          incelemeye_alan: string | null
          incelemeye_alinma_zamani: string | null
          kanit_gereksinimi: string | null
          kod: string
          nitelik: string
          provision_id: string
          siklik: string | null
          son_tarih_kurali: string | null
          updated_at: string
        }
        Insert: {
          amac: string
          baslik: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kanit_gereksinimi?: string | null
          kod: string
          nitelik?: string
          provision_id: string
          siklik?: string | null
          son_tarih_kurali?: string | null
          updated_at?: string
        }
        Update: {
          amac?: string
          baslik?: string
          created_at?: string
          dogrulama_durumu?: string
          dogrulama_zamani?: string | null
          dogrulayan?: string | null
          eklenme_kaynagi?: string
          id?: string
          incelemeye_alan?: string | null
          incelemeye_alinma_zamani?: string | null
          kanit_gereksinimi?: string | null
          kod?: string
          nitelik?: string
          provision_id?: string
          siklik?: string | null
          son_tarih_kurali?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_incelemeye_alan_fkey"
            columns: ["incelemeye_alan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          bank_portal_count_band: string | null
          created_at: string
          critical_supplier_status: boolean
          employee_band: string | null
          erp_systems: string[]
          finance_department_enabled: boolean
          finance_function_types: string[]
          jurisdictions: string[]
          legal_entity_count: number | null
          operating_sectors: string[]
          organization_type: string
          payment_volume_band: string | null
          payroll_in_scope: boolean
          profil_tamamlandi_at: string | null
          regulated_status: string | null
          regulator_types: string[]
          supplier_master_in_scope: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bank_portal_count_band?: string | null
          created_at?: string
          critical_supplier_status?: boolean
          employee_band?: string | null
          erp_systems?: string[]
          finance_department_enabled?: boolean
          finance_function_types?: string[]
          jurisdictions?: string[]
          legal_entity_count?: number | null
          operating_sectors?: string[]
          organization_type?: string
          payment_volume_band?: string | null
          payroll_in_scope?: boolean
          profil_tamamlandi_at?: string | null
          regulated_status?: string | null
          regulator_types?: string[]
          supplier_master_in_scope?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bank_portal_count_band?: string | null
          created_at?: string
          critical_supplier_status?: boolean
          employee_band?: string | null
          erp_systems?: string[]
          finance_department_enabled?: boolean
          finance_function_types?: string[]
          jurisdictions?: string[]
          legal_entity_count?: number | null
          operating_sectors?: string[]
          organization_type?: string
          payment_volume_band?: string | null
          payroll_in_scope?: boolean
          profil_tamamlandi_at?: string | null
          regulated_status?: string | null
          regulator_types?: string[]
          supplier_master_in_scope?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_controls: {
        Row: {
          basis: string
          control_id: string
          created_at: string
          id: string
          kaynak_referansi: string | null
          pack_version_id: string
        }
        Insert: {
          basis: string
          control_id: string
          created_at?: string
          id?: string
          kaynak_referansi?: string | null
          pack_version_id: string
        }
        Update: {
          basis?: string
          control_id?: string
          created_at?: string
          id?: string
          kaynak_referansi?: string | null
          pack_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_controls_pack_version_id_fkey"
            columns: ["pack_version_id"]
            isOneToOne: false
            referencedRelation: "control_pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          surum: number
          yayin_durumu: string
          yetkiler: Json
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          surum: number
          yayin_durumu?: string
          yetkiler: Json
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          surum?: number
          yayin_durumu?: string
          yetkiler?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "product_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_approvals: {
        Row: {
          approver: string
          created_at: string
          gerekce: string | null
          id: string
          karar: string
          policy_version_id: string
          tenant_id: string
        }
        Insert: {
          approver: string
          created_at?: string
          gerekce?: string | null
          id?: string
          karar: string
          policy_version_id: string
          tenant_id: string
        }
        Update: {
          approver?: string
          created_at?: string
          gerekce?: string | null
          id?: string
          karar?: string
          policy_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_approvals_approver_fkey"
            columns: ["approver"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_approvals_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_attestations: {
        Row: {
          attested_at: string
          attesting_user: string
          id: string
          policy_version_id: string
          tenant_id: string
        }
        Insert: {
          attested_at?: string
          attesting_user: string
          id?: string
          policy_version_id: string
          tenant_id: string
        }
        Update: {
          attested_at?: string
          attesting_user?: string
          id?: string
          policy_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_attestations_attesting_user_fkey"
            columns: ["attesting_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_attestations_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_attestations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_clause_links: {
        Row: {
          control_id: string | null
          created_at: string
          id: string
          obligation_id: string | null
          policy_clause_id: string
          provision_id: string | null
          tenant_id: string
        }
        Insert: {
          control_id?: string | null
          created_at?: string
          id?: string
          obligation_id?: string | null
          policy_clause_id: string
          provision_id?: string | null
          tenant_id: string
        }
        Update: {
          control_id?: string | null
          created_at?: string
          id?: string
          obligation_id?: string | null
          policy_clause_id?: string
          provision_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_clause_links_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_clause_links_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_clause_links_policy_clause_id_fkey"
            columns: ["policy_clause_id"]
            isOneToOne: false
            referencedRelation: "policy_clauses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_clause_links_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_clause_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_clauses: {
        Row: {
          created_at: string
          id: string
          madde_ref: string
          metin: string
          policy_version_id: string
          sira: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          madde_ref: string
          metin: string
          policy_version_id: string
          sira?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          madde_ref?: string
          metin?: string
          policy_version_id?: string
          sira?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_clauses_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_clauses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_documents: {
        Row: {
          baslik: string
          created_at: string
          id: string
          kategori: string
          kod: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          baslik: string
          created_at?: string
          id?: string
          kategori?: string
          kod: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          baslik?: string
          created_at?: string
          id?: string
          kategori?: string
          kod?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_exceptions: {
        Row: {
          baslangic: string
          bitis: string
          created_at: string
          durum: string
          gerekce: string
          id: string
          onay_zamani: string | null
          onaylayan: string | null
          policy_version_id: string
          sahip: string
          telafi_test_definition_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          baslangic?: string
          bitis: string
          created_at?: string
          durum?: string
          gerekce: string
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          policy_version_id: string
          sahip: string
          telafi_test_definition_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          baslangic?: string
          bitis?: string
          created_at?: string
          durum?: string
          gerekce?: string
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          policy_version_id?: string
          sahip?: string
          telafi_test_definition_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_exceptions_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_sahip_fkey"
            columns: ["sahip"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_telafi_test_definition_id_fkey"
            columns: ["telafi_test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_impacts: {
        Row: {
          created_at: string
          durum: string
          etki_ozeti: string | null
          id: string
          oneren_kaynak: string
          policy_clause_id: string
          provision_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          etki_ozeti?: string | null
          id?: string
          oneren_kaynak?: string
          policy_clause_id: string
          provision_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          etki_ozeti?: string | null
          id?: string
          oneren_kaynak?: string
          policy_clause_id?: string
          provision_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_impacts_policy_clause_id_fkey"
            columns: ["policy_clause_id"]
            isOneToOne: false
            referencedRelation: "policy_clauses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_impacts_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_impacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          created_at: string
          durum: string
          effective_from: string | null
          eklenme_kaynagi: string
          gerekli_onay_sayisi: number
          hazirlama_zamani: string | null
          hazirlayan: string | null
          id: string
          policy_document_id: string
          redline_notu: string | null
          surum: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          effective_from?: string | null
          eklenme_kaynagi?: string
          gerekli_onay_sayisi?: number
          hazirlama_zamani?: string | null
          hazirlayan?: string | null
          id?: string
          policy_document_id: string
          redline_notu?: string | null
          surum: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          effective_from?: string | null
          eklenme_kaynagi?: string
          gerekli_onay_sayisi?: number
          hazirlama_zamani?: string | null
          hazirlayan?: string | null
          id?: string
          policy_document_id?: string
          redline_notu?: string | null
          surum?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_hazirlayan_fkey"
            columns: ["hazirlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_versions_policy_document_id_fkey"
            columns: ["policy_document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_assessments: {
        Row: {
          created_at: string
          durum: string
          hazirlayan: string | null
          id: string
          onay_zamani: string | null
          onaylayan: string | null
          processing_activity_id: string
          sonuc: string | null
          tenant_id: string
          tur: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          hazirlayan?: string | null
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          processing_activity_id: string
          sonuc?: string | null
          tenant_id: string
          tur: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          hazirlayan?: string | null
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          processing_activity_id?: string
          sonuc?: string | null
          tenant_id?: string
          tur?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_assessments_hazirlayan_fkey"
            columns: ["hazirlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_assessments_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_assessments_processing_activity_id_fkey"
            columns: ["processing_activity_id"]
            isOneToOne: false
            referencedRelation: "processing_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_incidents: {
        Row: {
          created_at: string
          durum: string
          id: string
          otorite_bildirildi_at: string | null
          otorite_bildirim_gerekli: boolean
          ozet: string
          siniflandirma: string
          tenant_id: string
          tespit_at: string
          updated_at: string
          veri_sahibi_bildirildi_at: string | null
          veri_sahibi_bildirim_gerekli: boolean
        }
        Insert: {
          created_at?: string
          durum?: string
          id?: string
          otorite_bildirildi_at?: string | null
          otorite_bildirim_gerekli?: boolean
          ozet: string
          siniflandirma?: string
          tenant_id: string
          tespit_at: string
          updated_at?: string
          veri_sahibi_bildirildi_at?: string | null
          veri_sahibi_bildirim_gerekli?: boolean
        }
        Update: {
          created_at?: string
          durum?: string
          id?: string
          otorite_bildirildi_at?: string | null
          otorite_bildirim_gerekli?: boolean
          ozet?: string
          siniflandirma?: string
          tenant_id?: string
          tespit_at?: string
          updated_at?: string
          veri_sahibi_bildirildi_at?: string | null
          veri_sahibi_bildirim_gerekli?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "privacy_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_activities: {
        Row: {
          ad: string
          alicilar: string[]
          amac: string
          created_at: string
          dayanak_provision_id: string | null
          durum: string
          hukuki_dayanak: string
          id: string
          saklama_dayanagi: string | null
          saklama_suresi: string | null
          sinir_otesi_transfer: boolean
          tenant_id: string
          transfer_ulkeleri: string[]
          updated_at: string
          veri_kategorileri: string[]
          veri_sahibi_kategorileri: string[]
        }
        Insert: {
          ad: string
          alicilar?: string[]
          amac: string
          created_at?: string
          dayanak_provision_id?: string | null
          durum?: string
          hukuki_dayanak: string
          id?: string
          saklama_dayanagi?: string | null
          saklama_suresi?: string | null
          sinir_otesi_transfer?: boolean
          tenant_id: string
          transfer_ulkeleri?: string[]
          updated_at?: string
          veri_kategorileri?: string[]
          veri_sahibi_kategorileri?: string[]
        }
        Update: {
          ad?: string
          alicilar?: string[]
          amac?: string
          created_at?: string
          dayanak_provision_id?: string | null
          durum?: string
          hukuki_dayanak?: string
          id?: string
          saklama_dayanagi?: string | null
          saklama_suresi?: string | null
          sinir_otesi_transfer?: boolean
          tenant_id?: string
          transfer_ulkeleri?: string[]
          updated_at?: string
          veri_kategorileri?: string[]
          veri_sahibi_kategorileri?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "processing_activities_dayanak_provision_id_fkey"
            columns: ["dayanak_provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_plans: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          id: string
          kod: string
          urun_hatti: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod: string
          urun_hatti: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod?: string
          urun_hatti?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          tema_tercihi: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role: string
          tema_tercihi?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          tema_tercihi?: string
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
      proof_room_links: {
        Row: {
          created_at: string
          id: string
          iptal_edildi: boolean
          olusturan: string | null
          son_gecerlilik: string
          tenant_id: string
          test_run_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          iptal_edildi?: boolean
          olusturan?: string | null
          son_gecerlilik: string
          tenant_id: string
          test_run_id: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          iptal_edildi?: boolean
          olusturan?: string | null
          son_gecerlilik?: string
          tenant_id?: string
          test_run_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_room_links_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_room_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_room_links_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      provisions: {
        Row: {
          baslik: string | null
          created_at: string
          dogrulama_durumu: string
          effective_from: string
          effective_to: string | null
          eklenme_kaynagi: string
          id: string
          metin: string
          provision_ref: string
          source_artifact_id: string
          system_from: string
          system_to: string | null
        }
        Insert: {
          baslik?: string | null
          created_at?: string
          dogrulama_durumu?: string
          effective_from: string
          effective_to?: string | null
          eklenme_kaynagi?: string
          id?: string
          metin: string
          provision_ref: string
          source_artifact_id: string
          system_from?: string
          system_to?: string | null
        }
        Update: {
          baslik?: string | null
          created_at?: string
          dogrulama_durumu?: string
          effective_from?: string
          effective_to?: string | null
          eklenme_kaynagi?: string
          id?: string
          metin?: string
          provision_ref?: string
          source_artifact_id?: string
          system_from?: string
          system_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provisions_source_artifact_id_fkey"
            columns: ["source_artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_matters: {
        Row: {
          acilis_tarihi: string
          created_at: string
          durum: string
          id: string
          konu: string
          otorite: string
          tenant_id: string
          tur: string
          updated_at: string
        }
        Insert: {
          acilis_tarihi?: string
          created_at?: string
          durum?: string
          id?: string
          konu: string
          otorite: string
          tenant_id: string
          tur?: string
          updated_at?: string
        }
        Update: {
          acilis_tarihi?: string
          created_at?: string
          durum?: string
          id?: string
          konu?: string
          otorite?: string
          tenant_id?: string
          tur?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_matters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_meetings: {
        Row: {
          created_at: string
          id: string
          katilimcilar: string[]
          kayit_eden: string | null
          konu: string
          matter_id: string
          notlar: string | null
          tarih: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          katilimcilar?: string[]
          kayit_eden?: string | null
          konu: string
          matter_id: string
          notlar?: string | null
          tarih?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          katilimcilar?: string[]
          kayit_eden?: string | null
          konu?: string
          matter_id?: string
          notlar?: string | null
          tarih?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_meetings_kayit_eden_fkey"
            columns: ["kayit_eden"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_meetings_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "regulatory_matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_requests: {
        Row: {
          created_at: string
          durum: string
          id: string
          matter_id: string
          son_tarih: string | null
          talep_metni: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          id?: string
          matter_id: string
          son_tarih?: string | null
          talep_metni: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          id?: string
          matter_id?: string
          son_tarih?: string | null
          talep_metni?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_requests_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "regulatory_matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_responses: {
        Row: {
          created_at: string
          durum: string
          gonderildi_at: string | null
          gonderim_receipt: string | null
          hazirlayan: string | null
          icerik: string
          id: string
          onay_zamani: string | null
          onaylayan: string | null
          request_id: string
          surum: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          gonderildi_at?: string | null
          gonderim_receipt?: string | null
          hazirlayan?: string | null
          icerik: string
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          request_id: string
          surum: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          gonderildi_at?: string | null
          gonderim_receipt?: string | null
          hazirlayan?: string | null
          icerik?: string
          id?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          request_id?: string
          surum?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_responses_hazirlayan_fkey"
            columns: ["hazirlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_responses_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "regulatory_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_sources: {
        Row: {
          ad: string
          aktif: boolean
          authority: string
          canonical_url: string | null
          created_at: string
          erisim_politikasi_durumu: string
          id: string
          jurisdiction: string
          kaynak_seviyesi: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          authority: string
          canonical_url?: string | null
          created_at?: string
          erisim_politikasi_durumu?: string
          id?: string
          jurisdiction: string
          kaynak_seviyesi: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          authority?: string
          canonical_url?: string | null
          created_at?: string
          erisim_politikasi_durumu?: string
          id?: string
          jurisdiction?: string
          kaynak_seviyesi?: string
        }
        Relationships: []
      }
      risk_appetites: {
        Row: {
          aciklama: string | null
          birim: string | null
          created_at: string
          durum: string
          esik: number
          id: string
          kategori: string
          onay_zamani: string | null
          onaylayan: string | null
          tenant_id: string
          updated_at: string
          yon: string
          yonetim_onayi: boolean
        }
        Insert: {
          aciklama?: string | null
          birim?: string | null
          created_at?: string
          durum?: string
          esik: number
          id?: string
          kategori: string
          onay_zamani?: string | null
          onaylayan?: string | null
          tenant_id: string
          updated_at?: string
          yon?: string
          yonetim_onayi?: boolean
        }
        Update: {
          aciklama?: string | null
          birim?: string | null
          created_at?: string
          durum?: string
          esik?: number
          id?: string
          kategori?: string
          onay_zamani?: string | null
          onaylayan?: string | null
          tenant_id?: string
          updated_at?: string
          yon?: string
          yonetim_onayi?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "risk_appetites_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_appetites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scenarios: {
        Row: {
          ad: string
          created_at: string
          id: string
          kategori: string
          kayip_max: number
          kayip_min: number
          kayip_olasi: number
          kontrol_maliyeti: number | null
          risk_azaltma: number | null
          tenant_id: string
          updated_at: string
          varsayimlar: string
          yillik_siklik: number | null
        }
        Insert: {
          ad: string
          created_at?: string
          id?: string
          kategori?: string
          kayip_max: number
          kayip_min: number
          kayip_olasi: number
          kontrol_maliyeti?: number | null
          risk_azaltma?: number | null
          tenant_id: string
          updated_at?: string
          varsayimlar: string
          yillik_siklik?: number | null
        }
        Update: {
          ad?: string
          created_at?: string
          id?: string
          kategori?: string
          kayip_max?: number
          kayip_min?: number
          kayip_olasi?: number
          kontrol_maliyeti?: number | null
          risk_azaltma?: number | null
          tenant_id?: string
          updated_at?: string
          varsayimlar?: string
          yillik_siklik?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_scenarios_tenant_id_fkey"
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
          egitim_konusu: string | null
          icerik_durumu: string
          id: string
          kod: string
          tehdit_kategorisi: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          egitim_konusu?: string | null
          icerik_durumu?: string
          id?: string
          kod: string
          tehdit_kategorisi: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          egitim_konusu?: string | null
          icerik_durumu?: string
          id?: string
          kod?: string
          tehdit_kategorisi?: string
        }
        Relationships: []
      }
      service_dependencies: {
        Row: {
          ad: string
          bagimlilik_turu: string
          created_at: string
          critical_service_id: string
          id: string
          tekil_nokta: boolean
          tenant_id: string
          third_party_id: string | null
        }
        Insert: {
          ad: string
          bagimlilik_turu?: string
          created_at?: string
          critical_service_id: string
          id?: string
          tekil_nokta?: boolean
          tenant_id: string
          third_party_id?: string | null
        }
        Update: {
          ad?: string
          bagimlilik_turu?: string
          created_at?: string
          critical_service_id?: string
          id?: string
          tekil_nokta?: boolean
          tenant_id?: string
          third_party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_dependencies_critical_service_id_fkey"
            columns: ["critical_service_id"]
            isOneToOne: false
            referencedRelation: "critical_business_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
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
      sod_atamalari: {
        Row: {
          aktivite_kodu: string
          created_at: string
          display_name: string | null
          email: string | null
          gecerlilik_baslangic: string
          gecerlilik_bitis: string | null
          harici_kullanici_id: string | null
          id: string
          kaynak_sistem: string
          kullanici_id: string | null
          rol_kodu: string | null
          sistem_kapsami: string
          son_senkron_at: string | null
          source_record_id: string | null
          subject_type: string | null
          tenant_id: string
        }
        Insert: {
          aktivite_kodu: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          gecerlilik_baslangic?: string
          gecerlilik_bitis?: string | null
          harici_kullanici_id?: string | null
          id?: string
          kaynak_sistem?: string
          kullanici_id?: string | null
          rol_kodu?: string | null
          sistem_kapsami?: string
          son_senkron_at?: string | null
          source_record_id?: string | null
          subject_type?: string | null
          tenant_id: string
        }
        Update: {
          aktivite_kodu?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          gecerlilik_baslangic?: string
          gecerlilik_bitis?: string | null
          harici_kullanici_id?: string | null
          id?: string
          kaynak_sistem?: string
          kullanici_id?: string | null
          rol_kodu?: string | null
          sistem_kapsami?: string
          son_senkron_at?: string | null
          source_record_id?: string | null
          subject_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_atamalari_kullanici_id_fkey"
            columns: ["kullanici_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_atamalari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_catismalari: {
        Row: {
          created_at: string
          degerlendirme_calistirma_id: string | null
          durum: string
          fingerprint: string
          harici_kullanici_id: string | null
          id: string
          ilk_gorulme_at: string
          kullanici_id: string | null
          onem: string
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          seq: number
          sistem_kapsami: string
          son_gorulme_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          degerlendirme_calistirma_id?: string | null
          durum?: string
          fingerprint: string
          harici_kullanici_id?: string | null
          id?: string
          ilk_gorulme_at?: string
          kullanici_id?: string | null
          onem: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          seq?: never
          sistem_kapsami: string
          son_gorulme_at?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          degerlendirme_calistirma_id?: string | null
          durum?: string
          fingerprint?: string
          harici_kullanici_id?: string | null
          id?: string
          ilk_gorulme_at?: string
          kullanici_id?: string | null
          onem?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          seq?: never
          sistem_kapsami?: string
          son_gorulme_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_catismalari_degerlendirme_calistirma_id_fkey"
            columns: ["degerlendirme_calistirma_id"]
            isOneToOne: false
            referencedRelation: "sod_degerlendirme_calistirmalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_catismalari_kullanici_id_fkey"
            columns: ["kullanici_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_catismalari_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_catismalari_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "sod_kurallari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_catismalari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_degerlendirme_calistirmalari: {
        Row: {
          atama_snapshot_hash: string | null
          baslama_at: string
          bitis_at: string | null
          bulunan_sayisi: number | null
          calistiran: string | null
          cozulen_sayisi: number | null
          hata: string | null
          id: string
          kural_seti_hash: string | null
          tenant_id: string
          yeni_sayisi: number | null
        }
        Insert: {
          atama_snapshot_hash?: string | null
          baslama_at?: string
          bitis_at?: string | null
          bulunan_sayisi?: number | null
          calistiran?: string | null
          cozulen_sayisi?: number | null
          hata?: string | null
          id?: string
          kural_seti_hash?: string | null
          tenant_id: string
          yeni_sayisi?: number | null
        }
        Update: {
          atama_snapshot_hash?: string | null
          baslama_at?: string
          bitis_at?: string | null
          bulunan_sayisi?: number | null
          calistiran?: string | null
          cozulen_sayisi?: number | null
          hata?: string | null
          id?: string
          kural_seti_hash?: string | null
          tenant_id?: string
          yeni_sayisi?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sod_degerlendirme_calistirmalari_calistiran_fkey"
            columns: ["calistiran"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_degerlendirme_calistirmalari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_import_manifestleri: {
        Row: {
          assignment_snapshot_hash: string
          created_at: string
          eklenen_sayisi: number
          file_hash: string
          guncellenen_sayisi: number
          id: string
          kaynak: string
          manifest_hash: string
          mode: string
          normalized_records_hash: string
          onizleme_id: string
          rule_set_version: string
          sona_erdirilen_sayisi: number
          tenant_id: string
          ters_degisiklik: Json | null
          uygulayan: string | null
        }
        Insert: {
          assignment_snapshot_hash: string
          created_at?: string
          eklenen_sayisi: number
          file_hash: string
          guncellenen_sayisi: number
          id?: string
          kaynak: string
          manifest_hash: string
          mode: string
          normalized_records_hash: string
          onizleme_id: string
          rule_set_version: string
          sona_erdirilen_sayisi: number
          tenant_id: string
          ters_degisiklik?: Json | null
          uygulayan?: string | null
        }
        Update: {
          assignment_snapshot_hash?: string
          created_at?: string
          eklenen_sayisi?: number
          file_hash?: string
          guncellenen_sayisi?: number
          id?: string
          kaynak?: string
          manifest_hash?: string
          mode?: string
          normalized_records_hash?: string
          onizleme_id?: string
          rule_set_version?: string
          sona_erdirilen_sayisi?: number
          tenant_id?: string
          ters_degisiklik?: Json | null
          uygulayan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sod_import_manifestleri_onizleme_id_fkey"
            columns: ["onizleme_id"]
            isOneToOne: true
            referencedRelation: "sod_import_onizlemeleri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_manifestleri_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_manifestleri_uygulayan_fkey"
            columns: ["uygulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_import_onizlemeleri: {
        Row: {
          assignment_snapshot_hash: string
          beklenen_catismalar: Json
          created_at: string
          diff: Json
          duplicateler: Json
          durum: string
          file_hash: string
          id: string
          kaynak: string
          mode: string
          normalized_records: Json
          normalized_records_hash: string
          rule_set_version: string
          satir_hatalari: Json
          tenant_id: string
          yukleyen: string | null
        }
        Insert: {
          assignment_snapshot_hash: string
          beklenen_catismalar?: Json
          created_at?: string
          diff: Json
          duplicateler?: Json
          durum?: string
          file_hash: string
          id?: string
          kaynak: string
          mode: string
          normalized_records: Json
          normalized_records_hash: string
          rule_set_version: string
          satir_hatalari?: Json
          tenant_id: string
          yukleyen?: string | null
        }
        Update: {
          assignment_snapshot_hash?: string
          beklenen_catismalar?: Json
          created_at?: string
          diff?: Json
          duplicateler?: Json
          durum?: string
          file_hash?: string
          id?: string
          kaynak?: string
          mode?: string
          normalized_records?: Json
          normalized_records_hash?: string
          rule_set_version?: string
          satir_hatalari?: Json
          tenant_id?: string
          yukleyen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sod_import_onizlemeleri_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_onizlemeleri_yukleyen_fkey"
            columns: ["yukleyen"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_import_rollbacklari: {
        Row: {
          created_at: string
          durum: string
          gerekce: string
          id: string
          karar_notu: string | null
          manifest_id: string
          onaylayan: string | null
          talep_eden: string
          tenant_id: string
          uygulandi_at: string | null
        }
        Insert: {
          created_at?: string
          durum?: string
          gerekce: string
          id?: string
          karar_notu?: string | null
          manifest_id: string
          onaylayan?: string | null
          talep_eden: string
          tenant_id: string
          uygulandi_at?: string | null
        }
        Update: {
          created_at?: string
          durum?: string
          gerekce?: string
          id?: string
          karar_notu?: string | null
          manifest_id?: string
          onaylayan?: string | null
          talep_eden?: string
          tenant_id?: string
          uygulandi_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sod_import_rollbacklari_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "sod_import_manifestleri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_rollbacklari_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_rollbacklari_talep_eden_fkey"
            columns: ["talep_eden"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_import_rollbacklari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_istisnalari: {
        Row: {
          baslangic: string
          bitis: string
          conflict_id: string
          created_at: string
          durum: string
          gerekce: string
          id: string
          iptal_at: string | null
          iptal_eden: string | null
          iptal_nedeni: string | null
          karar_notu: string | null
          onaylayan_id: string | null
          onceki_istisna_id: string | null
          risk_degerlendirmesi: string | null
          risk_sahibi_id: string | null
          talep_eden_id: string
          tenant_id: string
        }
        Insert: {
          baslangic?: string
          bitis: string
          conflict_id: string
          created_at?: string
          durum?: string
          gerekce: string
          id?: string
          iptal_at?: string | null
          iptal_eden?: string | null
          iptal_nedeni?: string | null
          karar_notu?: string | null
          onaylayan_id?: string | null
          onceki_istisna_id?: string | null
          risk_degerlendirmesi?: string | null
          risk_sahibi_id?: string | null
          talep_eden_id: string
          tenant_id: string
        }
        Update: {
          baslangic?: string
          bitis?: string
          conflict_id?: string
          created_at?: string
          durum?: string
          gerekce?: string
          id?: string
          iptal_at?: string | null
          iptal_eden?: string | null
          iptal_nedeni?: string | null
          karar_notu?: string | null
          onaylayan_id?: string | null
          onceki_istisna_id?: string | null
          risk_degerlendirmesi?: string | null
          risk_sahibi_id?: string | null
          talep_eden_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_istisnalari_conflict_id_fkey"
            columns: ["conflict_id"]
            isOneToOne: false
            referencedRelation: "sod_catismalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_iptal_eden_fkey"
            columns: ["iptal_eden"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_onaylayan_id_fkey"
            columns: ["onaylayan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_onceki_istisna_id_fkey"
            columns: ["onceki_istisna_id"]
            isOneToOne: false
            referencedRelation: "sod_istisnalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_risk_sahibi_id_fkey"
            columns: ["risk_sahibi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_talep_eden_id_fkey"
            columns: ["talep_eden_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_istisnalari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_kural_taraflari: {
        Row: {
          aktivite_kodu: string
          id: string
          rol_kodu: string | null
          rule_id: string
          sistem_kapsami: string | null
          taraf: string
        }
        Insert: {
          aktivite_kodu: string
          id?: string
          rol_kodu?: string | null
          rule_id: string
          sistem_kapsami?: string | null
          taraf: string
        }
        Update: {
          aktivite_kodu?: string
          id?: string
          rol_kodu?: string | null
          rule_id?: string
          sistem_kapsami?: string | null
          taraf?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_kural_taraflari_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "sod_kurallari"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_kurallari: {
        Row: {
          aciklama: string | null
          ad: string
          created_at: string
          durum: string
          gecerlilik_baslangic: string | null
          gecerlilik_bitis: string | null
          id: string
          kapsam_turu: string
          kaynak_referansi: string | null
          kaynak_turu: string
          kod: string
          mevzuat_durumu: string
          olusturan: string | null
          onaylayan: string | null
          onem: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          durum?: string
          gecerlilik_baslangic?: string | null
          gecerlilik_bitis?: string | null
          id?: string
          kapsam_turu?: string
          kaynak_referansi?: string | null
          kaynak_turu?: string
          kod: string
          mevzuat_durumu?: string
          olusturan?: string | null
          onaylayan?: string | null
          onem?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          durum?: string
          gecerlilik_baslangic?: string | null
          gecerlilik_bitis?: string | null
          id?: string
          kapsam_turu?: string
          kaynak_referansi?: string | null
          kaynak_turu?: string
          kod?: string
          mevzuat_durumu?: string
          olusturan?: string | null
          onaylayan?: string | null
          onem?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_kurallari_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_kurallari_onaylayan_fkey"
            columns: ["onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_kurallari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_outbox: {
        Row: {
          created_at: string
          degerlendirme_calistirma_id: string | null
          deneme_sayisi: number
          durum: string
          event_type: string
          hata: string | null
          id: string
          islenme_at: string | null
          payload: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          degerlendirme_calistirma_id?: string | null
          deneme_sayisi?: number
          durum?: string
          event_type: string
          hata?: string | null
          id?: string
          islenme_at?: string | null
          payload: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          degerlendirme_calistirma_id?: string | null
          deneme_sayisi?: number
          durum?: string
          event_type?: string
          hata?: string | null
          id?: string
          islenme_at?: string | null
          payload?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_outbox_degerlendirme_calistirma_id_fkey"
            columns: ["degerlendirme_calistirma_id"]
            isOneToOne: false
            referencedRelation: "sod_degerlendirme_calistirmalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_telafi_edici_kontroller: {
        Row: {
          aktif: boolean
          conflict_id: string
          control_id: string | null
          created_at: string
          exception_id: string | null
          gereken_siklik_gun: number | null
          id: string
          son_basarili_calisma_at: string | null
          sonraki_calisma_at: string | null
          tenant_id: string
          test_definition_id: string
        }
        Insert: {
          aktif?: boolean
          conflict_id: string
          control_id?: string | null
          created_at?: string
          exception_id?: string | null
          gereken_siklik_gun?: number | null
          id?: string
          son_basarili_calisma_at?: string | null
          sonraki_calisma_at?: string | null
          tenant_id: string
          test_definition_id: string
        }
        Update: {
          aktif?: boolean
          conflict_id?: string
          control_id?: string | null
          created_at?: string
          exception_id?: string | null
          gereken_siklik_gun?: number | null
          id?: string
          son_basarili_calisma_at?: string | null
          sonraki_calisma_at?: string | null
          tenant_id?: string
          test_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sod_telafi_edici_kontroller_conflict_id_fkey"
            columns: ["conflict_id"]
            isOneToOne: false
            referencedRelation: "sod_catismalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_telafi_edici_kontroller_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_telafi_edici_kontroller_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "sod_istisnalari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_telafi_edici_kontroller_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sod_telafi_edici_kontroller_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_artifacts: {
        Row: {
          baslik: string
          created_at: string
          dogrulama_durumu: string
          effective_from: string | null
          effective_to: string | null
          eklenme_kaynagi: string
          external_id: string | null
          fetched_at: string | null
          id: string
          issued_at: string | null
          language: string | null
          media_type: string | null
          parser_version: string | null
          predecessor_id: string | null
          raw_object_path: string | null
          sha256: string
          source_id: string
        }
        Insert: {
          baslik: string
          created_at?: string
          dogrulama_durumu?: string
          effective_from?: string | null
          effective_to?: string | null
          eklenme_kaynagi?: string
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          issued_at?: string | null
          language?: string | null
          media_type?: string | null
          parser_version?: string | null
          predecessor_id?: string | null
          raw_object_path?: string | null
          sha256: string
          source_id: string
        }
        Update: {
          baslik?: string
          created_at?: string
          dogrulama_durumu?: string
          effective_from?: string | null
          effective_to?: string | null
          eklenme_kaynagi?: string
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          issued_at?: string | null
          language?: string | null
          media_type?: string | null
          parser_version?: string | null
          predecessor_id?: string | null
          raw_object_path?: string | null
          sha256?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_artifacts_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_artifacts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "regulatory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_fetch_runs: {
        Row: {
          artifact_id: string | null
          created_at: string
          durum: string
          fetched_at: string
          hata_ozeti: string | null
          id: string
          source_id: string
          yontem: string
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          durum: string
          fetched_at?: string
          hata_ozeti?: string | null
          id?: string
          source_id: string
          yontem?: string
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          durum?: string
          fetched_at?: string
          hata_ozeti?: string | null
          id?: string
          source_id?: string
          yontem?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_fetch_runs_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "regulatory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor: string | null
          created_at: string
          detay: Json
          event_type: string
          id: string
          plan_version_id: string | null
          tenant_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detay?: Json
          event_type: string
          id?: string
          plan_version_id?: string | null
          tenant_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detay?: Json
          event_type?: string
          id?: string
          plan_version_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bank_change_verifications: {
        Row: {
          created_at: string
          dogrulama_notu: string | null
          dogrulandi_at: string | null
          dogrulayan: string | null
          durum: string
          eski_iban_hash: string | null
          eski_iban_maskeli: string | null
          id: string
          kanit_id: string | null
          out_of_band_kanal: string
          talep_eden: string
          tedarikci_ad: string
          tenant_id: string
          yeni_iban_hash: string
          yeni_iban_maskeli: string
        }
        Insert: {
          created_at?: string
          dogrulama_notu?: string | null
          dogrulandi_at?: string | null
          dogrulayan?: string | null
          durum?: string
          eski_iban_hash?: string | null
          eski_iban_maskeli?: string | null
          id?: string
          kanit_id?: string | null
          out_of_band_kanal: string
          talep_eden: string
          tedarikci_ad: string
          tenant_id: string
          yeni_iban_hash: string
          yeni_iban_maskeli: string
        }
        Update: {
          created_at?: string
          dogrulama_notu?: string | null
          dogrulandi_at?: string | null
          dogrulayan?: string | null
          durum?: string
          eski_iban_hash?: string | null
          eski_iban_maskeli?: string | null
          id?: string
          kanit_id?: string | null
          out_of_band_kanal?: string
          talep_eden?: string
          tedarikci_ad?: string
          tenant_id?: string
          yeni_iban_hash?: string
          yeni_iban_maskeli?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_change_verifications_dogrulayan_fkey"
            columns: ["dogrulayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_change_verifications_kanit_id_fkey"
            columns: ["kanit_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_change_verifications_talep_eden_fkey"
            columns: ["talep_eden"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_change_verifications_tenant_id_fkey"
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
      tenant_subscriptions: {
        Row: {
          baslangic: string
          bitis: string | null
          durum: string
          id: string
          plan_version_id: string
          tenant_id: string
          trial_bitis: string | null
          updated_at: string
        }
        Insert: {
          baslangic?: string
          bitis?: string | null
          durum?: string
          id?: string
          plan_version_id: string
          tenant_id: string
          trial_bitis?: string | null
          updated_at?: string
        }
        Update: {
          baslangic?: string
          bitis?: string | null
          durum?: string
          id?: string
          plan_version_id?: string
          tenant_id?: string
          trial_bitis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
      test_runs: {
        Row: {
          bagimsiz_onaylayan: string | null
          baslangic_at: string | null
          beklenen_sonuc: string | null
          bitis_at: string | null
          calisti_at: string
          control_id: string
          created_at: string
          evidence_id: string | null
          gerekce: string
          gozlem: Json | null
          hazirlayan: string | null
          id: string
          log_referanslari: Json
          performans_etkisi: string | null
          seq: number
          sonuc: string
          sorumlu: string | null
          tanim_surumu: number
          tenant_id: string
          test_definition_id: string
          yanlis_negatif: boolean | null
          yanlis_pozitif: boolean | null
        }
        Insert: {
          bagimsiz_onaylayan?: string | null
          baslangic_at?: string | null
          beklenen_sonuc?: string | null
          bitis_at?: string | null
          calisti_at?: string
          control_id: string
          created_at?: string
          evidence_id?: string | null
          gerekce: string
          gozlem?: Json | null
          hazirlayan?: string | null
          id?: string
          log_referanslari?: Json
          performans_etkisi?: string | null
          seq?: never
          sonuc: string
          sorumlu?: string | null
          tanim_surumu: number
          tenant_id: string
          test_definition_id: string
          yanlis_negatif?: boolean | null
          yanlis_pozitif?: boolean | null
        }
        Update: {
          bagimsiz_onaylayan?: string | null
          baslangic_at?: string | null
          beklenen_sonuc?: string | null
          bitis_at?: string | null
          calisti_at?: string
          control_id?: string
          created_at?: string
          evidence_id?: string | null
          gerekce?: string
          gozlem?: Json | null
          hazirlayan?: string | null
          id?: string
          log_referanslari?: Json
          performans_etkisi?: string | null
          seq?: never
          sonuc?: string
          sorumlu?: string | null
          tanim_surumu?: number
          tenant_id?: string
          test_definition_id?: string
          yanlis_negatif?: boolean | null
          yanlis_pozitif?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_bagimsiz_onaylayan_fkey"
            columns: ["bagimsiz_onaylayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_hazirlayan_fkey"
            columns: ["hazirlayan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_sorumlu_fkey"
            columns: ["sorumlu"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "control_test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      third_parties: {
        Row: {
          ad: string
          created_at: string
          dis_rating: string | null
          dis_rating_kaynagi: string | null
          durum: string
          hizmet_ozeti: string | null
          id: string
          karar: string
          karar_veren: string | null
          karar_zamani: string | null
          tenant_id: string
          tier: string
          ulke: string | null
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          dis_rating?: string | null
          dis_rating_kaynagi?: string | null
          durum?: string
          hizmet_ozeti?: string | null
          id?: string
          karar?: string
          karar_veren?: string | null
          karar_zamani?: string | null
          tenant_id: string
          tier?: string
          ulke?: string | null
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          dis_rating?: string | null
          dis_rating_kaynagi?: string | null
          durum?: string
          hizmet_ozeti?: string | null
          id?: string
          karar?: string
          karar_veren?: string | null
          karar_zamani?: string | null
          tenant_id?: string
          tier?: string
          ulke?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_parties_karar_veren_fkey"
            columns: ["karar_veren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_access_grants: {
        Row: {
          created_at: string
          external_email: string
          id: string
          iptal_edildi: boolean
          olusturan: string | null
          son_gecerlilik: string
          tenant_id: string
          third_party_id: string
          token: string
        }
        Insert: {
          created_at?: string
          external_email: string
          id?: string
          iptal_edildi?: boolean
          olusturan?: string | null
          son_gecerlilik: string
          tenant_id: string
          third_party_id: string
          token?: string
        }
        Update: {
          created_at?: string
          external_email?: string
          id?: string
          iptal_edildi?: boolean
          olusturan?: string | null
          son_gecerlilik?: string
          tenant_id?: string
          third_party_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_access_grants_olusturan_fkey"
            columns: ["olusturan"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_access_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_access_grants_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_assessments: {
        Row: {
          baslangic_at: string
          created_at: string
          degerlendiren: string | null
          durum: string
          id: string
          ozet: string | null
          tamamlandi_at: string | null
          tenant_id: string
          third_party_id: string
          tur: string
          updated_at: string
        }
        Insert: {
          baslangic_at?: string
          created_at?: string
          degerlendiren?: string | null
          durum?: string
          id?: string
          ozet?: string | null
          tamamlandi_at?: string | null
          tenant_id: string
          third_party_id: string
          tur?: string
          updated_at?: string
        }
        Update: {
          baslangic_at?: string
          created_at?: string
          degerlendiren?: string | null
          durum?: string
          id?: string
          ozet?: string | null
          tamamlandi_at?: string | null
          tenant_id?: string
          third_party_id?: string
          tur?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_assessments_degerlendiren_fkey"
            columns: ["degerlendiren"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_assessments_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_contracts: {
        Row: {
          baslangic: string
          bitis: string
          cikis_maddesi: boolean
          created_at: string
          denetim_hakki: boolean
          durum: string
          id: string
          sozlesme_ref: string
          tenant_id: string
          third_party_id: string
          updated_at: string
        }
        Insert: {
          baslangic: string
          bitis: string
          cikis_maddesi?: boolean
          created_at?: string
          denetim_hakki?: boolean
          durum?: string
          id?: string
          sozlesme_ref: string
          tenant_id: string
          third_party_id: string
          updated_at?: string
        }
        Update: {
          baslangic?: string
          bitis?: string
          cikis_maddesi?: boolean
          created_at?: string
          denetim_hakki?: boolean
          durum?: string
          id?: string
          sozlesme_ref?: string
          tenant_id?: string
          third_party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_contracts_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_services: {
        Row: {
          created_at: string
          hizmet_adi: string
          id: string
          kritik: boolean
          kritik_hizmet_adi: string | null
          tenant_id: string
          third_party_id: string
          veri_siniflari: string[]
        }
        Insert: {
          created_at?: string
          hizmet_adi: string
          id?: string
          kritik?: boolean
          kritik_hizmet_adi?: string | null
          tenant_id: string
          third_party_id: string
          veri_siniflari?: string[]
        }
        Update: {
          created_at?: string
          hizmet_adi?: string
          id?: string
          kritik?: boolean
          kritik_hizmet_adi?: string | null
          tenant_id?: string
          third_party_id?: string
          veri_siniflari?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "third_party_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_services_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          created_at: string
          durum: string
          id: string
          kullanici: string
          requirement_id: string
          son_tarih: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          id?: string
          kullanici: string
          requirement_id: string
          son_tarih?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          id?: string
          kullanici?: string
          requirement_id?: string
          son_tarih?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_kullanici_fkey"
            columns: ["kullanici"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "training_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_completions: {
        Row: {
          assignment_id: string
          attestation: boolean
          created_at: string
          gecti: boolean
          id: string
          kaynak: string
          kaynak_simulasyon_run_id: string | null
          skor: number
          tamamlandi_at: string
          tenant_id: string
        }
        Insert: {
          assignment_id: string
          attestation?: boolean
          created_at?: string
          gecti?: boolean
          id?: string
          kaynak?: string
          kaynak_simulasyon_run_id?: string | null
          skor: number
          tamamlandi_at?: string
          tenant_id: string
        }
        Update: {
          assignment_id?: string
          attestation?: boolean
          created_at?: string
          gecti?: boolean
          id?: string
          kaynak?: string
          kaynak_simulasyon_run_id?: string | null
          skor?: number
          tamamlandi_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "training_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_kaynak_simulasyon_run_id_fkey"
            columns: ["kaynak_simulasyon_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          ad: string
          created_at: string
          gecme_esigi: number
          hedef_rol: string | null
          id: string
          konu: string
          periyot_gun: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          gecme_esigi?: number
          hedef_rol?: string | null
          id?: string
          konu?: string
          periyot_gun?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          gecme_esigi?: number
          hedef_rol?: string | null
          id?: string
          konu?: string
          periyot_gun?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transparency_checkpoints: {
        Row: {
          id: string
          olusturuldu_at: string
          root_hash: string
          seq: number
          signer_ad: string
          sth_jws: string
          sth_kid: string
          sth_public_jwk: Json
          tenant_id: string
          timestamp_saglayici: string | null
          timestamp_token: Json | null
          tree_size: number
        }
        Insert: {
          id?: string
          olusturuldu_at?: string
          root_hash: string
          seq?: never
          signer_ad: string
          sth_jws: string
          sth_kid: string
          sth_public_jwk: Json
          tenant_id: string
          timestamp_saglayici?: string | null
          timestamp_token?: Json | null
          tree_size: number
        }
        Update: {
          id?: string
          olusturuldu_at?: string
          root_hash?: string
          seq?: never
          signer_ad?: string
          sth_jws?: string
          sth_kid?: string
          sth_public_jwk?: Json
          tenant_id?: string
          timestamp_saglayici?: string | null
          timestamp_token?: Json | null
          tree_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "transparency_checkpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transparency_ledger_entries: {
        Row: {
          entry_hash: string
          id: string
          kaydedildi_at: string
          leaf_hash: string
          leaf_index: number
          previous_entry_hash: string | null
          seq: number
          signed_statement: Json
          statement_hash: string
          statement_kind: string
          tenant_id: string
        }
        Insert: {
          entry_hash?: string
          id?: string
          kaydedildi_at?: string
          leaf_hash: string
          leaf_index?: number
          previous_entry_hash?: string | null
          seq?: never
          signed_statement: Json
          statement_hash: string
          statement_kind: string
          tenant_id: string
        }
        Update: {
          entry_hash?: string
          id?: string
          kaydedildi_at?: string
          leaf_hash?: string
          leaf_index?: number
          previous_entry_hash?: string | null
          seq?: never
          signed_statement?: Json
          statement_hash?: string
          statement_kind?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transparency_ledger_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      artifact_ledger_durumu: {
        Args: { p_artifact_id: string; p_artifact_table: string }
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
      current_user_role: { Args: never; Returns: string }
      egitim_periyot_yenile: { Args: never; Returns: undefined }
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
      evidence_redaksiyon_soyu: {
        Args: { target_evidence_id: string }
        Returns: {
          evidence_id: string
          kaynak_id: string
          not_metni: string
          redaksiyon_mi: boolean
        }[]
      }
      kanit_suresi_dolanlari_isle: { Args: never; Returns: number }
      kontrol_son_test_sonuclari: {
        Args: { target_control_id: string }
        Returns: {
          calisti_at: string
          gerekce: string
          sonuc: string
          test_definition_id: string
        }[]
      }
      ledger_outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          artifact_id: string
          artifact_table: string
          created_at: string
          deneme_sayisi: number
          durum: string
          id: string
          islenme_at: string | null
          seq: number
          son_hata: string | null
          statement_kind: string
          tenant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ledger_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ledger_outbox_mark_failed: {
        Args: { p_hata: string; p_id: string }
        Returns: undefined
      }
      ledger_outbox_mark_processed: {
        Args: { p_id: string; p_ledger_entry_id: string }
        Returns: undefined
      }
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
      matter_goruntule: { Args: { p_token: string }; Returns: Json }
      paylasim_goruntule: { Args: { p_token: string }; Returns: Json }
      policy_istisna_suresi_dolanlari_isle: { Args: never; Returns: undefined }
      proof_room_goruntule: { Args: { p_token: string }; Returns: Json }
      proof_room_ledger_malzeme: { Args: { p_token: string }; Returns: Json }
      simulation_manifest_durumu: {
        Args: { target_manifest_id: string }
        Returns: string
      }
      sod_cron_durumu: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      sod_import_geri_al: {
        Args: { p_actor: string; p_karar_notu: string; p_rollback_id: string }
        Returns: Json
      }
      sod_import_uygula: {
        Args: {
          p_actor: string
          p_guncel_atama_snapshot_hash: string
          p_guncel_rule_set_version: string
          p_manifest_hash: string
          p_onizleme_id: string
        }
        Returns: Json
      }
      sod_istisna_suresi_dolanlari_isle: { Args: never; Returns: number }
      tedarikci_goruntule: { Args: { p_token: string }; Returns: Json }
      tenant_has_profiles: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      tpr_sozlesme_dolanlari_isle: { Args: never; Returns: undefined }
      transparency_dogrulama_durumu: {
        Args: { target_entry_id: string }
        Returns: string
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
