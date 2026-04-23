/**
 * types/database.ts
 * Normalmente generado por: npm run db:types
 * Este archivo se mantiene actualizado con el esquema de Supabase.
 * Regenerar cada vez que se modifique el esquema de base de datos.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          age: number | null
          weight_kg: number | null
          height_cm: number | null
          activity_level: 'sedentario' | 'moderado' | 'activo' | null
          goal: 'recomposicion' | 'bajar' | 'ganar' | null
          monthly_income: number | null
          pay_day: number | null
          city: string | null
          pets: Json
          preferences: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      cost_centers: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          type: 'gasto_fijo' | 'variable' | 'ahorro' | 'meta'
          monthly_amount: number
          description: string | null
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cost_centers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cost_centers']['Insert']>
      }
      monthly_budget: {
        Row: {
          id: string
          user_id: string
          cost_center_id: string
          year_month: string
          budgeted: number
          spent: number
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['monthly_budget']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['monthly_budget']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          name: string
          type: 'supermercado' | 'feria' | 'online' | 'servicio' | 'banco' | 'combustible' | 'farmacia' | 'restaurant' | 'transporte' | 'entretenimiento' | 'comercio' | null
          base_url: string | null
          search_url_pattern: string | null
          logo_url: string | null
          is_active: boolean
          user_id: string | null
          category: string | null
          razones_sociales: string[]
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      provider_aliases: {
        Row: {
          id: string
          supplier_id: string
          alias: string
          user_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['provider_aliases']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['provider_aliases']['Insert']>
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          brand: string | null
          category: string
          type: 'comestible' | 'bebestible' | 'aseo' | 'mascotas' | 'suplemento'
          format: string | null
          unit: string
          quantity: number
          shelf_life_days: number | null
          doses: number | null
          storage_location: string | null
          is_breakfast: boolean
          is_lunch: boolean
          is_dinner: boolean
          is_snack: boolean
          description: string | null
          comparison_notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_suppliers: {
        Row: {
          id: string
          product_id: string
          supplier_id: string
          product_url: string | null
          sku: string | null
          is_available: boolean
          last_checked_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['product_suppliers']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['product_suppliers']['Insert']>
      }
      price_history: {
        Row: {
          id: string
          product_id: string
          supplier_id: string
          price_clp: number
          recorded_at: string
          source: 'manual' | 'ai_search' | 'purchase'
          is_on_sale: boolean
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>
      }
      stock: {
        Row: {
          id: string
          user_id: string
          product_id: string
          current_qty: number
          unit: string | null
          min_qty: number
          expiry_date: string | null
          last_purchase_at: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stock']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          user_id: string
          status: 'draft' | 'pending' | 'confirmed' | 'cancelled'
          supplier_id: string | null
          total_clp: number | null
          cost_center_id: string | null
          purchased_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          supplier_id: string | null
          qty: number
          unit_price_clp: number
          total_price_clp: number
          is_on_sale: boolean
        }
        Insert: Omit<Database['public']['Tables']['purchase_items']['Row'], 'id' | 'total_price_clp'>
        Update: Partial<Database['public']['Tables']['purchase_items']['Insert']>
      }
      recipes: {
        Row: {
          id: string
          user_id: string
          name: string
          meal_type: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
          parent_recipe_id: string | null
          prep_time_min: number | null
          kcal: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          instructions: string | null
          external_url: string | null
          is_active: boolean
        }
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['recipes']['Insert']>
      }
      recipe_ingredients: {
        Row: {
          id: string
          recipe_id: string
          product_id: string
          qty_required: number
          unit: string | null
          is_optional: boolean
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['recipe_ingredients']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['recipe_ingredients']['Insert']>
      }
      meal_plan: {
        Row: {
          id: string
          user_id: string
          plan_date: string
          meal_type: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
          recipe_id: string | null
          free_text: string | null
          mode: 'home' | 'bought' | 'invited' | 'skipped'
          actual_cost_clp: number | null
          actual_kcal: number | null
          cost_center_id: string | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['meal_plan']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['meal_plan']['Insert']>
      }
      cleaning_tasks: {
        Row: {
          id: string
          user_id: string
          name: string
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | null
          preferred_day: string | null
          products_needed: Json
          duration_min: number | null
          is_active: boolean
        }
        Insert: Omit<Database['public']['Tables']['cleaning_tasks']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['cleaning_tasks']['Insert']>
      }
      task_log: {
        Row: {
          id: string
          task_id: string
          user_id: string
          done_at: string
          duration_min: number | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['task_log']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['task_log']['Insert']>
      }
      ai_usage: {
        Row: {
          id: string
          user_id: string
          date: string
          count: number
        }
        Insert: Omit<Database['public']['Tables']['ai_usage']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['ai_usage']['Insert']>
      }
      bank_connections: {
        Row: {
          id: string
          user_id: string
          fintoc_link_id: string
          institution: string
          holder_type: string | null
          status: 'active' | 'inactive' | 'error'
          last_sync_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_connections']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_connections']['Insert']>
      }
      bank_accounts: {
        Row: {
          id: string
          connection_id: string
          user_id: string
          fintoc_account_id: string
          name: string
          type: string | null
          currency: string
          balance_available: number
          balance_current: number
          refreshed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>
      }
      bank_transactions: {
        Row: {
          id: string
          account_id: string
          user_id: string
          fintoc_transaction_id: string
          amount: number
          currency: string
          description: string | null
          transaction_date: string
          merchant_name: string | null
          category_gdv: string | null
          cost_center_id: string | null
          supplier_id: string | null
          document_type: 'cartola' | 'tarjeta_credito' | null
          is_expense: boolean
          ai_classified: boolean
          manually_reviewed: boolean
          raw_data: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_transactions']['Insert']>
      }
      mantencion_entries: {
        Row: {
          id: string
          user_id: string
          nombre: string
          monto: number
          supplier_id: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nombre?: string
          monto?: number
          supplier_id?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre?: string
          monto?: number
          supplier_id?: string | null
          activo?: boolean
          created_at?: string
        }
      }
    }
  }
}

// ─── Tipos derivados convenientes ───────────────────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Aliases cortos
export type User           = Tables<'users'>
export type CostCenter     = Tables<'cost_centers'>
export type MonthlyBudget  = Tables<'monthly_budget'>
export type Supplier       = Tables<'suppliers'>
export type Product        = Tables<'products'>
export type ProductSupplier= Tables<'product_suppliers'>
export type PriceHistory   = Tables<'price_history'>
export type Stock          = Tables<'stock'>
export type PurchaseOrder  = Tables<'purchase_orders'>
export type PurchaseItem   = Tables<'purchase_items'>
export type Recipe         = Tables<'recipes'>
export type RecipeIngredient = Tables<'recipe_ingredients'>
export type MealPlan       = Tables<'meal_plan'>
export type CleaningTask      = Tables<'cleaning_tasks'>
export type TaskLog           = Tables<'task_log'>
export type AiUsage           = Tables<'ai_usage'>
export type BankConnection    = Tables<'bank_connections'>
export type BankAccount       = Tables<'bank_accounts'>
export type BankTransaction   = Tables<'bank_transactions'>
export type ProviderAlias     = Tables<'provider_aliases'>
export type MantencionEntry   = Tables<'mantencion_entries'>

// Supplier type para uso en banco (más genérico)
export type SupplierType = Database['public']['Tables']['suppliers']['Row']['type']
