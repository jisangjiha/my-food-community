/**
 * Supabase 스키마에서 생성된 타입. 직접 수정하지 않는다.
 *
 * 재생성:
 *   supabase gen types typescript --project-id ickpwrfzufhriennfwhc > src/lib/supabase/database.types.ts
 *   (또는 Supabase MCP의 generate_typescript_types)
 *
 * 이 타입은 BFF 내부 전용이다. UI/클라이언트로는 `src/lib/**`의 DTO만 내려보낸다.
 */
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      payment: {
        Row: {
          amount: number
          cancellation_id: string | null
          created_at: string
          id: string
          payment_snapshot_id: number | null
          product_id: number | null
          transaction_key: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          cancellation_id?: string | null
          created_at?: string
          id?: string
          payment_snapshot_id?: number | null
          product_id?: number | null
          transaction_key: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          cancellation_id?: string | null
          created_at?: string
          id?: string
          payment_snapshot_id?: number | null
          product_id?: number | null
          transaction_key?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_payment_snapshot_id_fkey"
            columns: ["payment_snapshot_id"]
            isOneToOne: false
            referencedRelation: "payment_snapshot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_snapshot: {
        Row: {
          created_at: string
          id: number
          snapshot_payment: Json
          snapshot_product: Json
        }
        Insert: {
          created_at?: string
          id?: number
          snapshot_payment: Json
          snapshot_product: Json
        }
        Update: {
          created_at?: string
          id?: number
          snapshot_payment?: Json
          snapshot_product?: Json
        }
        Relationships: []
      }
      place: {
        Row: {
          address: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string | null
          title: string
          user_id: string
        }
        Insert: {
          address?: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          title: string
          user_id: string
        }
        Update: {
          address?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      place_image: {
        Row: {
          created_at: string
          id: string
          image_path: string
          place_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          place_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_image_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string
          description: string | null
          event_at: string | null
          id: number
          image_path_detail_lg: string | null
          image_path_detail_md: string | null
          image_path_main_lg: string | null
          image_path_main_md: string | null
          name: string | null
          price: number | null
          status: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          event_at?: string | null
          id?: number
          image_path_detail_lg?: string | null
          image_path_detail_md?: string | null
          image_path_main_lg?: string | null
          image_path_main_md?: string | null
          name?: string | null
          price?: number | null
          status?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          event_at?: string | null
          id?: number
          image_path_detail_lg?: string | null
          image_path_detail_md?: string | null
          image_path_main_lg?: string | null
          image_path_main_md?: string | null
          name?: string | null
          price?: number | null
          status?: string | null
        }
        Relationships: []
      }
      profile: {
        Row: {
          created_at: string
          id: number
          image_path: string | null
          nickname: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          image_path?: string | null
          nickname: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          image_path?: string | null
          nickname?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_cancellation: {
        Args: {
          p_amount: number
          p_cancellation_id: string
          p_snapshot_payment: Json
          p_snapshot_product: Json
          p_transaction_key: string
          p_user_id: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount: number
          p_product_id: number
          p_snapshot_payment: Json
          p_snapshot_product: Json
          p_transaction_key: string
          p_user_id: string
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
