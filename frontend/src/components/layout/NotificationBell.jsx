import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { notificationsApi } from "../../api";
import { requestPath, timeAgo } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";

const POLL_MS = 30000;

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread_count: 0 });
  const container = useRef(null);

  const load = () =>
    notificationsApi
      .list({ limit: 8 })
      .then(setData)
      .catch(() => {});

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !container.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  const openItem = async (item) => {
    setOpen(false);
    if (!item.read_at) {
      await notificationsApi.markRead(item.id).catch(() => {});
      load();
    }
  };

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${data.unread_count ? `, ${data.unread_count} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {data.unread_count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {data.unread_count > 9 ? "9+" : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {data.unread_count > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data.items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</li>
            )}
            {data.items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.request_id ? requestPath(user, item.request_id) : "/notifications"}
                  onClick={() => openItem(item)}
                  className="flex gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-indigo-500"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm ${item.read_at ? "text-slate-600" : "font-medium text-slate-900"}`}>
                      {item.message}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-indigo-600 hover:bg-slate-50"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
