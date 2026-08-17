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
      meeting: {
        Row: {
          address: string
          capacity: number
          category_label: string
          closes_at: string
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          max_per_person: number
          price: number
          seats_taken: number
          starts_at: string
          status: string
          summary: string
          title: string
        }
        Insert: {
          address: string
          capacity: number
          category_label: string
          closes_at: string
          created_at?: string
          description: string
          display_order?: number
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          max_per_person?: number
          price: number
          seats_taken?: number
          starts_at: string
          status?: string
          summary: string
          title: string
        }
        Update: {
          address?: string
          capacity?: number
          category_label?: string
          closes_at?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          max_per_person?: number
          price?: number
          seats_taken?: number
          starts_at?: string
          status?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      payment: {
        Row: {
          amount: number
          canceled_at: string | null
          headcount: number
          id: string
          meeting_id: string
          method: string
          order_no: string
          paid_at: string
          refund_amount: number | null
          refund_completes_at: string | null
          refund_rate: number | null
          refund_rule: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          canceled_at?: string | null
          headcount: number
          id?: string
          meeting_id: string
          method?: string
          order_no: string
          paid_at?: string
          refund_amount?: number | null
          refund_completes_at?: string | null
          refund_rate?: number | null
          refund_rule?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          canceled_at?: string | null
          headcount?: number
          id?: string
          meeting_id?: string
          method?: string
          order_no?: string
          paid_at?: string
          refund_amount?: number | null
          refund_completes_at?: string | null
          refund_rate?: number | null
          refund_rule?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting"
            referencedColumns: ["id"]
          },
        ]
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
      cancel_payment: {
        Args: {
          p_payment_id: string
          p_refund_amount: number
          p_refund_rate: number
          p_refund_rule: string
        }
        Returns: undefined
      }
      pay_meeting: {
        Args: { p_headcount: number; p_meeting_id: string }
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
