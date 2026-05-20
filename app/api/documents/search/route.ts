import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchDocuments } from "@/lib/document-search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? undefined);

  const result = await searchDocuments(prisma as any, {
    query,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json(result);
}
