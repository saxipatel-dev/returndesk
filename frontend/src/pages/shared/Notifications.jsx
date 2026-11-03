import { useState } from "react";
import { Link } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { notificationsApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import { formatDateTime, requestPath } from "../../utils/format";

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useAsync(() => notificationsApi.list({ limit: 100, unread_only: unreadOnly }), [unreadOnly]);

  const toggle = async (item) => {
    try {
      const updated = await notificationsApi.markRead(item.id, !item.read_at);
      list.setData((d) => ({
        items: d.items.map((n) => (n.id === item.id ? updated : n)),
        unread_count: d.unread_count + (updated.read_at ? -1 : 1),
      }));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const markAll = async () => {
    await notificationsApi.markAllRead();
    list.reload({ quiet: true });
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about requests you're involved in."
        actions={
          list.data?.unread_count > 0 && (
            <Button variant="secondary" icon={CheckCheck} onClick={markAll}>
              Mark all as read
            </Button>
          )
        }
      />
      <Card bodyClassName="">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
          {list.data && <span className="ml-auto text-sm text-slate-500">{list.data.unread_count} unread</span>}
        </div>
        {list.loading && !list.data ? (
          <TableSkeleton cols={2} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? "No unread notifications" : "No notifications yet"} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.data.items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read_at ? "" : "bg-indigo-50/40"}`}>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-slate-200" : "bg-indigo-500"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read_at ? "text-slate-600" : "font-medium text-slate-900"}`}>
                    {n.message}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(n.created_at)}
                    {n.request_id && (
                      <>
                        {" · "}
                        <Link
                          to={requestPath(user, n.request_id)}
                          className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          View request
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggle(n)}>
                  {n.read_at ? "Mark unread" : "Mark read"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
