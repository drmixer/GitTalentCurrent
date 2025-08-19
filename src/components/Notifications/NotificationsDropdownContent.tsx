import React, { useMemo, useCallback } from "react";
import { useNotifications } from "../../contexts/NotificationsContext";

interface NotificationsDropdownContentProps {
  onClose?: () => void;
  // Kept for compatibility with existing header usage:
  onNavigate?: (tab: string) => void;
  fetchUnreadCount?: () => void;
  markAllAsRead?: () => void; // legacy prop; context version preferred
  getDashboardPath?: () => string;
}

// Helper: only keep the user-facing summary items like "New message from ..."
function isMessageSummary(n: any): boolean {
  const type = (n?.type || "").toLowerCase();
  const isMessageType =
    type === "message" ||
    type === "message:new" ||
    type === "message_received" ||
    type === "chat_message";

  if (!isMessageType) return true;

  const title = (n?.title || "").toLowerCase().trim();
  const hasPreview = Boolean(n?.message_preview);
  return hasPreview || title.startsWith("new message from");
}

const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({
  onClose,
  fetchUnreadCount,
  markAllAsRead: legacyMarkAllAsRead, // not used unless context missing
}) => {
  // Cast to any for maximum compatibility with the existing context shape in your repo
  const {
    notifications,
    displayNotifications,
    markAsRead,
    markAllAsRead: ctxMarkAllAsRead,
  } = (useNotifications() as any) || {};

  // Fallback to raw notifications if the context doesn't provide displayNotifications
  const unreadToShow = useMemo(() => {
    const baseList: any[] =
      (Array.isArray(displayNotifications) && displayNotifications) ||
      (Array.isArray(notifications) && notifications) ||
      [];
    return baseList
      .filter((n) => !n.is_read)
      .filter(isMessageSummary)
      .slice(0, 20);
  }, [displayNotifications, notifications]);

  const handleClick = useCallback(
    async (id: string) => {
      try {
        if (typeof markAsRead === "function") {
          await markAsRead(id);
        }
      } finally {
        onClose?.();
      }
    },
    [markAsRead, onClose]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      if (typeof ctxMarkAllAsRead === "function") {
        await ctxMarkAllAsRead();
      } else if (typeof legacyMarkAllAsRead === "function") {
        await legacyMarkAllAsRead();
      }
      fetchUnreadCount?.();
    } finally {
      onClose?.();
    }
  }, [ctxMarkAllAsRead, legacyMarkAllAsRead, fetchUnreadCount, onClose]);

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
          No new notifications
        </div>
      ) : (
        <ul className="space-y-1">
          {unreadToShow.map((n: any) => (
            <li key={n.id}>
              <button
                className="w-full text-left p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                onClick={() => handleClick(n.id)}
                type="button"
              >
                <div className="flex items-start">
                  <span className="mt-1 mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">
                      {n.title?.startsWith("New message from")
                        ? n.title
                        : n.message_preview || n.title || "Notification"}
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

// Export both named and default so existing imports keep working
export { NotificationsDropdownContent };
export default NotificationsDropdownContent;
