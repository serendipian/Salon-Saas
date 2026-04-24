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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointment_groups: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          reminder_minutes: number | null
          salon_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          reminder_minutes?: number | null
          salon_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          reminder_minutes?: number | null
          salon_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointment_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_note: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          duration_minutes: number
          group_id: string | null
          id: string
          notes: string | null
          price: number
          salon_id: string
          service_id: string | null
          service_variant_id: string | null
          staff_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          duration_minutes: number
          group_id?: string | null
          id?: string
          notes?: string | null
          price: number
          salon_id: string
          service_id?: string | null
          service_variant_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          duration_minutes?: number
          group_id?: string | null
          id?: string
          notes?: string | null
          price?: number
          salon_id?: string
          service_id?: string | null
          service_variant_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "appointment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          performed_by: string | null
          record_id: string
          salon_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id: string
          salon_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id?: string
          salon_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          acquisition_detail: string | null
          acquisition_source: string | null
          age_group: string | null
          allergies: string | null
          city: string | null
          company: string | null
          contact_date: string | null
          contact_method: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          instagram: string | null
          last_name: string
          message_channel: string | null
          notes: string | null
          other_channel_detail: string | null
          permissions_marketing: boolean
          permissions_other: boolean
          permissions_other_detail: string | null
          permissions_social_media: boolean
          phone: string | null
          photo_url: string | null
          preferred_channel: string | null
          preferred_language: string | null
          preferred_staff_id: string | null
          profession: string | null
          salon_id: string
          social_network: string | null
          social_username: string | null
          status: string
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          age_group?: string | null
          allergies?: string | null
          city?: string | null
          company?: string | null
          contact_date?: string | null
          contact_method?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          instagram?: string | null
          last_name: string
          message_channel?: string | null
          notes?: string | null
          other_channel_detail?: string | null
          permissions_marketing?: boolean
          permissions_other?: boolean
          permissions_other_detail?: string | null
          permissions_social_media?: boolean
          phone?: string | null
          photo_url?: string | null
          preferred_channel?: string | null
          preferred_language?: string | null
          preferred_staff_id?: string | null
          profession?: string | null
          salon_id: string
          social_network?: string | null
          social_username?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          age_group?: string | null
          allergies?: string | null
          city?: string | null
          company?: string | null
          contact_date?: string | null
          contact_method?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          instagram?: string | null
          last_name?: string
          message_channel?: string | null
          notes?: string | null
          other_channel_detail?: string | null
          permissions_marketing?: boolean
          permissions_other?: boolean
          permissions_other_detail?: string | null
          permissions_social_media?: boolean
          phone?: string | null
          photo_url?: string | null
          preferred_channel?: string | null
          preferred_language?: string | null
          preferred_staff_id?: string | null
          profession?: string | null
          salon_id?: string
          social_network?: string | null
          social_username?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          description: string
          id: string
          payment_method: string | null
          proof_url: string | null
          salon_id: string
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          description: string
          id?: string
          payment_method?: string | null
          proof_url?: string | null
          salon_id: string
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          proof_url?: string | null
          salon_id?: string
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          email_sent_at: string | null
          expires_at: string
          id: string
          invited_by: string
          role: string
          salon_id: string
          staff_member_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          salon_id: string
          staff_member_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          salon_id?: string
          staff_member_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf_url: string | null
          paid_at: string | null
          salon_id: string
          status: string
          stripe_event_id: string
          stripe_invoice_id: string
          subscription_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          salon_id: string
          status: string
          stripe_event_id: string
          stripe_invoice_id: string
          subscription_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          salon_id?: string
          status?: string
          stripe_event_id?: string
          stripe_invoice_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_groups: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_groups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_items: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          salon_id: string
          service_id: string
          service_variant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          salon_id: string
          service_id: string
          service_variant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          salon_id?: string
          service_id?: string
          service_variant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          favorite_sort_order: number | null
          id: string
          is_favorite: boolean
          name: string
          pack_group_id: string | null
          price: number
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          favorite_sort_order?: number | null
          id?: string
          is_favorite?: boolean
          name: string
          pack_group_id?: string | null
          price: number
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          favorite_sort_order?: number | null
          id?: string
          is_favorite?: boolean
          name?: string
          pack_group_id?: string | null
          price?: number
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_pack_group_id_fkey"
            columns: ["pack_group_id"]
            isOneToOne: false
            referencedRelation: "pack_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          features: Json | null
          id: string
          max_clients: number | null
          max_products: number | null
          max_staff: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
        }
        Insert: {
          active?: boolean
          features?: Json | null
          id?: string
          max_clients?: number | null
          max_products?: number | null
          max_staff?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
        }
        Update: {
          active?: boolean
          features?: Json | null
          id?: string
          max_clients?: number | null
          max_products?: number | null
          max_staff?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          salon_id: string
          sku: string | null
          stock: number
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
          usage_type: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          price: number
          salon_id: string
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usage_type?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          salon_id?: string
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_admin: boolean
          language: string
          last_name: string | null
          notification_email: boolean
          notification_sms: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean
          language?: string
          last_name?: string | null
          notification_email?: boolean
          notification_sms?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          language?: string
          last_name?: string | null
          notification_email?: boolean
          notification_sms?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          deleted_at: string | null
          frequency: string
          id: string
          name: string
          next_date: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          frequency: string
          id?: string
          name: string
          next_date: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          name?: string
          next_date?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          profile_id: string
          role: string
          salon_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          profile_id: string
          role: string
          salon_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          profile_id?: string
          role?: string
          salon_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_ticket_counters: {
        Row: {
          next_ticket_number: number
          salon_id: string
          updated_at: string
        }
        Insert: {
          next_ticket_number?: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          next_ticket_number?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_ticket_counters_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_ticket_counters_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_ticket_counters_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          business_registration: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          facebook: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          is_suspended: boolean
          logo_url: string | null
          name: string
          neighborhood: string | null
          phone: string | null
          plan_id: string | null
          postal_code: string | null
          product_settings: Json | null
          schedule: Json | null
          service_settings: Json | null
          slug: string | null
          street: string | null
          subscription_tier: string
          supplier_settings: Json | null
          tiktok: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          vat_rate: number | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_registration?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_suspended?: boolean
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          product_settings?: Json | null
          schedule?: Json | null
          service_settings?: Json | null
          slug?: string | null
          street?: string | null
          subscription_tier?: string
          supplier_settings?: Json | null
          tiktok?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          vat_rate?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_registration?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_suspended?: boolean
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          product_settings?: Json | null
          schedule?: Json | null
          service_settings?: Json | null
          slug?: string | null
          street?: string | null
          subscription_tier?: string
          supplier_settings?: Json | null
          tiktok?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          vat_rate?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          additional_cost: number
          cost: number | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          favorite_sort_order: number
          id: string
          is_favorite: boolean
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          additional_cost?: number
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes: number
          favorite_sort_order?: number
          id?: string
          is_favorite?: boolean
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          additional_cost?: number
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          favorite_sort_order?: number
          id?: string
          is_favorite?: boolean
          name?: string
          price?: number
          salon_id?: string
          service_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_variants_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_variants_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          favorite_sort_order: number
          id: string
          is_favorite: boolean
          name: string
          salon_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          favorite_sort_order?: number
          id?: string
          is_favorite?: boolean
          name: string
          salon_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          favorite_sort_order?: number
          id?: string
          is_favorite?: boolean
          name?: string
          salon_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          address: string | null
          base_salary: string | null
          bio: string | null
          birth_date: string | null
          bonus_tiers: Json | null
          color: string | null
          commission_rate: number
          contract_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          end_date: string | null
          first_name: string
          iban: string | null
          id: string
          last_name: string
          membership_id: string | null
          phone: string | null
          photo_url: string | null
          role: string | null
          salon_id: string
          schedule: Json | null
          skills: string[] | null
          slug: string | null
          social_security_number: string | null
          start_date: string | null
          updated_at: string
          updated_by: string | null
          weekly_hours: number | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          base_salary?: string | null
          bio?: string | null
          birth_date?: string | null
          bonus_tiers?: Json | null
          color?: string | null
          commission_rate?: number
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          end_date?: string | null
          first_name: string
          iban?: string | null
          id?: string
          last_name: string
          membership_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          salon_id: string
          schedule?: Json | null
          skills?: string[] | null
          slug?: string | null
          social_security_number?: string | null
          start_date?: string | null
          updated_at?: string
          updated_by?: string | null
          weekly_hours?: number | null
        }
        Update: {
          active?: boolean
          address?: string | null
          base_salary?: string | null
          bio?: string | null
          birth_date?: string | null
          bonus_tiers?: Json | null
          color?: string | null
          commission_rate?: number
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          end_date?: string | null
          first_name?: string
          iban?: string | null
          id?: string
          last_name?: string
          membership_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          salon_id?: string
          schedule?: Json | null
          skills?: string[] | null
          slug?: string | null
          social_security_number?: string | null
          start_date?: string | null
          updated_at?: string
          updated_by?: string | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payouts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          rate_snapshot: number | null
          reference_amount: number | null
          salon_id: string
          staff_id: string
          status: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          rate_snapshot?: number | null
          reference_amount?: number | null
          salon_id: string
          staff_id: string
          status?: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          rate_snapshot?: number | null
          reference_amount?: number | null
          salon_id?: string
          staff_id?: string
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          plan_id: string
          salon_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          salon_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          salon_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          category_id: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          salon_id: string
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          category_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          salon_id: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          category_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          salon_id?: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          cost: number | null
          id: string
          name: string
          note: string | null
          original_item_id: string | null
          original_price: number | null
          price: number
          quantity: number
          reference_id: string | null
          salon_id: string
          staff_id: string | null
          staff_name: string | null
          transaction_id: string
          type: string
          variant_name: string | null
        }
        Insert: {
          cost?: number | null
          id?: string
          name: string
          note?: string | null
          original_item_id?: string | null
          original_price?: number | null
          price: number
          quantity?: number
          reference_id?: string | null
          salon_id: string
          staff_id?: string | null
          staff_name?: string | null
          transaction_id: string
          type: string
          variant_name?: string | null
        }
        Update: {
          cost?: number | null
          id?: string
          name?: string
          note?: string | null
          original_item_id?: string | null
          original_price?: number | null
          price?: number
          quantity?: number
          reference_id?: string | null
          salon_id?: string
          staff_id?: string | null
          staff_name?: string | null
          transaction_id?: string
          type?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_original_item_id_fkey"
            columns: ["original_item_id"]
            isOneToOne: false
            referencedRelation: "transaction_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount: number
          id: string
          method: string
          salon_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          id?: string
          method: string
          salon_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string
          salon_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          original_transaction_id: string | null
          reason_category: string | null
          reason_note: string | null
          salon_id: string
          ticket_number: number
          total: number
          type: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          original_transaction_id?: string | null
          reason_category?: string | null
          reason_note?: string | null
          salon_id: string
          ticket_number: number
          total: number
          type?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          original_transaction_id?: string | null
          reason_category?: string | null
          reason_note?: string | null
          salon_id?: string
          ticket_number?: number
          total?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_accounts_overview: {
        Row: {
          client_count: number | null
          created_at: string | null
          current_period_end: string | null
          id: string | null
          is_suspended: boolean | null
          name: string | null
          slug: string | null
          staff_count: number | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
        }
        Relationships: []
      }
      admin_mrr_summary: {
        Row: {
          free_count: number | null
          past_due_count: number | null
          premium_count: number | null
          pro_count: number | null
          total_mrr: number | null
          total_salons: number | null
          trial_count: number | null
        }
        Relationships: []
      }
      admin_trials_pipeline: {
        Row: {
          days_remaining: number | null
          id: string | null
          name: string | null
          trial_ends_at: string | null
        }
        Relationships: []
      }
      appointment_details: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string | null
          date: string | null
          duration_minutes: number | null
          id: string | null
          notes: string | null
          price: number | null
          salon_id: string | null
          service_id: string | null
          service_name: string | null
          service_variant_id: string | null
          staff_color: string | null
          staff_id: string | null
          staff_name: string | null
          status: string | null
          updated_at: string | null
          variant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stats: {
        Row: {
          client_id: string | null
          first_visit_date: string | null
          last_visit_date: string | null
          salon_id: string | null
          total_spent: number | null
          total_visits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "admin_trials_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number | null
          category: string | null
          date: string | null
          details: Json | null
          id: string | null
          label: string | null
          salon_id: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_admin: { Args: never; Returns: undefined }
      accept_invitation: { Args: { p_token: string }; Returns: string }
      accept_invitation_admin: {
        Args: { p_token: string; p_user_id: string }
        Returns: string
      }
      add_bien_etre_services: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      add_casa_staff: { Args: { p_salon_id: string }; Returns: undefined }
      add_cils_services: { Args: { p_salon_id: string }; Returns: undefined }
      add_coiffure_services: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      add_epilation_services: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      add_onglerie_services: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      admin_extend_trial: {
        Args: { p_days: number; p_salon_id: string }
        Returns: undefined
      }
      admin_reactivate_salon: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      admin_set_plan: {
        Args: { p_salon_id: string; p_tier: string }
        Returns: undefined
      }
      admin_suspend_salon: { Args: { p_salon_id: string }; Returns: undefined }
      appointment_range: {
        Args: { dur_min: number; start_at: string }
        Returns: unknown
      }
      book_appointment: {
        Args: {
          p_client_id: string
          p_date: string
          p_duration_minutes: number
          p_salon_id: string
          p_service_variant_id: string
          p_staff_id: string
        }
        Returns: string
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_note?: string; p_reason: string }
        Returns: undefined
      }
      check_slot_availability: {
        Args: { p_date: string; p_duration_minutes: number; p_staff_id: string }
        Returns: boolean
      }
      count_new_clients: {
        Args: { p_from: string; p_salon_id: string; p_to: string }
        Returns: {
          new_clients: number
        }[]
      }
      create_salon: {
        Args: {
          p_currency?: string
          p_name: string
          p_owner_id?: string
          p_timezone?: string
        }
        Returns: string
      }
      create_transaction:
        | {
            Args: {
              p_client_id: string
              p_items: Json
              p_notes?: string
              p_payments: Json
              p_salon_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_appointment_id?: string
              p_client_id: string
              p_items: Json
              p_notes?: string
              p_payments: Json
              p_salon_id: string
            }
            Returns: string
          }
      debug_auth: { Args: never; Returns: Json }
      decrypt_pii: { Args: { ciphertext: string }; Returns: string }
      edit_appointment_group: {
        Args: {
          p_client_id: string
          p_notes: string
          p_old_appointment_id: string
          p_reminder_minutes: number
          p_salon_id: string
          p_service_blocks: Json
          p_status: string
        }
        Returns: string
      }
      encrypt_pii: { Args: { plaintext: string }; Returns: string }
      gdpr_delete_client: { Args: { p_client_id: string }; Returns: undefined }
      generate_staff_slug: {
        Args: {
          p_exclude_id?: string
          p_first_name: string
          p_salon_id: string
        }
        Returns: string
      }
      get_active_salon: { Args: never; Returns: string }
      get_admin_account_detail: { Args: { p_salon_id: string }; Returns: Json }
      get_admin_accounts: {
        Args: never
        Returns: {
          client_count: number
          created_at: string
          current_period_end: string
          id: string
          is_suspended: boolean
          name: string
          slug: string
          staff_count: number
          stripe_subscription_id: string
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string
        }[]
      }
      get_admin_churn: {
        Args: never
        Returns: {
          cancelled_at: string
          id: string
          name: string
        }[]
      }
      get_admin_failed_payments: {
        Args: never
        Returns: {
          current_period_end: string
          days_overdue: number
          id: string
          name: string
          stripe_subscription_id: string
          subscription_tier: string
        }[]
      }
      get_admin_mrr: { Args: never; Returns: Json }
      get_admin_mrr_history: {
        Args: { months_back?: number }
        Returns: {
          month: string
          mrr: number
        }[]
      }
      get_admin_recent_signups: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          staff_count: number
          subscription_tier: string
        }[]
      }
      get_admin_signups_history: {
        Args: { months_back?: number }
        Returns: {
          count: number
          month: string
        }[]
      }
      get_admin_trials: {
        Args: never
        Returns: {
          days_remaining: number
          id: string
          name: string
          trial_ends_at: string
        }[]
      }
      get_admin_trials_history: {
        Args: { months_back?: number }
        Returns: {
          count: number
          month: string
        }[]
      }
      get_client_stats: { Args: { p_client_id: string }; Returns: Json }
      get_dashboard_stats: {
        Args: { p_date_from: string; p_date_to: string; p_salon_id: string }
        Returns: Json
      }
      get_invitation_info: {
        Args: { p_token: string }
        Returns: {
          is_valid: boolean
          role: string
          salon_name: string
          staff_email: string
          staff_first_name: string
          staff_last_name: string
        }[]
      }
      get_staff_activity: {
        Args: { p_limit?: number; p_offset?: number; p_staff_id: string }
        Returns: {
          client_name: string
          description: string
          event_date: string
          event_type: string
          metadata: Json
        }[]
      }
      get_staff_clients: {
        Args: { p_limit?: number; p_staff_id: string }
        Returns: {
          client_first_name: string
          client_id: string
          client_last_name: string
          last_visit: string
          total_revenue: number
          visit_count: number
        }[]
      }
      get_staff_id: { Args: never; Returns: string }
      get_staff_performance: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_salon_id: string
          p_staff_id: string
        }
        Returns: Json
      }
      get_staff_pii: {
        Args: { p_staff_id: string }
        Returns: {
          base_salary: string
          iban: string
          social_security_number: string
        }[]
      }
      get_staff_pii_batch: {
        Args: { p_staff_ids: string[] }
        Returns: {
          base_salary: string
          iban: string
          social_security_number: string
          staff_id: string
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      initialize_salon_trial: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      leave_salon: { Args: { p_salon_id: string }; Returns: undefined }
      refund_transaction: {
        Args: {
          p_items: Json
          p_payments: Json
          p_reason_category: string
          p_reason_note: string
          p_restock?: boolean
          p_salon_id: string
          p_transaction_id: string
        }
        Returns: string
      }
      reorder_favorites: {
        Args: { p_items: Json; p_salon_id: string }
        Returns: undefined
      }
      replace_pack_items: {
        Args: { p_items: Json; p_pack_id: string; p_salon_id: string }
        Returns: undefined
      }
      revoke_membership: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      save_brands: {
        Args: { p_brands: Json; p_salon_id: string }
        Returns: undefined
      }
      save_product_categories: {
        Args: { p_assignments?: Json; p_categories: Json; p_salon_id: string }
        Returns: undefined
      }
      save_service_categories: {
        Args: { p_assignments?: Json; p_categories: Json; p_salon_id: string }
        Returns: undefined
      }
      save_supplier_categories: {
        Args: { p_assignments?: Json; p_categories: Json; p_salon_id: string }
        Returns: undefined
      }
      seed_salon_demo_data: {
        Args: { p_owner_id: string; p_salon_id: string }
        Returns: undefined
      }
      set_session_context: {
        Args: { p_salon_id: string; p_user_role: string }
        Returns: undefined
      }
      soft_delete_appointment: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      soft_delete_client: { Args: { p_client_id: string }; Returns: undefined }
      soft_delete_service: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      toggle_favorite: {
        Args: {
          p_id: string
          p_is_favorite: boolean
          p_salon_id: string
          p_type: string
        }
        Returns: undefined
      }
      transfer_ownership: {
        Args: { p_new_owner_id: string; p_salon_id: string }
        Returns: undefined
      }
      update_staff_pii: {
        Args: {
          p_base_salary?: string
          p_clear_base_salary?: boolean
          p_clear_iban?: boolean
          p_clear_ssn?: boolean
          p_iban?: string
          p_social_security_number?: string
          p_staff_id: string
        }
        Returns: undefined
      }
      user_role_in_salon: { Args: { p_salon_id: string }; Returns: string }
      user_salon_ids: { Args: never; Returns: string[] }
      user_salon_ids_with_role: {
        Args: { allowed_roles: string[] }
        Returns: string[]
      }
      user_staff_id_in_salon: { Args: { p_salon_id: string }; Returns: string }
      void_transaction: {
        Args: {
          p_reason_category: string
          p_reason_note: string
          p_salon_id: string
          p_transaction_id: string
        }
        Returns: string
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
  public: {
    Enums: {},
  },
} as const
