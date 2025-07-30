import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tabCounts, setTabCounts] = useState({
    messages: 0,
    tests: 0,
    jobs: 0,
    pipeline: 0,
  });

  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!userProfile?.id) return { unreadCount: 0, tabCounts: { messages: 0, tests: 0, jobs: 0, pipeline: 0 } };

      const { data, error } = await supabase
        .from('notifications')
        .select('type')
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;

      const newTabCounts = {
        messages: 0,
        tests: 0,
        jobs: 0,
        pipeline: 0,
      };

      for (const notification of data) {
        if (notification.type === 'message') {
          newTabCounts.messages++;
        } else if (notification.type === 'test_assignment') {
          newTabCounts.tests++;
        } else if (notification.type === 'job_application') {
          newTabCounts.jobs++;
        } else if (notification.type === 'test_completion') {
          newTabCounts.pipeline++;
        }
      }

      setTabCounts(newTabCounts);
      setUnreadCount(data.length);

      // ADDED: Update document title based on new count
      if (data.length > 0) {
        document.title = `(${data.length}) GitTalent`;
      } else {
        document.title = 'GitTalent';
      }

      return { unreadCount: data.length, tabCounts: newTabCounts };
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      return { unreadCount: 0, tabCounts: { messages: 0, tests: 0, jobs: 0, pipeline: 0 } };
    }
  }, [userProfile]);

  // ADDED: New function to mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id || unreadCount === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      // After updating the backend, refetch the count which will set it to 0
      fetchUnreadCount();
      
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userProfile, unreadCount, fetchUnreadCount]);


  useEffect(() => {
    if (userProfile) {
      fetchUnreadCount();

      const subscription = supabase
        .channel(`notification-count-changes-${userProfile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userProfile, fetchUnreadCount]);

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

      // Refetch counts after marking as read
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read by entity:', error);
    }
  }, [userProfile, fetchUnreadCount]);

  // MODIFIED: Return the new function
  return { unreadCount, tabCounts, fetchUnreadCount, markAsReadByEntity, markAllAsRead };
};
