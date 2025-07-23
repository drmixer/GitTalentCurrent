import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
// REMOVED: import { Bell } from 'lucide-react'; // No longer needed here

interface NotificationBadgeProps {
  className?: string;
  // We can pass the unreadCount directly if the parent wants to manage it,
  // but for now, keep it self-contained for simplicity based on current code.
  // We'll let it fetch its own count.
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '' }) => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userProfile) {
      fetchUnreadCount();
      
      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel(`notification-count-changes-${userProfile.id}`) // Use userProfile.id to make channel unique
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
  }, [userProfile]); // Added userProfile to dependency array for clarity and correctness

  const fetchUnreadCount = async () => {
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
  };

  if (unreadCount === 0) {
    return null; // Don't render anything if there are no unread notifications
  }

  return (
    // This div will be absolutely positioned over the bell icon in Header.tsx
    // The `className` prop can be used to adjust its position further if needed.
    // The `absolute` positioning will be applied by the parent (Header.tsx) now.
    <span className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center ${className}`}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};
