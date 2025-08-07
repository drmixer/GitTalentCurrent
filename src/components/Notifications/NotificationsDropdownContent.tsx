import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Loader, XCircle, BellOff, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  type: string; // Loosened for the custom types you have
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
}

interface NotificationsDropdownContentProps {
  onClose: () => void;
  onNavigate: (tab: string) => void;
  fetchUnreadCount: () => void;
  markAllAsRead: () => void;
  getDashboardPath: () => string;
}

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({ onClose, onNavigate, fetchUnreadCount, markAllAsRead: contextMarkAllAsRead, getDashboardPath }) => {
  const { userProfile } = useAuth();
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

      // MODIFIED: Added .eq('is_read', false) to only fetch unread notifications. This fixes the incorrect grouping.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

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

    const channel = supabase
      .channel(`notifications-for-user-${userProfile?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile?.id}`
        },
        (payload) => {
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
      fetchUnreadCount();
    } catch (err: any) {
      console.error('Error marking notification as read:', err.message);
    }
  };


  const getNotificationIcon = (type: Notification['type'], isRead: boolean) => {
    switch (type) {
      case 'application_status':
        return <CheckCircle className={`w-5 h-5 ${isRead ? 'text-gray-400' : 'text-green-500'}`} />;
      case 'message':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-message-square ${isRead ? 'text-gray-400' : 'text-blue-500'}`}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
      case 'test_assignment':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-code ${isRead ? 'text-gray-400' : 'text-green-500'}`}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
      case 'test_completion':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-file-check ${isRead ? 'text-gray-400' : 'text-indigo-500'}`}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>;
      case 'job_application':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-briefcase ${isRead ? 'text-gray-400' : 'text-yellow-500'}`}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
      case 'system':
      default:
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-bell ${isRead ? 'text-gray-400' : 'text-purple-500'}`}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    }
  };

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

    return date.toLocaleDateString();
  };

  const groupNotifications = (notifications: Notification[]) => {
    return notifications.reduce((acc, notification) => {
      (acc[notification.type] = acc[notification.type] || []).push(notification);
      return acc;
    }, {} as Record<string, Notification[]>);
  };

  const handleNotificationClick = async (notification: Notification) => {
    console.log("Notification clicked:", notification);
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
        <button
          onClick={contextMarkAllAsRead}
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
          {Object.entries(groupNotifications(notifications)).map(([type, groupedNotifications]) => {
            if (groupedNotifications.length === 1) {
              const notification = groupedNotifications[0];
              return (
                <Link
                  to={`${getDashboardPath()}${notification.link || ''}`}
                  key={notification.id}
                  className={`p-4 flex items-start space-x-3 ${!notification.is_read ? 'bg-blue-50' : 'bg-white'
                    } hover:bg-gray-50 transition-colors cursor-pointer`}
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
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Mark as Read
                    </button>
                  )}
                </Link>
              );
            } else {
              const latestNotification = groupedNotifications[0];
              return (
                <Link
                  to={`${getDashboardPath()}${latestNotification.link || ''}`}
                  key={type}
                  className={`p-4 flex items-start space-x-3 ${!latestNotification.is_read ? 'bg-blue-50' : 'bg-white'
                    } hover:bg-gray-50 transition-colors cursor-pointer`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(latestNotification.type, latestNotification.is_read)}
                  </div>
                  <div className="flex-grow">
                    <p className={`text-sm font-medium ${latestNotification.is_read ? 'text-gray-600' : 'text-gray-800'}`}>
                      {groupedNotifications.length} new {type.replace(/_/g, ' ')}s
                    </p>
                    <p className={`text-sm ${latestNotification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                      {latestNotification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatSimpleDate(latestNotification.created_at)}
                    </p>
                  </div>
                  {!latestNotification.is_read && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleNotificationClick(latestNotification);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Mark as Read
                    </button>
                  )}
                </Link>
              );
            }
          })}
        </ul>
      )}
    </div>
  );
};
