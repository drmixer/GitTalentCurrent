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
  sender_id?: string | null;
  conversation_id?: string | null;
  // Optional fields sometimes present in your app
  message_preview?: string | null;
};

type TabCounts = {
  jobs: number;
  pipeline: number;
  messages: number;
  other: number;
};

type Ctx = {
  // Raw notifications from DB
  notifications: NotificationRow[];
  // List prepared for the dropdown (filtered to message summaries + others)
  displayNotifications: NotificationRow[];
  // Unread count for the dropdown (based on displayNotifications)
  unreadCount: number;
  // Total unread count (all notifications)
  unreadTotal: number;
  // Counts used by RecruiterDashboard tabs
  tabCounts: TabCounts;

  // Refresh from server
  refresh: () => Promise<void>;

  // Mark a single notification as read
  markAsRead: (id: string) => Promise<void>;

  // Mark all notifications for the user as read
  markAllAsRead: () => Promise<void>;

  // Mark all notifications of a given type as read (back-compat API)
  markAsReadByType: (type: string) => Promise<void>;
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
 * Also ensures a stable sort by created_at desc, deduping near-duplicate message summaries.
 */
function filterForDisplay(notifications: NotificationRow[]): NotificationRow[] {
  const filtered = notifications.filter((n) => {
    if (isMessageType(n)) {
      return isSummaryTitle(n.title);
    }
    return true; // keep non-message notifications
  });

  // Dedupe by (conversation_id || sender_id) per minute bucket
  const seen = new Set<string>();
  const result: NotificationRow[] = [];
  for (const n of filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    const key =
      (n.conversation_id || n.sender_id || "unknown") +
      ":" +
      new Date(n.created_at).toISOString().slice(0, 16);
    if (!seen.has(key)) {
      seen.add(key);
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
    } else if (["message", "message:new", "message_received", "chat_message"].includes(t)) {
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

  // Realtime subscription
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

  // Badge count used by the dropdown and (optionally) header bell
  const unreadCount = useMemo(
    () => displayNotifications.filter((n) => !n.is_read).length,
    [displayNotifications]
  );

  const tabCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.is_read);
    return computeTabCounts(unread);
  }, [notifications]);

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
            n.type?.toLowerCase() === type.toLowerCase() ? { ...n, is_read: true } : n
          )
        );
      } catch (e) {
        console.error(`Unexpected error marking type "${type}" as read:`, e);
      }
    },
    [userProfile?.id]
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
    // Provide a non-crashing fallback if used outside provider
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
    };
  }
  return ctx;
}
