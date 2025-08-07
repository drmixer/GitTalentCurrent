import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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
      if (!userProfile?.id) {
        console.log('NotificationsContext: No user profile, returning defaults');
        return defaultReturn;
      }

      console.log('NotificationsContext: Fetching unread notifications for user:', userProfile.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('type')
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) {
        console.error('NotificationsContext: Error fetching notifications:', error);
        throw error;
      }

      console.log('NotificationsContext: Fetched notifications:', data);

      const newTabCounts: TabCounts = { messages: 0, tests: 0, jobs: 0, pipeline: 0 };
      for (const notification of data) {
        if (notification.type === 'message') newTabCounts.messages++;
        else if (notification.type === 'test_assignment') newTabCounts.tests++;
        else if (notification.type === 'job_application') newTabCounts.jobs++;
        else if (notification.type === 'test_completion') newTabCounts.pipeline++;
      }

      console.log('NotificationsContext: New tab counts:', newTabCounts);

      setTabCounts(newTabCounts);
      setUnreadCount(data.length);

      // Update document title
      if (data.length > 0) {
        document.title = `(${data.length}) GitTalent`;
      } else {
        document.title = 'GitTalent';
      }

      return { unreadCount: data.length, tabCounts: newTabCounts };
    } catch (error) {
      console.error('NotificationsContext: Error fetching unread notification count:', error);
      return defaultReturn;
    }
  }, [userProfile]);

  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id || unreadCount === 0) {
      console.log('NotificationsContext: No user profile or no unread notifications');
      return;
    }
    
    console.log('NotificationsContext: Marking all notifications as read');
    document.title = 'GitTalent'; 
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;

      console.log('NotificationsContext: Successfully marked all notifications as read');
      
      // Update local state immediately
      setUnreadCount(0);
      setTabCounts({ messages: 0, tests: 0, jobs: 0, pipeline: 0 });
      
      // Then refresh from server to ensure consistency
      await fetchUnreadCount();
    } catch (error) {
      console.error('NotificationsContext: Error marking all notifications as read:', error);
    }
  }, [userProfile, unreadCount, fetchUnreadCount]);

  const markAsReadByEntity = useCallback(async (entityId: string, type: string) => {
    try {
      if (!userProfile?.id) {
        console.log('NotificationsContext: No user profile for markAsReadByEntity');
        return;
      }

      console.log('NotificationsContext: Marking notifications as read by entity:', { entityId, type });

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('entity_id', entityId)
        .eq('type', type)
        .eq('is_read', false);

      if (error) throw error;

      console.log('NotificationsContext: Successfully marked notifications as read by entity');
      
      // Refresh counts after marking as read
      await fetchUnreadCount();
    } catch (error) {
      console.error('NotificationsContext: Error marking notification as read by entity:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  // Set up real-time subscription when user profile is available
  useEffect(() => {
    if (userProfile?.id) {
      console.log('NotificationsContext: Setting up real-time subscription for user:', userProfile.id);
      
      // Initial fetch
      fetchUnreadCount();
      
      // Set up real-time channel
      const channel = supabase
        .channel(`notification-count-changes-${userProfile.id}`)
        .on(
          'postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${userProfile.id}` 
          },
          (payload) => {
            console.log('NotificationsContext: Real-time notification change detected:', payload);
            // Small delay to ensure database consistency
            setTimeout(() => {
              fetchUnreadCount();
            }, 100);
          }
        )
        .subscribe((status) => {
          console.log('NotificationsContext: Subscription status:', status);
        });

      return () => {
        console.log('NotificationsContext: Cleaning up real-time subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [userProfile, fetchUnreadCount]);

  const value = { 
    unreadCount, 
    tabCounts, 
    fetchUnreadCount, 
    markAsReadByEntity, 
    markAllAsRead 
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
