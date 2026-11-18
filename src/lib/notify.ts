import type { DbTx } from "@/lib/db";

/** Writes a Notification row inline from within a procedure's `ctx.db`. */
export function notify(
  db: DbTx,
  params: {
    userId: string;
    type:
      | "ACTIVITY"
      | "DEAL_STAGE_CHANGE"
      | "LEAD_CONVERTED";
    title: string;
    body?: string;
    linkHref?: string;
  },
) {
  return db.notification.create({ data: params });
}
