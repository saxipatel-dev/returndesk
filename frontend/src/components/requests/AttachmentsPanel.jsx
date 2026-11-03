import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload } from "lucide-react";
import { returnsApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { formatBytes, formatDate } from "../../utils/format";
import { ACCEPTED_FILES, MAX_FILE_MB, checkFile } from "../../utils/validation";
import { Card } from "../ui/Layout";
import Button from "../ui/Button";
import { ErrorState, Skeleton } from "../ui/Feedback";

export default function AttachmentsPanel({ requestId, canUpload, onUploaded }) {
  const toast = useToast();
  const input = useRef(null);
  const files = useAsync(() => returnsApi.attachments(requestId), [requestId]);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const attachment = await returnsApi.upload(requestId, file);
      files.setData((list) => [...(list ?? []), attachment]);
      toast.success(`${file.name} uploaded.`);
      onUploaded?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card
      title="Photos and receipts"
      description={`JPG, PNG, WEBP or PDF up to ${MAX_FILE_MB} MB.`}
      actions={
        canUpload && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={handleFile}
              aria-label="Upload a file"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={Upload}
              loading={uploading}
              onClick={() => input.current?.click()}
            >
              Upload
            </Button>
          </>
        )
      }
    >
      {files.loading ? (
        <Skeleton className="h-10" />
      ) : files.error ? (
        <ErrorState message={files.error} onRetry={files.reload} />
      ) : files.data.length === 0 ? (
        <p className="text-sm text-slate-500">No files attached.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {files.data.map((f) => {
            const Icon = f.mime_type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <a
                    href={returnsApi.attachmentUrl(f.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {f.original_filename}
                  </a>
                  <p className="text-xs text-slate-500">
                    {formatBytes(f.size_bytes)} · {f.uploader.name} · {formatDate(f.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
