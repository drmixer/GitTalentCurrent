import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  Bell, 
  CheckCircle, 
  MessageSquare, 
  Briefcase, 
  User,
  Clock,
  Loader,
  AlertCircle,
  Check,
  X,
  Code
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  entity_id: string;
  entity_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationListProps {
  onViewMessage?: (messageId: string) => void;
  onViewJobRole?: (jobRoleId: string) => void;
  onViewDeveloper?: (developerId: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  onViewMessage,
  onViewJobRole,
  onViewDeveloper
}) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAsRead, setMarkingAsRead] = useState(false);

  useEffect(() => {
    if (userProfile) {
      fetchNotifications();
      
      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`
          },
          (payload) => {
            console.log('New notification received:', payload);
            fetchNotifications();
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userProfile]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setError(error.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(true);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userProfile?.id);

      if (error) throw error;
      
      fetchNotifications();
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAsRead(true);
      
      const { error } = await supabase.rpc('mark_all_notifications_as_read');

      if (error) throw error;
      
      fetchNotifications();
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const navigate = useNavigate();

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Navigate based on notification type and entity
    if (notification.type === 'message') {
        navigate('/developer/dashboard?tab=messages');
    } else if (notification.type === 'job_application') {
        navigate('/recruiter/dashboard?tab=jobs');
    } else if (notification.type === 'test_assignment') {
        navigate(`/developer/dashboard?tab=tests`);
    } else if (notification.type === 'test_completion') {
        navigate(`/recruiter/dashboard?tab=pipeline`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'job_interest':
        return <Briefcase className="w-5 h-5 text-blue-500" />;
      case 'test_assignment':
        return <Code className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading notifications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Notifications</h2>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllAsRead}
            disabled={markingAsRead}
            className="flex items-center px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`bg-white rounded-xl p-5 shadow-sm border ${
                notification.is_read ? 'border-gray-100' : 'border-blue-200 bg-blue-50'
              } hover:shadow-md transition-all cursor-pointer`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-xl ${
                    notification.is_read ? 'bg-gray-100' : 'bg-white'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div>
                    <p className={`${notification.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                </div>
                {!notification.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Notifications</h3>
          <p className="text-gray-600">
            You don't have any notifications yet. They will appear here when you receive messages or updates.
          </p>
        </div>
      )}
    </div>
  );
};