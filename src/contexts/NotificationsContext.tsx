import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  entity_id?: string | null; // ✅ FIX: Added entity_id here
  conversation_id?: string | null;
  message_preview?: string | null;
};

type TabCounts = {
  jobs: number;
  pipeline: number;
  messages: number;
  other: number;
};

type Ctx = {
  notifications: NotificationRow[];
  displayNotifications: NotificationRow[];
  unreadCount: number;   // filtered dropdown count
  unreadTotal: number;   // all unread
  tabCounts: TabCounts;

  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsReadByType: (type: string) => Promise<void>;

  // Legacy APIs expected by Messages and Header
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markMessageNotificationsAsRead: (senderId: string, conversationId?: string) => Promise<void>;
  markAsReadByEntity: (entity: "sender" | string, id: string) => Promise<void>;
};

const NotificationsContext = createContext<Ctx | undefined>(undefined);

function isMessageType(n: NotificationRow): boolean {
  const t = (n.type || "").toLowerCase();
  return t.includes("message");
}

// Dedupe near-duplicates by conversation/sender per minute for display/badge usage
function filterForDisplay(notifications: NotificationRow[]): NotificationRow[] {
  const filtered = notifications.slice();
  const seen = new Set<string>();
  const result: NotificationRow[] = [];
  for (const n of filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    // ✅ FIX: Changed sender_id to entity_id for correct de-duplication
    const dedupeKey =
      (n.conversation_id || n.entity_id || "unknown") +
      ":" +
      new Date(n.created_at).toISOString().slice(0, 16);
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      result.push(n);
    }
  }
  return result;
}

function computeTabCounts(unread: NotificationRow[]): TabCounts {
  const counts: TabCounts = { jobs: 0, pipeline: 0, messages: 0, other: 0 };
  for (const n of unread) {
    const t = (n.type || "").toLowerCase();
    if (t === "job_application") {
      counts.jobs++;
    } else if (t === "test_completion") {
      counts.pipeline++;
    } else if (t.includes("message")) {
      counts.messages++;
    } else {
      counts.other++;
    }
  }
  return counts;
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

  useEffect(() => {
    if (!userProfile?.id) return;
    const channel = supabase
      .channel(`notifications_${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`,
        },
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

  const unreadTotal = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Bell badge: unread in the deduped list
  const unreadCount = useMemo(
    () => displayNotifications.filter((n) => !n.is_read).length,
    [displayNotifications]
  );

  // Deduped unread count for message-type notifications (used to align Messages tab)
  const dedupedUnreadMessages = useMemo(
    () =>
      displayNotifications.filter((n) => !n.is_read && isMessageType(n)).length,
    [displayNotifications]
  );

  // Keep legacy tab counts but override messages with deduped count
  const tabCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.is_read);
    const base = computeTabCounts(unread);
    return { ...base, messages: dedupedUnreadMessages };
  }, [notifications, dedupedUnreadMessages]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userProfile?.id) return;
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userProfile.id);

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
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userProfile.id)
        .eq("is_read", false);

      if (error) {
        console.error("Failed to mark all as read:", error);
        return;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Unexpected error marking all as read:", e);
    }
  }, [userProfile?.id]);

  const markAsReadByType = useCallback(
    async (type: string) => {
      if (!userProfile?.id) return;
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userProfile.id)
          .eq("is_read", false)
          .eq("type", type);

        if (error) {
          console.error(`Failed to mark notifications of type "${type}" as read:`, error);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) =>
            (n.type || "").toLowerCase() === type.toLowerCase() ? { ...n, is_read: true } : n
          )
        );
      } catch (e) {
        console.error(`Unexpected error marking type "${type}" as read:`, e);
      }
    },
    [userProfile?.id]
  );

  const fetchUnreadCount = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const fetchNotifications = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Clear notifications for a specific message thread/sender with robust fallbacks
  const markMessageNotificationsAsRead = useCallback(
    async (senderId: string, conversationId?: string) => {
      if (!userProfile?.id) return;
      try {
        // Prefer conversation_id if we have it
        if (conversationId) {
          const { error: convErr } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userProfile.id)
            .eq("is_read", false)
            .eq("conversation_id", conversationId);

          if (!convErr) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.conversation_id === conversationId ? { ...n, is_read: true } : n
              )
            );
            return;
          }
          console.error("Failed to mark by conversation_id, falling back:", convErr);
        }

        // Select matching IDs (entity-based)
        const { data: rows, error: selErr } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userProfile.id)
          .eq("is_read", false)
          .eq("entity_id", senderId);

        if (selErr) {
          console.error("Failed to select message notifications by sender:", selErr);
        }

        const ids = (rows || []).map((r: any) => r.id);
        if (ids.length > 0) {
          const { error: updErr } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", ids);

          if (!updErr) {
            setNotifications((prev) =>
              prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
            );
            return;
          }
          console.error("Failed to update message notifications by IDs:", updErr);
        }

        // Last-resort fallback: mark all message-type notifications as read for this user
        const { error: typeErr } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userProfile.id)
          .eq("is_read", false)
          .ilike("type", "%message%");

        if (typeErr) {
          console.error("Failed to mark message notifications by type as read:", typeErr);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) => (isMessageType(n) ? { ...n, is_read: true } : n))
        );
      } catch (e) {
        console.error("Unexpected error in markMessageNotificationsAsRead:", e);
      }
    },
    [userProfile?.id]
  );

  const markAsReadByEntity = useCallback(
    async (entity: "sender" | string, id: string) => {
      if (entity === "sender") {
        await markMessageNotificationsAsRead(id);
      } else {
        console.warn(`[Notifications] markAsReadByEntity unsupported entity "${entity}". No action taken.`);
      }
    },
    [markMessageNotificationsAsRead]
  );

  const value: Ctx = {
    notifications,
    displayNotifications,
    unreadCount,
    unreadTotal,
    tabCounts,
    refresh,
    markAsRead,
    markAllAsRead,
    markAsReadByType,
    // legacy:
    fetchUnreadCount,
    fetchNotifications,
    markMessageNotificationsAsRead,
    markAsReadByEntity,
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
    return {
      notifications: [],
      displayNotifications: [],
      unreadCount: 0,
      unreadTotal: 0,
      tabCounts: { jobs: 0, pipeline: 0, messages: 0, other: 0 },
      refresh: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      markAsReadByType: async () => {},
      fetchUnreadCount: async () => {},
      fetchNotifications: async () => {},
      markMessageNotificationsAsRead: async () => {},
      markAsReadByEntity: async () => {},
    };
  }
  return ctx;
}
