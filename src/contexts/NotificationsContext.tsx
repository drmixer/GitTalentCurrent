import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string | null;
  body?: string | null;
  type?: string | null;
  is_read: boolean;
  created_at: string;
  sender_id?: string | null;
  conversation_id?: string | null;
};

type Ctx = {
  // Full raw notifications as returned by DB
  notifications: NotificationRow[];
  // List prepared for display (deduped/filtered)
  displayNotifications: NotificationRow[];
  // Badge count (based on display list)
  unreadCount: number;
  // Refresh from server
  refresh: () => Promise<void>;
  // Mark single
  markAsRead: (id: string) => Promise<void>;
  // Mark all
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx | undefined>(undefined);

function isMessageType(n: NotificationRow): boolean {
  const t = (n.type || "").toLowerCase();
  return ["message", "message:new", "message_received", "chat_message"].includes(t);
}

function isSummaryTitle(title?: string | null): boolean {
  if (!title) return false;
  return /^new message from /i.test(title.trim());
}

/**
 * Returns the list that should be shown in the dropdown:
 * - For message-type notifications, only keep those whose title starts with "New message from".
 * - For non-message notifications, keep as-is.
 * Also ensures a stable sort by created_at desc.
 */
function filterForDisplay(notifications: NotificationRow[]): NotificationRow[] {
  const filtered = notifications.filter((n) => {
    if (isMessageType(n)) {
      return isSummaryTitle(n.title);
    }
    // non-message notifications remain
    return true;
  });

  // In the unlikely case multiple summaries exist for nearly the same event,
  // keep the latest per (conversation_id || sender_id) per minute.
  const seen = new Set<string>();
  const result: NotificationRow[] = [];
  for (const n of filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    const key =
      (n.conversation_id || n.sender_id || "unknown") +
      ":" +
      new Date(n.created_at).toISOString().slice(0, 16); // minute bucket
    if (!seen.has(key)) {
      seen.add(key);
      result.push(n);
    }
  }
  return result;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return;
      }
      setNotifications((data || []) as NotificationRow[]);
    } catch (e) {
      console.error("Unexpected error fetching notifications:", e);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id || loadingRef.current) return;
    loadingRef.current = true;
    refresh().finally(() => {
      loadingRef.current = false;
    });
  }, [userProfile?.id, refresh]);

  // Realtime updates (optional but recommended)
  useEffect(() => {
    if (!userProfile?.id) return;
    const channel = supabase
      .channel(`notifications_${userProfile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userProfile.id}` },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, refresh]);

  const displayNotifications = useMemo(
    () => filterForDisplay(notifications),
    [notifications]
  );

  // Badge count is based on the filtered list
  const unreadCount = useMemo(
    () => displayNotifications.filter((n) => !n.is_read).length,
    [displayNotifications]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userProfile?.id || "");

        if (error) {
          console.error("Failed to mark as read:", error);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      } catch (e) {
        console.error("Unexpected error marking as read:", e);
      }
    },
    [userProfile?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      // Update all unread for the user
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userProfile.id)
        .eq("is_read", false);

      if (error) {
        console.error("Failed to mark all as read:", error);
        return;
      }

      // Optimistic local update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Unexpected error marking all as read:", e);
    }
  }, [userProfile?.id]);

  const value: Ctx = {
    notifications,
    displayNotifications,
    unreadCount,
    refresh,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
