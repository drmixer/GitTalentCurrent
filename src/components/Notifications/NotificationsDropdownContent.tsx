import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationsContext";
import { resolveNotificationTarget } from "../../utils/notificationRoutes";
import { useAuth } from "../../hooks/useAuth";

interface NotificationsDropdownContentProps {
  onClose?: () => void;
  // Preferred navigation hook provided by Header
  onNavigate?: (tab: string) => void;
  // Fallbacks/legacy
  fetchUnreadCount?: () => void;
  markAllAsRead?: () => void;
  getDashboardPath?: () => string;
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
  // Always keep message notifications, but we will render a normalized title (not raw content)
  return true;
}

// Fallback titles by type when backend title is missing
function getDefaultTitleByType(n: any): string {
  const t = (n?.type || "").toLowerCase();
  if (t.includes("message")) return "New message received";
  if (t === "job_application" || t === "job_interest")
    return 'A developer has applied for your job role';
  if (t === "test_assignment")
    return "You have a new coding test assignment";
  if (
    t === "test_completion" ||
    t === "test_completed" ||
    t === "test_result" ||
    t === "test_complete"
  )
    return "Test completed";
  return "New notification";
}

export const NotificationsDropdownContent: React.FC<NotificationsDropdownContentProps> = ({
  onClose,
  onNavigate,
  fetchUnreadCount,
  markAllAsRead: legacyMarkAllAsRead,
  getDashboardPath,
}) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

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

  const navigateToTarget = useCallback(
    (n: any) => {
      const role = userProfile?.role || undefined;
      const target = resolveNotificationTarget(n, role);
      if (target?.path) {
        // Prefer strongly-typed target
        navigate(target.path, { state: target.state });
        return;
      }
      // Fallback: basic tab routing if target not resolved
      const base = (typeof getDashboardPath === "function" && getDashboardPath()) || "/";
      const type = (n?.type || "").toLowerCase();
      let tab = "overview";
      if (type.includes("message")) tab = "messages";
      else if (type === "job_application" || type === "job_interest") tab = "my-jobs";
      else if (
        type === "test_completion" ||
        type === "test_completed" ||
        type === "test_result" ||
        type === "test_complete"
      )
        tab = "tracker";
      else if (type === "test_assignment" && role === "developer")
        tab = "tests";

      navigate(`${base}?tab=${encodeURIComponent(tab)}`);
    },
    [navigate, getDashboardPath, userProfile?.role]
  );

  const handleItemClick = useCallback(
    (n: any) => {
      fireMarkAsRead(n?.id);
      onClose?.();
      navigateToTarget(n);
    },
    [fireMarkAsRead, onClose, navigateToTarget]
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
      // Normalize message-type title; avoid showing raw content
      // If sender display names are available, use: `New message from ${sender}`
      return "New message received";
    }
    return n.title || getDefaultTitleByType(n);
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
