import { createTRPCRouter } from "@/server/api/trpc";
import { membershipRouter } from "@/server/api/routers/membership";
import { leadRouter } from "@/server/api/routers/lead";
import { prospectingRouter } from "@/server/api/routers/prospecting";
import { contactRouter } from "@/server/api/routers/contact";
import { companyRouter } from "@/server/api/routers/company";
import { dealRouter } from "@/server/api/routers/deal";
import { pipelineStageRouter } from "@/server/api/routers/pipelineStage";
import { activityRouter } from "@/server/api/routers/activity";
import { emailRouter } from "@/server/api/routers/email";
import { apiKeyRouter } from "@/server/api/routers/apiKey";
import { customFieldDefinitionRouter } from "@/server/api/routers/customFieldDefinition";
import { todoRouter } from "@/server/api/routers/todo";
import { searchRouter } from "@/server/api/routers/search";
import { tagRouter } from "@/server/api/routers/tag";
import { notificationRouter } from "@/server/api/routers/notification";
import { carrierRouter } from "@/server/api/routers/carrier";
import { policyRouter } from "@/server/api/routers/policy";
import { commissionRouter } from "@/server/api/routers/commission";
import { claimRouter } from "@/server/api/routers/claim";
import { attachmentRouter } from "@/server/api/routers/attachment";
import { auditLogRouter } from "@/server/api/routers/auditLog";
import { dashboardRouter } from "@/server/api/routers/dashboard";

export const appRouter = createTRPCRouter({
  membership: membershipRouter,
  dashboard: dashboardRouter,
  lead: leadRouter,
  prospecting: prospectingRouter,
  contact: contactRouter,
  company: companyRouter,
  deal: dealRouter,
  pipelineStage: pipelineStageRouter,
  activity: activityRouter,
  email: emailRouter,
  apiKey: apiKeyRouter,
  customFieldDefinition: customFieldDefinitionRouter,
  todo: todoRouter,
  search: searchRouter,
  tag: tagRouter,
  notification: notificationRouter,
  carrier: carrierRouter,
  policy: policyRouter,
  commission: commissionRouter,
  claim: claimRouter,
  attachment: attachmentRouter,
  auditLog: auditLogRouter,
});

export type AppRouter = typeof appRouter;
