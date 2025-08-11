import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext'; // CORRECTED IMPORT PATH

interface TabCounts {
  messages: number;
  tests: number;
  jobs: number;
  pipeline: number;
  recruiters: number; // Add recruiters tab count for admin
}

interface NotificationsContextType {
  unreadCount: number;
  tabCounts: TabCounts;
  fetchUnreadCount: () => Promise<{ unreadCount: number; tabCounts: TabCounts }>;
  markAsReadByEntity: (entityId: string, type: string) => Promise<void>;
  markAsReadByType: (type: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markMessageNotificationsAsRead: (senderId: string) => Promise<void>;
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
    recruiters: 0,
  });

  const fetchUnreadCount = useCallback(async (): Promise<{ unreadCount: number; tabCounts: TabCounts }> => {
    const defaultReturn = { unreadCount: 0, tabCounts: { messages: 0, tests: 0, jobs: 0, pipeline: 0, recruiters: 0 }};
    try {
      if (!userProfile?.id) return defaultReturn;

      console.log('🔄 Fetching unread notification count for user:', userProfile.id, 'role:', userProfile.role);

      const { data, error } = await supabase
        .from('notifications')
        .select('type')
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;

      const newTabCounts: TabCounts = { messages: 0, tests: 0, jobs: 0, pipeline: 0, recruiters: 0 };
      
      // Count notifications by type, considering user role
      for (const notification of data) {
        switch (notification.type) {
          case 'message':
          case 'admin_message':
            newTabCounts.messages++;
            break;
            
          case 'test_assignment':
            // Only count for developers
            if (userProfile.role === 'developer') {
              newTabCounts.tests++;
            }
            break;
            
          case 'test_completion':
            // Only count for recruiters in their pipeline tab
            if (userProfile.role === 'recruiter') {
              newTabCounts.pipeline++;
            }
            break;
            
          case 'job_application':
            // Only count for recruiters in their jobs tab
            if (userProfile.role === 'recruiter') {
              newTabCounts.jobs++;
            }
            break;
            
          case 'application_viewed':
          case 'hired':
            // Only count for developers in their jobs tab
            if (userProfile.role === 'developer') {
              newTabCounts.jobs++;
            }
            break;
            
          case 'pending_recruiter':
          case 'recruiter_pending':
            // Only count for admin in their recruiters tab
            if (userProfile.role === 'admin') {
              newTabCounts.recruiters++;
            }
            break;
        }
      }

      console.log('📊 Updated notification counts:', {
        total: data.length,
        tabCounts: newTabCounts,
        userRole: userProfile.role
      });

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
      console.log('🔄 Marking all notifications as read for user:', userProfile.id);
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);
      
      // Force immediate update
      setTimeout(() => {
        fetchUnreadCount();
      }, 200);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userProfile, unreadCount, fetchUnreadCount]);

  const markAsReadByEntity = useCallback(async (entityId: string, type: string) => {
    try {
      if (!userProfile?.id) return;
      
      console.log('🔄 Marking notifications as read by entity:', { entityId, type, userId: userProfile.id });
      
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('entity_id', entityId)
        .eq('type', type)
        .eq('is_read', false)
        .select('id'); // Return the updated records to see if any were actually updated

      if (error) throw error;
      
      // Only refresh count if notifications were actually marked as read
      if (data && data.length > 0) {
        console.log('✅ Successfully marked', data.length, 'notifications as read');
        setTimeout(() => {
          fetchUnreadCount();
        }, 200);
      } else {
        console.log('ℹ️ No unread notifications found to mark as read');
      }
    } catch (error) {
      console.error('Error marking notification as read by entity:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  const markAsReadByType = useCallback(async (type: string) => {
    try {
      if (!userProfile?.id) return;
      
      console.log('🔄 Marking notifications as read by type:', { type, userId: userProfile.id });
      
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('type', type)
        .eq('is_read', false)
        .select('id'); // Return the updated records to see if any were actually updated

      if (error) throw error;
      
      // Only refresh count if notifications were actually marked as read
      if (data && data.length > 0) {
        console.log('✅ Successfully marked', data.length, 'notifications as read by type');
        setTimeout(() => {
          fetchUnreadCount();
        }, 200);
      } else {
        console.log('ℹ️ No unread notifications found to mark as read for type:', type);
      }
    } catch (error) {
      console.error('Error marking notification as read by type:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  // NEW: Function specifically for marking message notifications as read when opening a thread
  const markMessageNotificationsAsRead = useCallback(async (senderId: string) => {
    try {
      if (!userProfile?.id) return;
      
      console.log('🔄 Marking message notifications as read for sender:', { senderId, userId: userProfile.id });
      
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('entity_id', senderId)
        .eq('type', 'message')
        .eq('is_read', false)
        .select('id');

      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log('✅ Successfully marked', data.length, 'message notifications as read');
        setTimeout(() => {
          fetchUnreadCount();
        }, 200);
      }
    } catch (error) {
      console.error('Error marking message notifications as read:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  useEffect(() => {
    if (userProfile?.id) {
      console.log('🔄 User profile loaded, initializing notifications for:', userProfile.id);
      fetchUnreadCount();
      
      const channel = supabase
        .channel(`notification-count-changes-${userProfile.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${userProfile.id}` 
        }, (payload) => {
          console.log('🔔 Real-time notification change:', payload);
          // Add a small delay to ensure the database transaction is complete
          setTimeout(() => {
            fetchUnreadCount();
          }, 300);
        })
        .subscribe();
        
      return () => { 
        console.log('🔄 Cleaning up notification subscription for user:', userProfile.id);
        supabase.removeChannel(channel); 
      };
    }
  }, [userProfile, fetchUnreadCount]);

  const value = { 
    unreadCount, 
    tabCounts, 
    fetchUnreadCount, 
    markAsReadByEntity, 
    markAsReadByType, 
    markAllAsRead,
    markMessageNotificationsAsRead 
  };

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
