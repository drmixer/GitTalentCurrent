import React, { useMemo, useCallback } from "react";
import { useNotifications } from "../../contexts/NotificationsContext";

interface NotificationsDropdownContentProps {
  onClose: () => void;
  // Legacy props kept for compatibility with parent:
  onNavigate?: (tab: string) => void;
  fetchUnreadCount?: () => void;
  markAllAsRead?: () => void; // will be ignored; we use context impl
  getDashboardPath?: () => string;
}

function isSummaryTitle(title?: string | null) {
  if (!title) return false;
  return /^new message from /i.test(title.trim());
}

export default function NotificationsDropdownContent({
  onClose,
}: NotificationsDropdownContentProps) {
  const {
    displayNotifications,
    markAsRead,
    markAllAsRead: ctxMarkAllAsRead,
  } = useNotifications();

  // Show up to 20 for the dropdown
  const items = useMemo(
    () => displayNotifications.slice(0, 20),
    [displayNotifications]
  );

  const handleClick = useCallback(
    async (id: string) => {
      await markAsRead(id);
      onClose?.();
    },
    [markAsRead, onClose]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await ctxMarkAllAsRead();
    onClose?.();
  }, [ctxMarkAllAsRead, onClose]);

  return (
    <div className="w-96 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-base font-semibold">Notifications</div>
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={handleMarkAllAsRead}
        >
          Mark all as read
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 pb-6 text-sm text-gray-500">No new notifications</div>
      ) : (
        <ul className="px-2 pb-2">
          {items.map((n) => (
            <li key={n.id} className="mb-1">
              <button
                type="button"
                onClick={() => handleClick(n.id)}
                className={`w-full rounded-md px-3 py-2 text-left hover:bg-gray-50 ${
                  n.is_read ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {isSummaryTitle(n.title) ? n.title : n.title || "Notification"}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
