import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppUser } from "@/lib/auth/app-user";

export default async function NoAccessPage() {
  const r = await getAppUser();
  if (r.status === "ok") redirect("/");
  if (r.status === "unauthenticated") redirect("/sign-in");

  const message =
    r.status === "unverified_email"
      ? "Verify your email address in your account, then reload."
      : r.status === "unavailable"
        ? "Account verification is temporarily unavailable. Reload to retry."
        : "This account does not have access. Contact your administrator.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-foreground">{message}</p>
          <SignOutButton redirectUrl="/sign-in">
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </CardContent>
      </Card>
    </div>
  );
}
