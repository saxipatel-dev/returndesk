import { useState } from "react";
import { Lock, MessageSquare } from "lucide-react";
import { returnsApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatDateTime, initials } from "../../utils/format";
import { Card } from "../ui/Layout";
import Button from "../ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../ui/Feedback";

export default function CommentsPanel({ requestId, onPosted }) {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = user.role !== "customer";
  const comments = useAsync(() => returnsApi.comments(requestId), [requestId]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const comment = await returnsApi.addComment(requestId, { body: body.trim(), is_internal: internal });
      comments.setData((list) => [...(list ?? []), comment]);
      setBody("");
      setInternal(false);
      onPosted?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card
      title="Conversation"
      description={isStaff ? "Internal notes are only visible to staff." : "Messages between you and our support team."}
    >
      {comments.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : comments.error ? (
        <ErrorState message={comments.error} onRetry={comments.reload} />
      ) : comments.data.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No messages yet">
          {isStaff
            ? "Ask the customer for details or leave an internal note."
            : "Questions about your request? Send us a message."}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {comments.data.map((c) => {
            const mine = c.author.id === user.id;
            return (
              <li key={c.id} className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    c.author.role === "customer" ? "bg-slate-200 text-slate-700" : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {initials(c.author.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{mine ? "You" : c.author.name}</span>
                    {c.author.role !== "customer" && " · Support"} · {formatDateTime(c.created_at)}
                  </p>
                  <div
                    className={`mt-1 rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                      c.is_internal
                        ? "border border-amber-200 bg-amber-50 text-amber-900"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {c.is_internal && (
                      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Lock className="h-3 w-3" /> Internal note
                      </span>
                    )}
                    {c.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="mt-5 border-t border-slate-100 pt-4">
        <label htmlFor={`comment-${requestId}`} className="sr-only">
          Write a message
        </label>
        <textarea
          id={`comment-${requestId}`}
          rows={3}
          maxLength={2000}
          className="input"
          placeholder={internal ? "Write an internal note…" : "Write a message…"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          // Locked while sending so text typed meanwhile isn't wiped when the box clears.
          readOnly={posting}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          {isStaff ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Internal note (hidden from customer)
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" loading={posting} disabled={!body.trim()}>
            {internal ? "Add note" : "Send"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
