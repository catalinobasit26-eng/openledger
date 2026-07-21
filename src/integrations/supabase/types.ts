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
      analytics_daily: {
        Row: {
          day: string
          new_merchants: number
          new_users: number
          nft_sales: number
          openpay_tx: number
          openpaypro_tx: number
          swaps: number
          transactions: number
          volume: number
        }
        Insert: {
          day: string
          new_merchants?: number
          new_users?: number
          nft_sales?: number
          openpay_tx?: number
          openpaypro_tx?: number
          swaps?: number
          transactions?: number
          volume?: number
        }
        Update: {
          day?: string
          new_merchants?: number
          new_users?: number
          nft_sales?: number
          openpay_tx?: number
          openpaypro_tx?: number
          swaps?: number
          transactions?: number
          volume?: number
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: number
          ip: string | null
          latency_ms: number | null
          metadata: Json
          method: string
          status: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: number
          ip?: string | null
          latency_ms?: number | null
          metadata?: Json
          method: string
          status: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: number
          ip?: string | null
          latency_ms?: number | null
          metadata?: Json
          method?: string
          status?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target?: string | null
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          reason: string
          resolved: boolean
          severity: string
          transaction_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          resolved?: boolean
          severity?: string
          transaction_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          resolved?: boolean
          severity?: string
          transaction_hash?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          last_sync_count: number
          last_sync_error: string | null
          last_sync_status: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_count?: number
          last_sync_error?: string | null
          last_sync_status?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_count?: number
          last_sync_error?: string | null
          last_sync_status?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ledger_blocks: {
        Row: {
          block_number: number
          created_at: string
          hash: string
          previous_hash: string
          tx_count: number
        }
        Insert: {
          block_number?: number
          created_at?: string
          hash: string
          previous_hash: string
          tx_count?: number
        }
        Update: {
          block_number?: number
          created_at?: string
          hash?: string
          previous_hash?: string
          tx_count?: number
        }
        Relationships: []
      }
      ledger_transactions: {
        Row: {
          amount: number
          block_number: number
          created_at: string
          currency: string
          external_ref: string | null
          from_address: string | null
          hash: string
          id: string
          merchant_id: string | null
          metadata: Json
          network_fee: number
          previous_hash: string
          source: Database["public"]["Enums"]["source_platform"]
          status: Database["public"]["Enums"]["tx_status"]
          to_address: string | null
          ts: string
          type: Database["public"]["Enums"]["tx_type"]
          verified: boolean
        }
        Insert: {
          amount?: number
          block_number: number
          created_at?: string
          currency?: string
          external_ref?: string | null
          from_address?: string | null
          hash: string
          id?: string
          merchant_id?: string | null
          metadata?: Json
          network_fee?: number
          previous_hash: string
          source: Database["public"]["Enums"]["source_platform"]
          status?: Database["public"]["Enums"]["tx_status"]
          to_address?: string | null
          ts?: string
          type: Database["public"]["Enums"]["tx_type"]
          verified?: boolean
        }
        Update: {
          amount?: number
          block_number?: number
          created_at?: string
          currency?: string
          external_ref?: string | null
          from_address?: string | null
          hash?: string
          id?: string
          merchant_id?: string | null
          metadata?: Json
          network_fee?: number
          previous_hash?: string
          source?: Database["public"]["Enums"]["source_platform"]
          status?: Database["public"]["Enums"]["tx_status"]
          to_address?: string | null
          ts?: string
          type?: Database["public"]["Enums"]["tx_type"]
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_block_number_fkey"
            columns: ["block_number"]
            isOneToOne: false
            referencedRelation: "ledger_blocks"
            referencedColumns: ["block_number"]
          },
        ]
      }
      merchants: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          total_sales: number
          total_volume: number
          tx_count: number
          verified: boolean
          website: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id: string
          logo_url?: string | null
          name: string
          total_sales?: number
          total_volume?: number
          tx_count?: number
          verified?: boolean
          website?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          total_sales?: number
          total_volume?: number
          tx_count?: number
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      nft_collections: {
        Row: {
          created_at: string
          creator_address: string | null
          description: string | null
          floor_price: number
          id: string
          image_url: string | null
          name: string
          owners: number
          slug: string
          total_supply: number
          volume: number
        }
        Insert: {
          created_at?: string
          creator_address?: string | null
          description?: string | null
          floor_price?: number
          id?: string
          image_url?: string | null
          name: string
          owners?: number
          slug: string
          total_supply?: number
          volume?: number
        }
        Update: {
          created_at?: string
          creator_address?: string | null
          description?: string | null
          floor_price?: number
          id?: string
          image_url?: string | null
          name?: string
          owners?: number
          slug?: string
          total_supply?: number
          volume?: number
        }
        Relationships: []
      }
      nft_transactions: {
        Row: {
          collection_id: string | null
          currency: string
          event_type: string
          from_address: string | null
          id: string
          price: number
          to_address: string | null
          token_id: string
          ts: string
          tx_hash: string | null
        }
        Insert: {
          collection_id?: string | null
          currency?: string
          event_type: string
          from_address?: string | null
          id?: string
          price?: number
          to_address?: string | null
          token_id: string
          ts?: string
          tx_hash?: string | null
        }
        Update: {
          collection_id?: string | null
          currency?: string
          event_type?: string
          from_address?: string | null
          id?: string
          price?: number
          to_address?: string | null
          token_id?: string
          ts?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nft_transactions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nft_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tokens: {
        Row: {
          change_24h: number
          created_at: string
          decimals: number
          holders: number
          logo_url: string | null
          name: string
          price_usd: number
          supply: number
          symbol: string
          transfers_count: number
          volume_24h: number
        }
        Insert: {
          change_24h?: number
          created_at?: string
          decimals?: number
          holders?: number
          logo_url?: string | null
          name: string
          price_usd?: number
          supply?: number
          symbol: string
          transfers_count?: number
          volume_24h?: number
        }
        Update: {
          change_24h?: number
          created_at?: string
          decimals?: number
          holders?: number
          logo_url?: string | null
          name?: string
          price_usd?: number
          supply?: number
          symbol?: string
          transfers_count?: number
          volume_24h?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          balance: number
          created_at: string
          first_seen: string
          label: string | null
          last_seen: string
          tx_count: number
        }
        Insert: {
          address: string
          balance?: number
          created_at?: string
          first_seen?: string
          label?: string | null
          last_seen?: string
          tx_count?: number
        }
        Update: {
          address?: string
          balance?: number
          created_at?: string
          first_seen?: string
          label?: string | null
          last_seen?: string
          tx_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      record_transaction: {
        Args: {
          p_amount: number
          p_currency: string
          p_external_ref?: string
          p_fee?: number
          p_from: string
          p_merchant_id?: string
          p_metadata?: Json
          p_source: Database["public"]["Enums"]["source_platform"]
          p_status?: Database["public"]["Enums"]["tx_status"]
          p_to: string
          p_ts?: string
          p_type: Database["public"]["Enums"]["tx_type"]
        }
        Returns: {
          amount: number
          block_number: number
          created_at: string
          currency: string
          external_ref: string | null
          from_address: string | null
          hash: string
          id: string
          merchant_id: string | null
          metadata: Json
          network_fee: number
          previous_hash: string
          source: Database["public"]["Enums"]["source_platform"]
          status: Database["public"]["Enums"]["tx_status"]
          to_address: string | null
          ts: string
          type: Database["public"]["Enums"]["tx_type"]
          verified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "ledger_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_analytics_daily: { Args: { _day: string }; Returns: undefined }
      refresh_nft_collection_stats: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "auditor" | "support"
      source_platform: "openpay" | "openpay_pro" | "openpay_nft"
      tx_status: "pending" | "confirmed" | "failed" | "reversed"
      tx_type:
        | "payment"
        | "transfer"
        | "swap"
        | "nft_mint"
        | "nft_sale"
        | "merchant_payment"
        | "withdrawal"
        | "deposit"
        | "refund"
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
    Enums: {
      app_role: ["super_admin", "auditor", "support"],
      source_platform: ["openpay", "openpay_pro", "openpay_nft"],
      tx_status: ["pending", "confirmed", "failed", "reversed"],
      tx_type: [
        "payment",
        "transfer",
        "swap",
        "nft_mint",
        "nft_sale",
        "merchant_payment",
        "withdrawal",
        "deposit",
        "refund",
      ],
    },
  },
} as const
