// src/contexts/NotificationsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';

interface TabCounts {
  jobs: number;
  pipeline: number;
  messages: number;
  tests: number;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  tabCounts: TabCounts;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markByEntity: (entityId: string, type?: string) => Promise<void>;
  // Compatibility aliases so existing code keeps compiling
  markAsReadByEntity: (entityId: string, type?: string) => Promise<void>;
  markAsReadByType: (type: string) => Promise<void>;
  markMessageNotificationsAsRead: (senderId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    jobs: 0,
    pipeline: 0,
    messages: 0,
    tests: 0,
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchNotifications error:', error);
      return;
    }
    setNotifications(data || []);
  }, [user?.id]);

  const fetchUnreadCount = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) {
      console.error('fetchUnreadCount error:', error);
      return unreadCount;
    }
    return count ?? 0;
  }, [user?.id, unreadCount]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('markAsRead error:', error);
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    },
    [user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    // Try RPC if available
    const rpcRes = await supabase.rpc('mark_all_notifications_as_read').catch(() => null);
    if (!rpcRes || (rpcRes as any).error) {
      // Fallback
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) {
        console.error('markAllAsRead (fallback) error:', error);
        return;
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user?.id]);

  const markByEntity = useCallback(
    async (entityId: string, type?: string) => {
      if (!user?.id) return;
      let q = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('entity_id', entityId)
        .eq('is_read', false);
      if (type) q = q.eq('type', type);
      const { error } = await q;
      if (error) {
        console.error('markByEntity error:', error);
        return;
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.entity_id === entityId && (!type || n.type === type)
            ? { ...n, is_read: true }
            : n
        )
      );
    },
    [user?.id]
  );

  const markAsReadByEntity = useCallback(
    async (entityId: string, type?: string) => {
      // Compatibility alias
      return markByEntity(entityId, type);
    },
    [markByEntity]
  );

  const markAsReadByType = useCallback(
    async (type: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('is_read', false);

      if (error) {
        console.error('markAsReadByType error:', error);
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.type === type && !n.is_read ? { ...n, is_read: true } : n))
      );
    },
    [user?.id]
  );

  const markMessageNotificationsAsRead = useCallback(
    async (senderId: string) => {
      if (!user?.id) return;

      // Prefer RPC if present
      const rpcRes = await supabase
        .rpc('mark_message_notifications_by_sender', { p_sender_id: senderId })
        .catch(() => null);

      if (rpcRes && !(rpcRes as any).error) {
        // Mark all message-type notifications as read locally where possible
        setNotifications((prev) =>
          prev.map((n) => (n.type === 'message' ? { ...n, is_read: true } : n))
        );
        return;
      }

      // Fallback path: find messages from sender -> mark their linked notifications
      const { data: msgs, error: fetchErr } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('sender_id', senderId);

      if (fetchErr) {
        console.error('markMessageNotificationsAsRead fetch messages error:', fetchErr);
        return;
      }

      const ids = (msgs || []).map((m) => m.id);
      if (ids.length === 0) return;

      const { error: updErr } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'message')
        .in('entity_id', ids)
        .eq('is_read', false);

      if (updErr) {
        console.error('markMessageNotificationsAsRead update error:', updErr);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.type === 'message' && ids.includes(n.entity_id) ? { ...n, is_read: true } : n
        )
      );
    },
    [user?.id]
  );

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  // Optionally compute tabCounts here if you have defined mappings per type
  useEffect(() => {
    // Example: you can wire real counts by type/category here if needed
    setTabCounts((prev) => ({ ...prev }));
  }, [notifications]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    tabCounts,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    markByEntity,
    markAsReadByEntity,
    markAsReadByType,
    markMessageNotificationsAsRead,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
