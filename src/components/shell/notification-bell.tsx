"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const unread = trpc.notification.unreadCount.useQuery();
  const list = trpc.notification.list.useQuery(undefined, { enabled: open });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const unreadCount = unread.data ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
          {!list.data?.length ? (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            list.data.map((n) => {
              const row = (
                <div
                  className="flex flex-col gap-0.5 rounded-md border border-border bg-card p-3"
                  onClick={() => !n.readAt && markRead.mutate({ id: n.id })}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-card-foreground">{n.title}</span>
                    {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                  {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              );
              return n.linkHref ? (
                <Link key={n.id} href={n.linkHref} onClick={() => setOpen(false)}>
                  {row}
                </Link>
              ) : (
                <div key={n.id}>{row}</div>
              );
            })
          )}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Mark all read
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
