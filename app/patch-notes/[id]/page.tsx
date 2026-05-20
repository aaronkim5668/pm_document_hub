import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { renderPatchNoteMarkdown } from "@/lib/patch-note-generator";

export default async function PatchNotePage({ params }: { params: { id: string } }) {
  const patchNote = await prisma.patchNote.findUnique({
    where: { id: params.id },
    include: {
      items: {
        orderBy: { order_index: "asc" },
      },
    },
  });

  if (!patchNote) {
    notFound();
  }

  const markdown = renderPatchNoteMarkdown({
    title: patchNote.title,
    release_version: patchNote.release_version,
    patch_date: patchNote.patch_date ? patchNote.patch_date.toISOString().slice(0, 10) : null,
    items: patchNote.items.map((item) => ({
      category: item.category,
      content: item.content,
    })),
  });

  return (
    <section className="stack">
      <div>
        <h1>{patchNote.title}</h1>
        <p className="muted">
          {patchNote.release_version} · {patchNote.status}
        </p>
      </div>
      <div className="panel">
        <textarea className="textarea" readOnly value={markdown} />
      </div>
    </section>
  );
}
