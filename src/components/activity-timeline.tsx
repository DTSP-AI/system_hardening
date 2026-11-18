"use client";

import { useRef, useState } from "react";
import { Trash2, StickyNote, PhoneCall, PhoneMissed, Mail, CalendarClock, CheckSquare } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";

type CallMetadata = {
  parentCallSid?: string;
  childCallSid?: string;
  status?: string;
  to?: string;
  from?: string;
  direction?: string;
  durationSeconds?: number;
  recordingSid?: string;
  recordingDurationSeconds?: number;
};

type ActivityKind = "NOTE" | "TASK" | "CALL" | "EMAIL" | "MEETING" | "TEXT";

type Activity = {
  id: string;
  type: ActivityKind;
  body: string | null;
  dueDate: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  metadata?: unknown;
};

type EntityType = "CONTACT" | "COMPANY" | "DEAL" | "LEAD";

type ComposableIds = {
  contactId?: string;
  dealId?: string;
};

function resolveEntity(ids: ComposableIds): { entityType: EntityType; entityId: string } | null {
  if (ids.contactId) return { entityType: "CONTACT", entityId: ids.contactId };
  if (ids.dealId) return { entityType: "DEAL", entityId: ids.dealId };
  return null;
}

function getCallMetadata(activity: Activity): CallMetadata | null {
  if (activity.type !== "CALL" || !activity.metadata || typeof activity.metadata !== "object") {
    return null;
  }
  return activity.metadata as CallMetadata;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function ActivityComposer({
  type,
  placeholder,
  submitLabel,
  successLabel,
  needsDueDate,
  ids,
  onSuccess,
}: {
  type: "NOTE" | "TASK" | "MEETING";
  placeholder: string;
  submitLabel: string;
  successLabel: string;
  needsDueDate: boolean;
  ids: ComposableIds;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");

  const createActivity = trpc.activity.create.useMutation({
    onSuccess: () => {
      setNote("");
      setDueDate("");
      onSuccess();
      toast.success(successLabel);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Textarea placeholder={placeholder} value={note} onChange={(e) => setNote(e.target.value)} />
      {needsDueDate && (
        <Input type="date" className="w-44" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      )}
      <Button
        className="activity-composer-submit self-end"
        size="sm"
        disabled={!note || createActivity.isPending}
        onClick={() =>
          createActivity.mutate({
            type,
            body: note,
            ...ids,
            dueDate: dueDate ? new Date(dueDate) : undefined,
          })
        }
      >
        {submitLabel}
      </Button>
    </div>
  );
}

function EmailComposer({ contactId, onSuccess }: { contactId: string; onSuccess: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendEmail = trpc.email.send.useMutation({
    onSuccess: () => {
      setSubject("");
      setBody("");
      onSuccess();
      toast.success("Email sent");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <Textarea placeholder="Write your email…" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button
        className="self-end"
        size="sm"
        disabled={!subject || !body || sendEmail.isPending}
        onClick={() => sendEmail.mutate({ contactId, subject, body })}
      >
        {sendEmail.isPending ? "Sending…" : "Send Email"}
      </Button>
    </div>
  );
}

function ActivityIcon({ activity, call }: { activity: Activity; call: CallMetadata | null }) {
  if (activity.type === "CALL") {
    const connected = call?.status === "completed" || call?.status === "in-progress";
    const Icon = connected ? PhoneCall : PhoneMissed;
    return (
      <span
        className="call-ico flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: connected ? "color-mix(in oklab, var(--good) 16%, transparent)" : "color-mix(in oklab, var(--warn) 16%, transparent)",
          color: connected ? "var(--good)" : "var(--warn)",
        }}
      >
        <Icon className="size-3.5" />
      </span>
    );
  }
  const Icon =
    activity.type === "EMAIL" ? Mail : activity.type === "MEETING" ? CalendarClock : activity.type === "TASK" ? CheckSquare : StickyNote;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}

function ActivityList({
  activities,
  emptyLabel,
  onComplete,
  completing,
}: {
  activities: Activity[];
  emptyLabel: string;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {activities.map((activity) => {
        const overdue =
          activity.type === "TASK" &&
          !activity.completedAt &&
          activity.dueDate &&
          new Date(activity.dueDate) < new Date();
        const call = getCallMetadata(activity);
        return (
          <div key={activity.id} className="flex gap-3 rounded-md border border-border bg-card p-3">
            <ActivityIcon activity={activity} call={call} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {activity.type === "TASK" && (
                    <Checkbox
                      checked={!!activity.completedAt}
                      disabled={!!activity.completedAt || completing}
                      onCheckedChange={() => onComplete(activity.id)}
                    />
                  )}
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                  {call?.status && <Badge variant="outline">{call.status}</Badge>}
                </div>
                <span className="mono-num shrink-0 text-xs text-muted-foreground">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
              {activity.body && (
                <p
                  className={cn(
                    "mt-2 text-sm whitespace-pre-wrap",
                    activity.completedAt ? "text-muted-foreground line-through" : "text-card-foreground",
                  )}
                >
                  {activity.body}
                </p>
              )}
              {activity.dueDate && (
                <p className="mono-num mt-1 text-xs text-muted-foreground">
                  Due {new Date(activity.dueDate).toLocaleDateString()}
                </p>
              )}
              {call && (call.to || call.from) && (
                <p className="mono-num mt-2 text-sm text-card-foreground">
                  {call.from ?? "—"} → {call.to ?? "—"}
                  {call.durationSeconds
                    ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, "0")}`
                    : ""}
                </p>
              )}
              {call?.recordingSid && (
                <audio
                  className="mt-2 h-9 w-full"
                  controls
                  preload="none"
                  src={`/api/twilio/recording/${call.recordingSid}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentsPanel({ entity }: { entity: { entityType: EntityType; entityId: string } }) {
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = trpc.attachment.forEntity.useQuery(entity);

  const invalidate = () => utils.attachment.forEntity.invalidate(entity);

  const createAttachment = trpc.attachment.create.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("File attached");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAttachment = trpc.attachment.delete.useMutation({
    onSuccess: invalidate,
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
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entity.entityType);
      formData.append("entityId", entity.entityId);
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
        entityType: entity.entityType,
        entityId: entity.entityId,
        fileName: uploaded.name,
        blobPathname: uploaded.pathname,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading || createAttachment.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading || createAttachment.isPending ? "Uploading…" : "Upload file"}
        </Button>
      </div>
      {attachments.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !attachments.data || attachments.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.data.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-2 rounded-md bg-card p-3">
              <a
                href={`/api/attachments/${file.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-card-foreground hover:text-accent-foreground"
              >
                {file.fileName}
              </a>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{humanFileSize(file.fileSize)}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={deleteAttachment.isPending}
                  onClick={() => deleteAttachment.mutate({ id: file.id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityTimeline({
  activities,
  contactId,
  dealId,
  onChanged,
}: {
  activities: Activity[];
  contactId?: string;
  dealId?: string;
  onChanged: () => void;
}) {
  const ids: ComposableIds = { contactId, dealId };
  const entity = resolveEntity(ids);

  const completeActivity = trpc.activity.complete.useMutation({
    onSuccess: onChanged,
    onError: (err) => toast.error(err.message),
  });

  const notes = activities.filter((a) => a.type === "NOTE");
  const calls = activities.filter((a) => a.type === "CALL");
  const emails = activities.filter((a) => a.type === "EMAIL");
  const meetings = activities.filter((a) => a.type === "MEETING");
  const tasks = activities.filter((a) => a.type === "TASK");

  const handleComplete = (id: string) => completeActivity.mutate({ id });

  return (
    <Tabs defaultValue="NOTE" className="flex flex-col gap-4">
      <TabsList variant="line" className="border-b border-border">
        <TabsTrigger value="NOTE" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Notes
        </TabsTrigger>
        <TabsTrigger value="CALL" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Calls
        </TabsTrigger>
        <TabsTrigger value="TEXT" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Texts
        </TabsTrigger>
        <TabsTrigger value="EMAIL" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Emails
        </TabsTrigger>
        <TabsTrigger value="MEETING" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Meetings
        </TabsTrigger>
        <TabsTrigger value="TASK" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Tasks
        </TabsTrigger>
        <TabsTrigger value="ATTACHMENT" className="after:bg-accent-foreground data-active:text-accent-foreground">
          Attachments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="NOTE" className="flex flex-col gap-4">
        <ActivityComposer
          type="NOTE"
          placeholder="Add a note…"
          submitLabel="Add Note"
          successLabel="Note added"
          needsDueDate={false}
          ids={ids}
          onSuccess={onChanged}
        />
        <ActivityList
          activities={notes}
          emptyLabel="No notes yet."
          onComplete={handleComplete}
          completing={completeActivity.isPending}
        />
      </TabsContent>

      <TabsContent value="CALL" className="flex flex-col gap-4">
        <ActivityList
          activities={calls}
          emptyLabel="No calls yet."
          onComplete={handleComplete}
          completing={completeActivity.isPending}
        />
      </TabsContent>

      <TabsContent value="TEXT" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Text messaging isn&apos;t connected yet.</p>
      </TabsContent>

      <TabsContent value="EMAIL" className="flex flex-col gap-4">
        {contactId ? (
          <EmailComposer contactId={contactId} onSuccess={onChanged} />
        ) : (
          <p className="text-sm text-muted-foreground">No contact linked to send an email to.</p>
        )}
        <ActivityList
          activities={emails}
          emptyLabel="No emails yet."
          onComplete={handleComplete}
          completing={completeActivity.isPending}
        />
      </TabsContent>

      <TabsContent value="MEETING" className="flex flex-col gap-4">
        <ActivityComposer
          type="MEETING"
          placeholder="Meeting details…"
          submitLabel="Add Meeting"
          successLabel="Meeting created"
          needsDueDate
          ids={ids}
          onSuccess={onChanged}
        />
        <ActivityList
          activities={meetings}
          emptyLabel="No meetings yet."
          onComplete={handleComplete}
          completing={completeActivity.isPending}
        />
      </TabsContent>

      <TabsContent value="TASK" className="flex flex-col gap-4">
        <ActivityComposer
          type="TASK"
          placeholder="What needs to happen?"
          submitLabel="Add Task"
          successLabel="Task created"
          needsDueDate
          ids={ids}
          onSuccess={onChanged}
        />
        <ActivityList
          activities={tasks}
          emptyLabel="No tasks yet."
          onComplete={handleComplete}
          completing={completeActivity.isPending}
        />
      </TabsContent>

      <TabsContent value="ATTACHMENT" className="flex flex-col gap-4">
        {entity ? (
          <AttachmentsPanel entity={entity} />
        ) : (
          <p className="text-sm text-muted-foreground">No record to attach files to.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
