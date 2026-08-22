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
      badges: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
          rarity: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          rarity?: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          rarity?: string
          slug?: string
        }
        Relationships: []
      }
      channel_read_states: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string
          last_read_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_read_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_read_states_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          server_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          server_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          server_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          dm_high: string | null
          dm_low: string | null
          id: string
          name: string | null
          owner_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          dm_high?: string | null
          dm_low?: string | null
          id?: string
          name?: string | null
          owner_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          dm_high?: string | null
          dm_low?: string | null
          id?: string
          name?: string | null
          owner_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
          user_high: string | null
          user_low: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          cover_url: string | null
          created_at: string
          icon_url: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      member_roles: {
        Row: {
          created_at: string
          id: string
          member_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "server_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          author_id: string
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          reply_to_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          channel_id: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          custom_status: string | null
          display_name: string
          id: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          accent_color?: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_status?: string | null
          display_name: string
          id: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          accent_color?: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_status?: string | null
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          permissions: Json
          position: number
          server_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          permissions?: Json
          position?: number
          server_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
          position?: number
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          id: string
          reason: string | null
          server_id: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          server_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_bans_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          server_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          server_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          server_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_invites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          nickname: string | null
          server_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_favorite_games: {
        Row: {
          created_at: string
          game_id: string
          id: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_game_presence: {
        Row: {
          game_id: string | null
          metadata: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          game_id?: string | null
          metadata?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          game_id?: string | null
          metadata?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_presence_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accent_color: string
          animations_enabled: boolean
          created_at: string
          glow_enabled: boolean
          input_device_id: string | null
          input_mode: string
          input_volume: number
          output_device_id: string | null
          output_volume: number
          ptt_key: string
          sounds_enabled: boolean
          transparency_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          animations_enabled?: boolean
          created_at?: string
          glow_enabled?: boolean
          input_device_id?: string | null
          input_mode?: string
          input_volume?: number
          output_device_id?: string | null
          output_volume?: number
          ptt_key?: string
          sounds_enabled?: boolean
          transparency_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          animations_enabled?: boolean
          created_at?: string
          glow_enabled?: boolean
          input_device_id?: string | null
          input_mode?: string
          input_volume?: number
          output_device_id?: string | null
          output_volume?: number
          ptt_key?: string
          sounds_enabled?: boolean
          transparency_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_group_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      award_xp: {
        Args: { _amount: number; _user_id: string }
        Returns: {
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "user_xp"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      block_user: { Args: { _target: string }; Returns: boolean }
      can_manage_server: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      channel_server_id: { Args: { _channel_id: string }; Returns: string }
      create_group_conversation: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
      }
      create_server: {
        Args: { _description?: string; _icon_url?: string; _name: string }
        Returns: string
      }
      create_server_invite: {
        Args: {
          _expires_in_hours?: number
          _max_uses?: number
          _server_id: string
        }
        Returns: string
      }
      dm_conversation_id: { Args: { _message_id: string }; Returns: string }
      get_invite_preview: {
        Args: { _code: string }
        Returns: {
          already_member: boolean
          member_count: number
          reason: string
          server_description: string
          server_icon_url: string
          server_id: string
          server_name: string
          valid: boolean
        }[]
      }
      get_or_create_direct_conversation: {
        Args: { _other: string }
        Returns: string
      }
      grant_badge: {
        Args: { _slug: string; _user_id: string }
        Returns: boolean
      }
      has_channel_permission: {
        Args: { _channel_id: string; _perm: string; _user_id: string }
        Returns: boolean
      }
      has_friendship_link: {
        Args: { _other: string; _user_id: string }
        Returns: boolean
      }
      has_server_role: {
        Args: { _roles: string[]; _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_banned: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_owner: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_text_channel: { Args: { _channel_id: string }; Returns: boolean }
      join_server_by_invite: { Args: { _code: string }; Returns: string }
      leave_group_conversation: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      level_from_xp: { Args: { _xp: number }; Returns: number }
      list_conversation_overviews: {
        Args: never
        Returns: {
          avatar_url: string
          id: string
          last_message_at: string
          last_message_content: string
          last_message_sender: string
          last_read_at: string
          member_count: number
          name: string
          other_user_id: string
          owner_id: string
          type: string
          unread_count: number
          updated_at: string
        }[]
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      member_server_id: { Args: { _member_id: string }; Returns: string }
      message_channel_id: { Args: { _message_id: string }; Returns: string }
      remove_group_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      respond_friend_request: {
        Args: { _action: string; _friendship_id: string }
        Returns: boolean
      }
      search_profiles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          status: string
          username: string
        }[]
      }
      send_friend_request: { Args: { _addressee: string }; Returns: string }
      shares_conversation_with: {
        Args: { _other: string; _user_id: string }
        Returns: boolean
      }
      shares_server_with: {
        Args: { _other_user: string; _user_id: string }
        Returns: boolean
      }
      xp_for_level: { Args: { _level: number }; Returns: number }
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
