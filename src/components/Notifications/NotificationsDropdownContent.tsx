import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationsContext";

interface NotificationsDropdownContentProps {
  onClose?: () => void;
  // Preferred navigation hook provided by Header
  onNavigate?: (tab: string) => void;
  // Fallbacks/legacy
  fetchUnreadCount?: () => void;
  markAllAsRead?: () => void;
  getDashboardPath?: () => string;
}

// Decide which tab to open for a given notification
function getTabForNotification(n: any): string {
  const t = (n?.type || "").toLowerCase();
  if (t.includes("message")) return "messages";
  if (t === "job_application") return "jobs";
  if (t === "test_completion") return "pipeline";
  return "overview";
}

// Only show concise message-type summaries in the dropdown
function isMessageSummary(n: any): boolean {
  const type = (n?.type || "").toLowerCase();
  const isMessageType =
    type === "message" ||
    type === "message:new" ||
    type === "message_received" ||
    type === "chat_message";
  if (!isMessageType) return true;
  // Always keep message notifications, but we'll render a normalized title (not the content)
  return true;
}

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({
  onClose,
  onNavigate,
  fetchUnreadCount,
  markAllAsRead: legacyMarkAllAsRead,
  getDashboardPath,
}) => {
  const navigate = useNavigate();

  const {
    notifications,
    displayNotifications,
    markAsRead,
    markAllAsRead: ctxMarkAllAsRead,
  } = (useNotifications() as any) || {};

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

  // Never block navigation on network
  const fireMarkAsRead = useCallback(
    (id: string) => {
      try {
        if (typeof markAsRead === "function") {
          const p = markAsRead(id);
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch {
        // ignore
      }
    },
    [markAsRead]
  );

  const navigateToTab = useCallback(
    (tab: string) => {
      if (typeof onNavigate === "function") {
        onNavigate(tab);
        return;
      }
      const base = (typeof getDashboardPath === "function" && getDashboardPath()) || "/";
      navigate(`${base}?tab=${encodeURIComponent(tab)}`);
    },
    [onNavigate, getDashboardPath, navigate]
  );

  const handleItemClick = useCallback(
    (n: any) => {
      fireMarkAsRead(n?.id);
      onClose?.();
      const tab = getTabForNotification(n);
      navigateToTab(tab);
    },
    [fireMarkAsRead, onClose, navigateToTab]
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

  const renderTitle = (n: any) => {
    const t = (n?.type || "").toLowerCase();
    if (t.includes("message")) {
      // Normalize message-type title; do not show raw content
      // If you can provide sender display names here, replace with "New message from <name>"
      return "New message received";
    }
    return n.title || "New notification";
  };

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
                <div className="text-sm font-medium">{renderTitle(n)}</div>
                {/* Hide preview for message-type to enforce summary style */}
                {!((n?.type || "").toLowerCase().includes("message")) && n?.message_preview && (
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
