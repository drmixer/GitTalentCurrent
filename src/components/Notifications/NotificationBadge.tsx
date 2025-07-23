import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
// REMOVED: import { Bell } from 'lucide-react'; // No longer needed here

interface NotificationBadgeProps {
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '' }) => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Using useCallback for fetchUnreadCount to prevent re-creation on every render
  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!userProfile?.id) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false); // Assuming 'is_read' false means unread

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  }, [userProfile]); // Dependency on userProfile

  useEffect(() => {
    if (userProfile) {
      fetchUnreadCount();
      
      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel(`notification-count-changes-${userProfile.id}`) // Use userProfile.id to make channel unique
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for any change that might affect the count (INSERT, UPDATE of is_read, DELETE)
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`
          },
          () => {
            fetchUnreadCount(); // Re-fetch count on any relevant change
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userProfile, fetchUnreadCount]); // Added fetchUnreadCount to deps

  if (unreadCount === 0) {
    return null; // Don't render anything if there are no unread notifications
  }

  return (
    // This span will be absolutely positioned over the bell icon in Header.tsx
    // The `className` prop can be used to adjust its position further.
    <span className={`absolute bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center ${className}`}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};
