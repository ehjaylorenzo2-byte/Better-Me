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
          // Optional, and never the internal auth alias. Added in 0006.
          recovery_email: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          username_normalized: string
          display_name?: string | null
          avatar_url?: string | null
          recovery_email?: string | null
          created_at?: string
        }
        Update: Partial<{
          username: string
          username_normalized: string
          display_name: string | null
          avatar_url: string | null
          recovery_email: string | null
        }>
        Relationships: never[]
      }
      user_preferences: {
        Row: {
          user_id: string
          theme: 'light' | 'dark' | 'system'
          timezone: string
          motivation_tone: 'encourage' | 'balanced' | 'roast' | 'brutal'
          text_size: 'small' | 'medium' | 'large'
          /** 0 = Sunday, 1 = Monday. */
          week_starts_on: 0 | 1
          hidden_home_cards: string[]
          /** Applies to any month with no row in budgets. Null = no default. */
          default_budget_centavos: number | null
          rest_seconds: number
          rest_timer_enabled: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          theme?: 'light' | 'dark' | 'system'
          timezone?: string
          motivation_tone?: 'encourage' | 'balanced' | 'roast' | 'brutal'
          text_size?: 'small' | 'medium' | 'large'
          week_starts_on?: 0 | 1
          hidden_home_cards?: string[]
          default_budget_centavos?: number | null
          rest_seconds?: number
          rest_timer_enabled?: boolean
        }
        Update: Partial<{
          theme: 'light' | 'dark' | 'system'
          timezone: string
          motivation_tone: 'encourage' | 'balanced' | 'roast' | 'brutal'
          text_size: 'small' | 'medium' | 'large'
          week_starts_on: 0 | 1
          hidden_home_cards: string[]
          default_budget_centavos: number | null
          rest_seconds: number
          rest_timer_enabled: boolean
        }>
        Relationships: never[]
      }
      notification_preferences: {
        Row: {
          user_id: string
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
          gym_reminders_enabled: boolean
          finance_reminders_enabled: boolean
          updated_at: string
        }
        Insert: Partial<{
          user_id: string
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
          gym_reminders_enabled: boolean
          finance_reminders_enabled: boolean
        }>
        Update: Partial<{
          reminders_enabled: boolean
          one_hour_reminder_enabled: boolean
          noon_summary_enabled: boolean
          gym_reminders_enabled: boolean
          finance_reminders_enabled: boolean
        }>
        Relationships: never[]
      }
      reminder_deliveries: {
        Row: {
          id: string
          user_id: string
          kind: 'one_hour' | 'noon_summary'
          /** The habit occurrence for a one hour reminder; null for the summary. */
          subject_id: string | null
          occurrence_date: string
          delivered_at: string
        }
        Insert: {
          user_id: string
          kind: 'one_hour' | 'noon_summary'
          subject_id?: string | null
          occurrence_date: string
        }
        Update: Partial<{ occurrence_date: string }>
        Relationships: never[]
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          icon: string | null
          category: string
          archived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          icon?: string | null
          category?: string
          archived?: boolean
        }
        Update: Partial<{
          name: string
          description: string | null
          icon: string | null
          category: string
          archived: boolean
        }>
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
          /** The gym habit this workout belongs to. Decided at creation, 0009. */
          habit_id: string | null
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
          habit_id?: string | null
          workout_date: string
          duration_minutes?: number | null
          notes?: string | null
          completed?: boolean
        }
        Update: Partial<{
          duration_minutes: number | null
          notes: string | null
          completed: boolean
          habit_id: string | null
          routine_id: string | null
          started_at: string | null
          ended_at: string | null
        }>
        Relationships: never[]
      }
      programs: {
        Row: { id: string; user_id: string; name: string; notes: string | null; archived: boolean; sort_order: number; created_at: string }
        Insert: { user_id: string; name: string; notes?: string | null; archived?: boolean; sort_order?: number }
        Update: Partial<{ name: string; notes: string | null; archived: boolean; sort_order: number }>
        Relationships: never[]
      }
      routines: {
        Row: { id: string; user_id: string; program_id: string | null; name: string; routine_note: string | null; archived: boolean; sort_order: number; created_at: string }
        Insert: { user_id: string; program_id?: string | null; name: string; routine_note?: string | null; archived?: boolean; sort_order?: number }
        Update: Partial<{ name: string; routine_note: string | null; archived: boolean; sort_order: number }>
        Relationships: never[]
      }
      routine_exercises: {
        Row: { id: string; user_id: string; routine_id: string; name: string; measure: 'weight_reps' | 'reps' | 'duration' | 'distance'; target_sets: number | null; notes: string | null; sort_order: number }
        Insert: { id?: string; user_id: string; routine_id: string; name: string; measure?: 'weight_reps' | 'reps' | 'duration' | 'distance'; target_sets?: number | null; notes?: string | null; sort_order?: number }
        Update: Partial<{ name: string; measure: 'weight_reps' | 'reps' | 'duration' | 'distance'; target_sets: number | null; notes: string | null; sort_order: number }>
        Relationships: never[]
      }
      workout_sets: {
        Row: { id: string; user_id: string; workout_exercise_id: string; set_number: number; weight_grams: number | null; reps: number | null; duration_seconds: number | null; distance_metres: number | null; completed: boolean; created_at: string }
        Insert: { user_id: string; workout_exercise_id: string; set_number: number; weight_grams?: number | null; reps?: number | null; duration_seconds?: number | null; distance_metres?: number | null; completed?: boolean }
        Update: Partial<{ weight_grams: number | null; reps: number | null; duration_seconds: number | null; distance_metres: number | null; completed: boolean }>
        Relationships: never[]
      }
      workout_exercise_totals: {
        Row: { workout_exercise_id: string; workout_id: string; user_id: string; name: string; measure: 'weight_reps' | 'reps' | 'duration' | 'distance'; set_count: number; total_reps: number; volume_grams: number; total_seconds: number; total_metres: number; best_weight_grams: number | null; best_reps: number | null }
        Insert: never
        Update: never
        Relationships: never[]
      }
      workout_totals: {
        Row: { workout_id: string; user_id: string; workout_date: string; completed: boolean; exercise_count: number; set_count: number; total_reps: number; volume_grams: number; total_seconds: number; total_metres: number; duration_minutes: number | null }
        Insert: never
        Update: never
        Relationships: never[]
      }
      exercise_records: {
        Row: { user_id: string; key: string; name: string; best_weight_grams: number | null; best_reps: number | null; best_volume_grams: number; last_done: string | null }
        Insert: never
        Update: never
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
          measure?: 'weight_reps' | 'reps' | 'duration' | 'distance'
          routine_exercise_id?: string | null
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
          account_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount_centavos: number
          source: string
          entry_date: string
          note?: string | null
          account_id?: string | null
        }
        Update: Partial<{
          amount_centavos: number
          source: string
          entry_date: string
          note: string | null
          account_id: string | null
        }>
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
          account_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount_centavos: number
          category: string
          entry_date: string
          description?: string | null
          account_id?: string | null
        }
        Update: Partial<{
          amount_centavos: number
          category: string
          entry_date: string
          description: string | null
          account_id: string | null
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
          /** Out of the active list, still holding its balance. Added in 0008. */
          archived: boolean
          id: string
          user_id: string
          name: string
          goal_amount_centavos: number | null
          balance_centavos: number
          color: string
          icon: string
          account_id: string | null
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
          account_id?: string | null
        }
        Update: Partial<{
          name: string
          goal_amount_centavos: number | null
          color: string
          icon: string
          account_id: string | null
        }>
        Relationships: never[]
      }
      savings_transactions: {
        Row: {
          /** Manila date the movement belongs to. Added in 0007. */
          entry_date: string
          id: string
          category_id: string
          user_id: string
          type: 'deposit' | 'withdrawal'
          amount_centavos: number
          note: string | null
          counter_account_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          user_id: string
          type: 'deposit' | 'withdrawal'
          amount_centavos: number
          note?: string | null
          counter_account_id?: string | null
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
          account_id: string | null
          entry_date: string
          created_at: string
        }
        Insert: {
          id?: string
          debt_id: string
          user_id: string
          amount_centavos: number
          note?: string | null
          account_id?: string | null
          entry_date?: string
        }
        Update: never
        Relationships: never[]
      }
      finance_accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          flow: 'outgoing' | 'savings' | 'both'
          color: string
          icon: string
          is_builtin: boolean
          archived: boolean
          sort_order: number
          starting_balance_centavos: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          flow?: 'outgoing' | 'savings' | 'both'
          color?: string
          icon?: string
          is_builtin?: boolean
          archived?: boolean
          sort_order?: number
          starting_balance_centavos?: number
        }
        Update: Partial<{
          name: string
          flow: 'outgoing' | 'savings' | 'both'
          color: string
          icon: string
          archived: boolean
          sort_order: number
          starting_balance_centavos: number
        }>
        Relationships: never[]
      }
      transfers: {
        Row: {
          id: string
          user_id: string
          from_account_id: string | null
          to_account_id: string | null
          amount_centavos: number
          entry_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_account_id?: string | null
          to_account_id?: string | null
          amount_centavos: number
          entry_date: string
          note?: string | null
        }
        Update: Partial<{
          from_account_id: string | null
          to_account_id: string | null
          amount_centavos: number
          entry_date: string
          note: string | null
        }>
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
    Views: {
      /**
       * One balance per account, derived in the database from the entries
       * themselves rather than stored on the account. A stored balance has to be
       * kept in step by every write path and drifts the first time one is missed.
       */
      finance_account_balances: {
        Row: {
          id: string
          user_id: string
          balance_centavos: number
        }
        Relationships: never[]
      }
    }
    Functions: {
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      ensure_default_finance_categories: { Args: Record<string, never>; Returns: undefined }
      ensure_default_finance_accounts: { Args: Record<string, never>; Returns: undefined }
      record_debt_payment: {
        Args: {
          p_debt_id: string
          p_amount_centavos: number
          p_note?: string | null
          p_account_id?: string | null
          p_entry_date?: string | null
        }
        Returns: Database['public']['Tables']['debts']['Row']
      }
      record_savings_transaction: {
        Args: {
          p_category_id: string
          p_type: 'deposit' | 'withdrawal'
          p_amount_centavos: number
          p_note?: string | null
          p_counter_account_id?: string | null
          /** Null lets the database stamp today in Manila. */
          p_entry_date?: string | null
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
      /** Which gym habit a date belongs to. Deterministic, unlike the old search. */
      previous_exercise_sets: {
        Args: { p_name: string; p_before: string }
        Returns: Array<{ workout_date: string; set_number: number; weight_grams: number | null; reps: number | null; duration_seconds: number | null; distance_metres: number | null }>
      }
      resolve_gym_habit: { Args: { p_date: string }; Returns: string | null }
      schedule_applies_on: { Args: { p_schedule_id: string; p_date: string }; Returns: boolean }
      /** Deletes a goal, refusing outright if money would be lost. */
      delete_savings_goal: {
        Args: {
          p_goal_id: string
          p_disposition?: 'empty' | 'move' | 'withdraw'
          p_target_goal_id?: string | null
          p_target_account_id?: string | null
        }
        Returns: { action: 'deleted' | 'moved' | 'withdrawn'; amount: number }
      }
      set_savings_goal_archived: {
        Args: { p_goal_id: string; p_archived: boolean }
        Returns: Database['public']['Tables']['savings_categories']['Row']
      }
      complete_workout: {
        Args: { p_workout_id: string }
        Returns: Database['public']['Tables']['workouts']['Row']
      }
      /**
       * Undoes one month. Balances are reversed before the history is deleted,
       * so a debt paid down 5,000 in the month goes back up by 5,000.
       */
      reset_this_month: {
        Args: { p_month: string; p_include_budget?: boolean }
        Returns: {
          habits: number
          workouts: number
          income: number
          expenses: number
          transfers: number
          savings: number
          debtPayments: number
        }
      }
      /** Clears the data, keeps the login. Separate from delete_my_account. */
      reset_everything: { Args: Record<string, never>; Returns: undefined }
      /** Removes the login itself, which cascades to everything else. */
      delete_my_account: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: Record<string, never>
  }
}
