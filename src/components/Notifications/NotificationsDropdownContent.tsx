import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader, XCircle, BellOff, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  type: 'application_status' | 'message' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
}

interface NotificationsDropdownContentProps {
  onClose: () => void;
  getDashboardPath: () => string; // Function to get dashboard path based on role
}

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({ onClose, getDashboardPath }) => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!userProfile?.id) {
        setError("User profile not loaded.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(20); // Limit to recent notifications

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error fetching notifications:', err.message);
      setError(`Failed to load notifications: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchNotifications();

    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel(`notifications-for-user-${userProfile?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for any change (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile?.id}`
        },
        (payload) => {
          // A more robust approach would be to process payload.new/payload.old
          // For simplicity, refetch all notifications on any change
          console.log('Realtime notification change detected:', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err: any) {
      console.error('Error marking notification as read:', err.message);
      // Optionally, show a toast or message to the user
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err.message);
      // Optionally, show a toast or message to the user
    }
  };

  const getNotificationIcon = (type: Notification['type'], isRead: boolean) => {
    switch (type) {
      case 'application_status':
        return <CheckCircle className={`w-5 h-5 ${isRead ? 'text-gray-400' : 'text-green-500'}`} />;
      case 'message':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-message-square ${isRead ? 'text-gray-400' : 'text-blue-500'}`}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
      case 'system':
      default:
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-bell ${isRead ? 'text-gray-400' : 'text-purple-500'}`}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    }
  };

  // Function to format date more simply without date-fns
  const formatSimpleDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Fallback for older dates
    return date.toLocaleDateString(); // Or any other simple format
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
        <button
          onClick={markAllAsRead}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          disabled={notifications.every(n => n.is_read) || isLoading}
        >
          Mark all as read
        </button>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {isLoading && (
        <div className="p-4 text-center">
          <Loader className="animate-spin h-5 w-5 text-blue-600 mx-auto" />
          <p className="text-gray-500 text-sm mt-2">Loading...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-4 text-center text-red-600">
          <XCircle className="w-6 h-6 mx-auto mb-2" />
          <p>{error}</p>
          <button onClick={fetchNotifications} className="mt-2 text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && notifications.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          <BellOff className="w-8 h-8 mx-auto mb-2" />
          <p>No new notifications.</p>
        </div>
      )}

      {!isLoading && !error && notifications.length > 0 && (
        <ul className="divide-y divide-gray-100 flex-grow overflow-y-auto">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`p-4 flex items-start space-x-3 ${!notification.is_read ? 'bg-blue-50' : 'bg-white'
                } hover:bg-gray-50 transition-colors cursor-pointer`}
              onClick={() => {
                markAsRead(notification.id);
                if (notification.link) {
                  navigate(notification.link);
                }
                onClose();
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type, notification.is_read)}
              </div>
              <div className="flex-grow">
                <p className={`text-sm font-medium ${notification.is_read ? 'text-gray-600' : 'text-gray-800'}`}>
                  {notification.title}
                </p>
                <p className={`text-sm ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatSimpleDate(notification.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
