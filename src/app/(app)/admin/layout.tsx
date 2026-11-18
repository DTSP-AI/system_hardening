import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") {
    redirect("/");
  }
  return <>{children}</>;
}
