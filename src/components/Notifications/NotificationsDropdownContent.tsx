import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../contexts/NotificationsContext';
import { resolveNotificationTarget } from '../../utils/notificationRoutes';

interface NotificationsDropdownContentProps {
  onClose: () => void;
  onNavigate: (tab: string) => void;
  fetchUnreadCount: () => void;
  markAllAsRead: () => void;
  getDashboardPath: () => string;
}

// Helper: we only want the user-facing summary items like "New message from ..."
// Keep other non-message notification types as-is.
function isMessageSummary(n: any): boolean {
  const type = (n?.type || '').toLowerCase();
  if (type === 'message' || type === 'message:new' || type === 'message_received') {
    const title = (n?.title || '').toLowerCase();
    const hasPreview = Boolean(n?.message_preview);
    // Show only when we have a summary preview OR the title matches the wording
    return hasPreview || title.startsWith('new message from');
  }
  return true; // non-message notifications are allowed
}

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({
  onClose,
  onNavigate,        // kept for compatibility, not required
  fetchUnreadCount,   // kept for compatibility, not required
  markAllAsRead: _legacyMarkAllAsRead, // kept for compatibility, not used (context handles it)
  getDashboardPath    // kept for compatibility, not required
}) => {
  const { userProfile } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  // Show only the "summary" notification for messages (e.g., "New message from ...")
  const unreadToShow = useMemo(
    () =>
      notifications
        .filter(n => !n.is_read)
        .filter(isMessageSummary)
        .slice(0, 20),
    [notifications]
  );

  const handleClick = useCallback(async (id: string) => {
    const n = notifications.find(x => x.id === id);
    // Mark as read first (context updates state + realtime keeps it fresh)
    await markAsRead(id);

    if (n) {
      const target = resolveNotificationTarget(n, userProfile?.role);
      try {
        navigate(target.path, { state: target.state });
      } catch (e) {
        // Fallback to hard redirect if navigate throws
        window.location.href = target.path;
      }
      // Optional: signal legacy handler about tab if you want
      // onNavigate?.(new URL(target.path, window.location.origin).searchParams.get('tab') || '');
    }

    // Close after action
    onClose?.();
  }, [notifications, markAsRead, userProfile?.role, navigate, onClose /*, onNavigate*/]);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
    // Optionally trigger legacy unread refetch for other parts of the app
    fetchUnreadCount?.();
    onClose?.();
  }, [markAllAsRead, fetchUnreadCount, onClose]);

  if (!userProfile) {
    return (
      <div className="p-4 text-sm text-gray-600">Sign in to view notifications.</div>
    );
  }

  return (
    <div className="w-80 max-h-96 overflow-y-auto p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Notifications</div>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={handleMarkAllAsRead}
          type="button"
        >
          Mark all as read
        </button>
      </div>

      {unreadToShow.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <BellOff className="mx-auto mb-2 h-5 w-5" />
          No new notifications
        </div>
      ) : (
        <ul className="space-y-1">
          {unreadToShow.map(n => (
            <li key={n.id}>
              <button
                className="w-full text-left p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                onClick={() => handleClick(n.id)}
                type="button"
              >
                <div className="flex items-start">
                  <CheckCircle className="mt-0.5 h-4 w-4 text-blue-500 mr-2" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">
                      {/* Prefer summary wording; fall back to preview if needed */}
                      {n.title?.startsWith('New message from')
                        ? n.title
                        : (n as any).message_preview || n.title || 'Notification'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
