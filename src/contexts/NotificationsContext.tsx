import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext'; // CORRECTED IMPORT PATH

interface TabCounts {
  messages: number;
  tests: number;
  jobs: number;
  pipeline: number;
}

interface NotificationsContextType {
  unreadCount: number;
  tabCounts: TabCounts;
  fetchUnreadCount: () => Promise<{ unreadCount: number; tabCounts: TabCounts }>;
  markAsReadByEntity: (entityId: string, type: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    messages: 0,
    tests: 0,
    jobs: 0,
    pipeline: 0,
  });

  const fetchUnreadCount = useCallback(async (): Promise<{ unreadCount: number; tabCounts: TabCounts }> => {
    const defaultReturn = { unreadCount: 0, tabCounts: { messages: 0, tests: 0, jobs: 0, pipeline: 0 }};
    try {
      if (!userProfile?.id) return defaultReturn;

      const { data, error } = await supabase
        .from('notifications')
        .select('type')
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;

      const newTabCounts: TabCounts = { messages: 0, tests: 0, jobs: 0, pipeline: 0 };
      for (const notification of data) {
        if (notification.type === 'message') newTabCounts.messages++;
        else if (notification.type === 'test_assignment') newTabCounts.tests++;
        else if (notification.type === 'job_application') newTabCounts.jobs++;
        else if (notification.type === 'test_completion') newTabCounts.pipeline++;
      }

      setTabCounts(newTabCounts);
      setUnreadCount(data.length);

      if (data.length > 0) {
        document.title = `(${data.length}) GitTalent`;
      } else {
        document.title = 'GitTalent';
      }
      return { unreadCount: data.length, tabCounts: newTabCounts };
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      return defaultReturn;
    }
  }, [userProfile]);

  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id || unreadCount === 0) return;
    document.title = 'GitTalent'; 
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userProfile, unreadCount, fetchUnreadCount]);

  const markAsReadByEntity = useCallback(async (entityId: string, type: string) => {
    try {
      if (!userProfile?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('entity_id', entityId)
        .eq('type', type);
      if (error) throw error;
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read by entity:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  useEffect(() => {
    if (userProfile?.id) {
      fetchUnreadCount();
      const channel = supabase
        .channel(`notification-count-changes-${userProfile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` },
          () => { fetchUnreadCount(); }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [userProfile, fetchUnreadCount]);

  const value = { unreadCount, tabCounts, fetchUnreadCount, markAsReadByEntity, markAllAsRead };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

// This is the new useNotifications hook that all components will use
export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
