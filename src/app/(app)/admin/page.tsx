"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { PipelineStagesPanel } from "@/components/admin/pipeline-stages-panel";
import { CustomFieldsPanel } from "@/components/admin/custom-fields-panel";
import { TagsPanel } from "@/components/admin/tags-panel";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { Skeleton } from "@/components/ui/skeleton";

const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border border-border",
    card: "bg-card",
    navbar: "bg-card border-border",
    scrollBox: "bg-card",
  },
};

export default function AdminPage() {
  const { isAdmin, isLoading } = useCurrentRole();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Admin</h1>
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace & Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="pipeline">Pipeline Stages</TabsTrigger>}
          {isAdmin && <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>}
          {isAdmin && <TabsTrigger value="tags">Tags</TabsTrigger>}
          {isAdmin && <TabsTrigger value="api-keys">API Keys</TabsTrigger>}
          {isAdmin && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
        </TabsList>
        <TabsContent value="workspace">
          <OrganizationProfile appearance={clerkAppearance} routing="hash" />
        </TabsContent>
        {isAdmin && (
          <>
            <TabsContent value="pipeline">
              <PipelineStagesPanel />
            </TabsContent>
            <TabsContent value="custom-fields">
              <CustomFieldsPanel />
            </TabsContent>
            <TabsContent value="tags">
              <TagsPanel />
            </TabsContent>
            <TabsContent value="api-keys">
              <ApiKeysPanel />
            </TabsContent>
            <TabsContent value="audit-log">
              <AuditLogPanel />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
