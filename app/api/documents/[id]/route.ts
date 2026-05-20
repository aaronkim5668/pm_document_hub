import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: [{ is_latest: "desc" }, { version_date: "desc" }, { uploaded_at: "desc" }],
        include: {
          normalized_doc: {
            include: {
              design_items: true,
            },
          },
          change_candidates: {
            orderBy: { created_at: "desc" },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}
