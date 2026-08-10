// Hand-authored mirror of the Supabase schema (supabase/migrations/*.sql).
// If you change the SQL schema, update this file to match, or regenerate
// with `supabase gen types typescript` and reconcile field names.

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          username_normalized: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          username_normalized: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: Partial<{
          username: string
          username_normalized: string
          display_name: string | null
          avatar_url: string | null
        }>
        Relationships: never[]
      }
      user_preferences: {
        Row: { user_id: string; theme: 'light' | 'dark' | 'system'; timezone: string; updated_at: string }
        Insert: { user_id: string; theme?: 'light' | 'dark' | 'system'; timezone?: string }
        Update: Partial<{ theme: 'light' | 'dark' | 'system'; timezone: string }>
        Relationships: never[]
      }
      notification_preferences: {
        Row: {
          user_id: string
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
          updated_at: string
        }
        Insert: Partial<{
          user_id: string
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
        }>
        Update: Partial<{
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
        }>
        Relationships: never[]
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          icon: string | null
          category: 'general' | 'gym'
          archived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          icon?: string | null
          category?: 'general' | 'gym'
          archived?: boolean
        }
        Update: Partial<{ name: string; description: string | null; icon: string | null; archived: boolean }>
        Relationships: never[]
      }
      habit_schedules: {
        Row: {
          id: string
          habit_id: string
          user_id: string
          recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
          weekdays: number[] | null
          time: string | null
          start_date: string
          end_date: string | null
          reminder_enabled: boolean
          supersedes_schedule_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          habit_id: string
          user_id: string
          recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
          weekdays?: number[] | null
          time?: string | null
          start_date: string
          end_date?: string | null
          reminder_enabled?: boolean
          supersedes_schedule_id?: string | null
        }
        Update: Partial<{
          recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
          weekdays: number[] | null
          time: string | null
          start_date: string
          end_date: string | null
          reminder_enabled: boolean
        }>
        Relationships: never[]
      }
      habit_occurrences: {
        Row: {
          id: string
          habit_id: string
          schedule_id: string
          user_id: string
          occurrence_date: string
          scheduled_time: string | null
          status: 'done' | 'skipped' | 'cancelled' | null
          completed_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          habit_id: string
          schedule_id: string
          user_id: string
          occurrence_date: string
          scheduled_time?: string | null
          status?: 'done' | 'skipped' | 'cancelled' | null
          notes?: string | null
        }
        Update: Partial<{ status: 'done' | 'skipped' | 'cancelled' | null; notes: string | null }>
        Relationships: never[]
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          occurrence_id: string | null
          workout_date: string
          duration_minutes: number | null
          notes: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          occurrence_id?: string | null
          workout_date: string
          duration_minutes?: number | null
          notes?: string | null
          completed?: boolean
        }
        Update: Partial<{ duration_minutes: number | null; notes: string | null; completed: boolean }>
        Relationships: never[]
      }
      workout_exercises: {
        Row: {
          id: string
          workout_id: string
          user_id: string
          name: string
          sets: number
          reps: number
          weight_kg: number
          notes: string | null
          order_index: number
        }
        Insert: {
          id?: string
          workout_id: string
          user_id: string
          name: string
          sets?: number
          reps?: number
          weight_kg?: number
          notes?: string | null
          order_index?: number
        }
        Update: Partial<{ name: string; sets: number; reps: number; weight_kg: number; notes: string | null }>
        Relationships: never[]
      }
      income_entries: {
        Row: {
          id: string
          user_id: string
          amount_centavos: number
          source: string
          entry_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount_centavos: number
          source: string
          entry_date: string
          note?: string | null
        }
        Update: Partial<{ amount_centavos: number; source: string; entry_date: string; note: string | null }>
        Relationships: never[]
      }
      expense_entries: {
        Row: {
          id: string
          user_id: string
          amount_centavos: number
          category: string
          entry_date: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount_centavos: number
          category: string
          entry_date: string
          description?: string | null
        }
        Update: Partial<{
          amount_centavos: number
          category: string
          entry_date: string
          description: string | null
        }>
        Relationships: never[]
      }
      budgets: {
        Row: { id: string; user_id: string; month: string; amount_centavos: number }
        Insert: { id?: string; user_id: string; month: string; amount_centavos: number }
        Update: Partial<{ amount_centavos: number }>
        Relationships: never[]
      }
      savings_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          goal_amount_centavos: number | null
          balance_centavos: number
          color: string
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          goal_amount_centavos?: number | null
          balance_centavos?: number
          color?: string
          icon?: string
        }
        Update: Partial<{ name: string; goal_amount_centavos: number | null; color: string; icon: string }>
        Relationships: never[]
      }
      savings_transactions: {
        Row: {
          id: string
          category_id: string
          user_id: string
          type: 'deposit' | 'withdrawal'
          amount_centavos: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          user_id: string
          type: 'deposit' | 'withdrawal'
          amount_centavos: number
          note?: string | null
        }
        Update: never
        Relationships: never[]
      }
      debts: {
        Row: {
          id: string
          user_id: string
          name: string
          original_amount_centavos: number
          balance_centavos: number
          paid_off: boolean
          color: string
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          original_amount_centavos: number
          balance_centavos: number
          color?: string
          icon?: string
        }
        Update: Partial<{ name: string; color: string; icon: string }>
        Relationships: never[]
      }
      debt_payments: {
        Row: {
          id: string
          debt_id: string
          user_id: string
          amount_centavos: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          debt_id: string
          user_id: string
          amount_centavos: number
          note?: string | null
        }
        Update: never
        Relationships: never[]
      }
      finance_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          kind: 'expense' | 'income'
          color: string
          icon: string
          is_builtin: boolean
          archived: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          kind: 'expense' | 'income'
          color?: string
          icon?: string
          is_builtin?: boolean
          archived?: boolean
          sort_order?: number
        }
        Update: Partial<{
          name: string
          color: string
          icon: string
          archived: boolean
          sort_order: number
        }>
        Relationships: never[]
      }
      category_budgets: {
        Row: { id: string; user_id: string; category_id: string; month: string; amount_centavos: number }
        Insert: { id?: string; user_id: string; category_id: string; month: string; amount_centavos: number }
        Update: Partial<{ amount_centavos: number }>
        Relationships: never[]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
          updated_at: string
        }
        Insert: { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string }
        Update: Partial<{ p256dh: string; auth: string }>
        Relationships: never[]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      ensure_default_finance_categories: { Args: Record<string, never>; Returns: undefined }
      record_debt_payment: {
        Args: { p_debt_id: string; p_amount_centavos: number; p_note?: string | null }
        Returns: Database['public']['Tables']['debts']['Row']
      }
      record_savings_transaction: {
        Args: {
          p_category_id: string
          p_type: 'deposit' | 'withdrawal'
          p_amount_centavos: number
          p_note?: string | null
        }
        Returns: Database['public']['Tables']['savings_categories']['Row']
      }
      set_habit_occurrence_status: {
        Args: {
          p_habit_id: string
          p_schedule_id: string
          p_occurrence_date: string
          p_scheduled_time: string | null
          p_status: 'done' | 'skipped' | 'cancelled' | null
        }
        Returns: Database['public']['Tables']['habit_occurrences']['Row']
      }
      complete_workout: {
        Args: { p_workout_id: string }
        Returns: Database['public']['Tables']['workouts']['Row']
      }
    }
    Enums: Record<string, never>
  }
}
