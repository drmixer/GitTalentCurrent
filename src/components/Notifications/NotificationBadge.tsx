import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
// REMOVED: import { Bell } from 'lucide-react'; // No longer needed here

interface NotificationBadgeProps {
  className?: string;
  unreadCount: number;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '', unreadCount }) => {

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
