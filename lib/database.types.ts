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
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          duration_minutes: number
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
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          duration_minutes: number
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
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          duration_minutes?: number
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
          email: string
          email_sent_at: string | null
          expires_at: string
          id: string
          invited_by: string
          role: string
          salon_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          salon_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          salon_id?: string
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
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
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
        }
        Insert: {
          active?: boolean
          barcode?: string | null
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
        }
        Update: {
          active?: boolean
          barcode?: string | null
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
        }
        Relationships: [
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
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
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
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan_id: string | null
          schedule: Json | null
          slug: string | null
          subscription_tier: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          vat_rate: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan_id?: string | null
          schedule?: Json | null
          slug?: string | null
          subscription_tier?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          vat_rate?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan_id?: string | null
          schedule?: Json | null
          slug?: string | null
          subscription_tier?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          vat_rate?: number | null
          website?: string | null
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
          cost: number | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes: number
          id?: string
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
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
          id: string
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
          id?: string
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
          id?: string
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
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          category: string | null
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
          category?: string | null
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
          category?: string | null
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
          original_price: number | null
          price: number
          quantity: number
          reference_id: string | null
          salon_id: string
          transaction_id: string
          type: string
          variant_name: string | null
        }
        Insert: {
          cost?: number | null
          id?: string
          name: string
          note?: string | null
          original_price?: number | null
          price: number
          quantity?: number
          reference_id?: string | null
          salon_id: string
          transaction_id: string
          type: string
          variant_name?: string | null
        }
        Update: {
          cost?: number | null
          id?: string
          name?: string
          note?: string | null
          original_price?: number | null
          price?: number
          quantity?: number
          reference_id?: string | null
          salon_id?: string
          transaction_id?: string
          type?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
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
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          salon_id: string
          total: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          salon_id: string
          total: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          salon_id?: string
          total?: number
        }
        Relationships: [
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
      accept_invitation: { Args: { p_token: string }; Returns: string }
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
      check_slot_availability: {
        Args: { p_date: string; p_duration_minutes: number; p_staff_id: string }
        Returns: boolean
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
      create_transaction: {
        Args: {
          p_client_id: string
          p_items: Json
          p_notes?: string
          p_payments: Json
          p_salon_id: string
        }
        Returns: string
      }
      decrypt_pii: { Args: { ciphertext: string }; Returns: string }
      encrypt_pii: { Args: { plaintext: string }; Returns: string }
      gdpr_delete_client: { Args: { p_client_id: string }; Returns: undefined }
      get_active_salon: { Args: never; Returns: string }
      get_client_stats: { Args: { p_client_id: string }; Returns: Json }
      get_dashboard_stats: {
        Args: { p_date_from: string; p_date_to: string; p_salon_id: string }
        Returns: Json
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
      get_user_role: { Args: never; Returns: string }
      revoke_membership: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      set_session_context: {
        Args: { p_salon_id: string; p_user_role: string }
        Returns: undefined
      }
      transfer_ownership: {
        Args: { p_new_owner_id: string; p_salon_id: string }
        Returns: undefined
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
