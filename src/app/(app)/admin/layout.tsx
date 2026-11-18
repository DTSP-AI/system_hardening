import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth/app-user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const r = await getAppUser();
  if (r.status !== "ok") redirect("/no-access");
  if (r.user.role !== "OWNER" && r.user.role !== "ADMIN") redirect("/");
  return <>{children}</>;
}
