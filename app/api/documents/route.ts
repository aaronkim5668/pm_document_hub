import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveApprovedImport } from "@/lib/import-service";
import { validateImportJson } from "@/lib/json-schema";

export async function POST(request: Request) {
  const body = await request.json();
  const validation = validateImportJson(body.payload);

  if (!validation.success) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  try {
    const result = await saveApprovedImport(validation.data, { prisma: prisma as any });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save import" },
      { status: 500 },
    );
  }
}
