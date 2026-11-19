"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Paperclip, Download, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";
import { useCurrentRole } from "@/lib/hooks/use-current-role";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt";
const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD", "ACCOUNT"] as const;
export type AttachmentEntityType = (typeof ENTITY_TYPES)[number];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({
  entityType,
  entityId,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
}) {
  const { userId } = useAuth();
  const { isAdmin } = useCurrentRole();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const attachments = trpc.attachment.forEntity.useQuery({ entityType, entityId });

  const createAttachment = trpc.attachment.create.useMutation({
    onSuccess: () => {
      utils.attachment.forEntity.invalidate({ entityType, entityId });
      toast.success("File attached");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAttachment = trpc.attachment.delete.useMutation({
    onSuccess: () => {
      utils.attachment.forEntity.invalidate({ entityType, entityId });
      toast.success("Attachment deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File too large (max 4 MB)");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      if (!res.ok) {
        if (res.status === 413) throw new Error("File too large");
        let message = "Upload failed";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {}
        throw new Error(message);
      }
      const uploaded = await res.json();
      createAttachment.mutate({
        entityType: entityType,
        entityId: entityId,
        fileName: uploaded.name,
        blobPathname: uploaded.pathname,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground">Attachments</h2>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPT}
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          Upload
        </Button>
      </div>

      {attachments.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : attachments.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.data?.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-card-foreground">{a.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.fileSize)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" asChild>
                  <a href={`/api/attachments/${a.id}/download`} target="_blank" rel="noopener noreferrer" download={a.fileName}>
                    <Download className="size-3.5" />
                  </a>
                </Button>
                {(a.uploadedById === userId || isAdmin) && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={deleteAttachment.isPending}
                    onClick={() => deleteAttachment.mutate({ id: a.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
