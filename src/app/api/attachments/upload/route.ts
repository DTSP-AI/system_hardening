import { NextResponse } from "next/server";
import { requireAppUserForRoute } from "@/lib/auth/app-user";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  const guard = await requireAppUserForRoute();
  if (guard instanceof Response) return guard;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const blob = await put(`attachments/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return NextResponse.json({
    url: blob.url,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  });
}
