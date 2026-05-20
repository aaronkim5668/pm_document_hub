import { NextResponse } from "next/server";
import { validateImportJson } from "@/lib/json-schema";

export async function POST(request: Request) {
  const body = await request.json();
  const result = validateImportJson(body.payload);

  if (!result.success) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}
