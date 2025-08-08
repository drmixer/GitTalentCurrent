import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Loader, XCircle, BellOff, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  type: string;
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

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({ 
  onClose, 
  onNavigate, 
  fetchUnreadCount, 
  markAllAsRead: contextMarkAllAsRead, 
  getDashboardPath 
}) => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);

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

      // Immediately update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      
      // Refresh unread count after marking as read with delay
      setTimeout(() => {
        fetchUnreadCount();
      }, 100);
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

  // ENHANCED: Much more robust notification click handler
  const handleNotificationClick = async (notification: Notification) => {
    if (processingNotificationId === notification.id) return;
    
    console.log('[NotificationDropdown] Handling notification click:', {
      id: notification.id,
      type: notification.type,
      link: notification.link,
      currentPath: location.pathname,
      currentSearch: location.search
    });

    setProcessingNotificationId(notification.id);

    try {
      // Mark as read first with immediate UI update
      if (!notification.is_read) {
        console.log('[NotificationDropdown] Marking notification as read:', notification.id);
        await markAsRead(notification.id);
      }

      // Close dropdown immediately
      onClose();
      
      // Small delay to ensure dropdown closes
      await new Promise(resolve => setTimeout(resolve, 100));

      // ENHANCED: Better URL parsing and navigation logic
      let targetUrl = '';
      let targetTab = '';

      if (notification.link) {
        try {
          // Parse the link to extract tab parameter
          const url = new URL(`${window.location.origin}${notification.link}`);
          targetTab = url.searchParams.get('tab') || '';
          
          console.log('[NotificationDropdown] Extracted tab from link:', targetTab);
        } catch (urlError) {
          console.warn('[NotificationDropdown] Error parsing notification link:', urlError);
        }
      }

      // Fallback: determine tab from notification type
      if (!targetTab) {
        switch (notification.type) {
          case 'message':
            targetTab = 'messages';
            break;
          case 'job_application':
            targetTab = 'jobs';
            break;
          case 'application_viewed':
            targetTab = 'jobs';
            break;
          case 'hired':
            targetTab = 'jobs';
            break;
          case 'test_assignment':
            targetTab = 'tests';
            break;
          case 'test_completion':
            targetTab = userProfile?.role === 'recruiter' ? 'tracker' : 'tests';
            break;
          case 'job_posted':
            targetTab = 'jobs';
            break;
          case 'pending_recruiter':
            targetTab = userProfile?.role === 'admin' ? 'recruiters' : 'overview';
            break;
          default:
            targetTab = 'overview';
        }
        
        console.log('[NotificationDropdown] Determined tab from type:', targetTab);
      }

      // Build target URL based on current dashboard path
      const dashboardPath = getDashboardPath();
      targetUrl = `${dashboardPath}?tab=${targetTab}`;
      
      console.log('[NotificationDropdown] Target URL:', targetUrl);
      console.log('[NotificationDropdown] Current URL:', `${location.pathname}${location.search}`);

      // ENHANCED: Multiple navigation strategies
      const currentFullUrl = `${location.pathname}${location.search}`;
      
      if (currentFullUrl === targetUrl) {
        console.log('[NotificationDropdown] Already on target page, forcing page reload');
        // Force reload if we're already on the target page to ensure state updates
        window.location.href = targetUrl;
      } else {
        console.log('[NotificationDropdown] Navigating with replace: true');
        
        // Strategy 1: Try React Router navigation with replace
        navigate(targetUrl, { replace: true });
        
        // Strategy 2: Fallback to window.location if React Router navigation doesn't work
        setTimeout(() => {
          const newCurrentUrl = `${window.location.pathname}${window.location.search}`;
          if (newCurrentUrl !== targetUrl) {
            console.log('[NotificationDropdown] React Router navigation failed, using window.location');
            window.location.href = targetUrl;
          } else {
            console.log('[NotificationDropdown] React Router navigation successful');
          }
        }, 500);
      }

      // Refresh counts after navigation
      setTimeout(() => {
        fetchUnreadCount();
        fetchNotifications();
      }, 1000);

    } catch (error) {
      console.error('[NotificationDropdown] Error handling notification click:', error);
      
      // Fallback navigation on error
      onClose();
      const dashboardPath = getDashboardPath();
      const fallbackUrl = `${dashboardPath}?tab=overview`;
      
      try {
        navigate(fallbackUrl, { replace: true });
      } catch (navError) {
        console.error('[NotificationDropdown] Fallback navigation also failed:', navError);
        window.location.href = fallbackUrl;
      }
    } finally {
      setProcessingNotificationId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              console.log('[NotificationDropdown] Marking all notifications as read');
              await contextMarkAllAsRead();
              // Refresh the notifications list after marking all as read
              setTimeout(async () => {
                await fetchNotifications();
                fetchUnreadCount();
              }, 200);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            disabled={notifications.every(n => n.is_read) || isLoading}
          >
            Mark all as read
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
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
                <li key={notification.id}>
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    disabled={processingNotificationId === notification.id}
                    className={`w-full p-4 flex items-start space-x-3 ${
                      !notification.is_read ? 'bg-blue-50' : 'bg-white'
                    } hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:opacity-50`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {processingNotificationId === notification.id ? (
                        <Loader className="animate-spin h-5 w-5 text-blue-500" />
                      ) : (
                        getNotificationIcon(notification.type, notification.is_read)
                      )}
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
                  </button>
                </li>
              );
            } else {
              const latestNotification = groupedNotifications[0];
              return (
                <li key={type}>
                  <button
                    onClick={() => handleNotificationClick(latestNotification)}
                    disabled={processingNotificationId === latestNotification.id}
                    className={`w-full p-4 flex items-start space-x-3 ${
                      !latestNotification.is_read ? 'bg-blue-50' : 'bg-white'
                    } hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:opacity-50`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {processingNotificationId === latestNotification.id ? (
                        <Loader className="animate-spin h-5 w-5 text-blue-500" />
                      ) : (
                        getNotificationIcon(latestNotification.type, latestNotification.is_read)
                      )}
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
                  </button>
                </li>
              );
            }
          })}
        </ul>
      )}
    </div>
  );
};
