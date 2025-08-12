// src/contexts/NotificationsContext.tsx - UPDATED WITH FIXES

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  markAsRead: (notificationId: string) => Promise<void>;
  markAsReadByType: (type: string) => Promise<void>;
  markMessageNotificationsAsRead: (senderId: string) => Promise<void>; // NEW
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    jobs: 0,
    pipeline: 0,
    messages: 0,
    tests: 0,
  });

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    try {
      console.log('🔔 Fetching notifications for user:', user.id);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      console.log('📬 Fetched notifications:', data?.length || 0);
      setNotifications(data || []);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      console.log('📖 Marking notification as read:', notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      
      console.log('✅ Notification marked as read');
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  }, [user?.id]);

  const markAsReadByType = useCallback(async (type: string) => {
    if (!user?.id) return;

    try {
      console.log('📖 Marking notifications as read by type:', type);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking notifications as read by type:', error);
        return;
      }

      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => n.type === type && !n.is_read ? { ...n, is_read: true } : n)
      );
      
      console.log('✅ Notifications marked as read by type:', type);
    } catch (error) {
      console.error('Error in markAsReadByType:', error);
    }
  }, [user?.id]);

  // NEW: Mark message notifications as read from specific sender
  const markMessageNotificationsAsRead = useCallback(async (senderId: string) => {
    if (!user?.id) return;

    try {
      console.log('💬 Marking message notifications as read from sender:', senderId);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'message')
        .contains('metadata', { sender_id: senderId })
        .eq('is_read', false);

      if (error) {
        console.error('Error marking message notifications as read:', error);
        return;
      }

      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => 
          n.type === 'message' && 
          !n.is_read && 
          n.metadata?.sender_id === senderId 
            ? { ...n, is_read: true } 
            : n
        )
      );
      
      console.log('✅ Message notifications marked as read from sender:', senderId);
    } catch (error) {
      console.error('Error in markMessageNotificationsAsRead:', error);
    }
  }, [user?.id]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ENHANCED: Calculate tab counts based on user role
  useEffect(() => {
    if (!user?.id || !userProfile) {
      setTabCounts({ jobs: 0, pipeline: 0, messages: 0, tests: 0 });
      return;
    }

    const unreadNotifications = notifications.filter(n => !n.is_read);
    console.log('🔢 Calculating tab counts for role:', userProfile.role, 'unread:', unreadNotifications.length);

    if (userProfile.role === 'recruiter') {
      const jobApplications = unreadNotifications.filter(n => n.type === 'job_application').length;
      const testCompletions = unreadNotifications.filter(n => n.type === 'test_completion').length;
      const messages = unreadNotifications.filter(n => n.type === 'message').length;
      
      console.log('📊 Recruiter tab counts:', {
        jobs: jobApplications,
        pipeline: testCompletions,
        messages: messages
      });
      
      setTabCounts({
        jobs: jobApplications,
        pipeline: testCompletions,
        messages: messages,
        tests: 0 // Recruiters don't have tests tab
      });
    } else if (userProfile.role === 'developer') {
      const testAssignments = unreadNotifications.filter(n => n.type === 'test_assignment').length;
      const messages = unreadNotifications.filter(n => n.type === 'message').length;
      
      console.log('📊 Developer tab counts:', {
        tests: testAssignments,
        messages: messages
      });
      
      setTabCounts({
        tests: testAssignments,
        messages: messages,
        jobs: 0, // Developers don't have jobs tab
        pipeline: 0 // Developers don't have pipeline tab
      });
    }
  }, [notifications, user?.id, userProfile]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();

      // Set up real-time subscription
      const channel = supabase
        .channel('notifications_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Real-time notification update:', payload);
            fetchNotifications(); // Refetch all notifications
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, fetchNotifications]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    tabCounts,
    fetchNotifications,
    markAsRead,
    markAsReadByType,
    markMessageNotificationsAsRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
