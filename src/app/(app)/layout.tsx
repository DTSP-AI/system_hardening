import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getAppUser } from "@/lib/auth/app-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const r = await getAppUser();
  if (r.status === "unauthenticated") redirect("/sign-in");
  if (r.status !== "ok") redirect("/no-access");
  return <AppShell>{children}</AppShell>;
}
