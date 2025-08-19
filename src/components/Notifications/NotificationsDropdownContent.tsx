import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationsContext";

interface NotificationsDropdownContentProps {
  onClose?: () => void;
  // Provided by Header; preferred way to change dashboard tab
  onNavigate?: (tab: string) => void;
  // Legacy/fallback props
  fetchUnreadCount?: () => void;
  markAllAsRead?: () => void;
  // Provided by Header for direct path fallback
  getDashboardPath?: () => string;
}

// Helper: only keep the user-facing summary items like "New message from ..." or items with a preview
function isMessageSummary(n: any): boolean {
  const type = (n?.type || "").toLowerCase();
  const isMessageType =
    type === "message" ||
    type === "message:new" ||
    type === "message_received" ||
    type === "chat_message";

  // For message-like rows, only show those that have a preview or a conventional title;
  // for other types, keep as-is.
  if (!isMessageType) return true;

  const title = (n?.title || "").toLowerCase().trim();
  const hasPreview = Boolean(n?.message_preview);
  return hasPreview || title.startsWith("new message from");
}

const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({
  onClose,
  onNavigate,
  fetchUnreadCount,
  markAllAsRead: legacyMarkAllAsRead,
  getDashboardPath,
}) => {
  const navigate = useNavigate();

  // Cast to any for compatibility with the context shape
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

  // Fire-and-forget read; never block navigation on network errors
  const fireMarkAsRead = useCallback(
    (id: string) => {
      try {
        if (typeof markAsRead === "function") {
          const p = markAsRead(id);
          // Avoid unhandled rejections in dev
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch {
        // no-op
      }
    },
    [markAsRead]
  );

  const goToMessagesTab = useCallback(() => {
    // Prefer the provided onNavigate API from Header
    if (typeof onNavigate === "function") {
      onNavigate("messages");
      return;
    }
    // Fallback: compute path and push with router
    const base = (typeof getDashboardPath === "function" && getDashboardPath()) || "/";
    navigate(`${base}?tab=messages`);
  }, [onNavigate, getDashboardPath, navigate]);

  const handleItemClick = useCallback(
    (n: any) => {
      // Mark read in the background
      fireMarkAsRead(n?.id);

      // Close dropdown first for snappy UX
      onClose?.();

      // Route to Messages tab
      goToMessagesTab();
    },
    [fireMarkAsRead, onClose, goToMessagesTab]
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
                type="button"
                className="w-full text-left p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                onClick={() => handleItemClick(n)}
              >
                <div className="text-sm font-medium">{n.title || "New notification"}</div>
                {n.message_preview && (
                  <div className="text-xs text-gray-600 truncate">{n.message_preview}</div>
                )}
                <div className="text-[11px] text-gray-400">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationsDropdownContent;
