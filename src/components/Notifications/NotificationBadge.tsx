import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '' }) => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userProfile) {
      fetchUnreadCount();
      
      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel('notification-count-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`
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
  }, [userProfile]);

  const fetchUnreadCount = async () => {
    try {
      if (!userProfile?.id) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <Bell className="w-5 h-5" />
      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    </div>
  );
};