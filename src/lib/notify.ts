import type { ScopedTx } from "@/lib/db";

/** Writes a Notification row inline from within a tenantProcedure's `ctx.db`. */
export function notify(
  db: ScopedTx,
  tenantId: string,
  params: {
    userId: string;
    type:
      | "ACTIVITY"
      | "DEAL_STAGE_CHANGE"
      | "LEAD_CONVERTED"
      | "POLICY_STATUS_CHANGE"
      | "CLAIM_STATUS_CHANGE"
      | "PROJECT_STATUS_CHANGE"
      | "SERVICE_TICKET_STATUS_CHANGE";
    title: string;
    body?: string;
    linkHref?: string;
  },
) {
  return db.notification.create({ data: { ...params, tenantId } });
}
