"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const promptTemplate = `다음 게임 기획서를 분석하고 JSON 형식으로 정리해줘.
출력 형식: docs/data_model.md의 JSON Import Schema를 따라줘.
기획서:
---
{기획서 원문}
---`;

export default function ImportPage() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function validate() {
    setErrors([]);
    setIsSubmitting(true);
    try {
      const parsed = JSON.parse(jsonText);
      const response = await fetch("/api/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.errors ?? [{ path: "json", message: result.error ?? "Validation failed" }]);
        return;
      }
      sessionStorage.setItem("pm_document_hub.import_preview", JSON.stringify(result.data));
      router.push("/import/preview");
    } catch (error) {
      setErrors([{ path: "json", message: error instanceof Error ? error.message : "Invalid JSON" }]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setJsonText(await file.text());
  }

  return (
    <section className="stack">
      <div>
        <h1>AI Pre-Review Import</h1>
        <p className="muted">외부 AI가 만든 JSON을 붙여넣습니다. 이 앱은 AI API를 호출하지 않습니다.</p>
      </div>

      <div className="panel stack">
        <h2>GPT 프롬프트</h2>
        <textarea className="textarea" readOnly value={promptTemplate} style={{ minHeight: 120 }} />
      </div>

      <div className="panel stack">
        <label className="label">
          JSON 붙여넣기
          <textarea className="textarea" value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
        </label>
        <label className="label">
          .json 파일 선택
          <input className="input" type="file" accept="application/json,.json" onChange={(event) => loadFile(event.target.files?.[0])} />
        </label>
        {errors.length > 0 ? (
          <div className="error">
            {errors.map((error) => (
              <div key={`${error.path}-${error.message}`}>
                {error.path}: {error.message}
              </div>
            ))}
          </div>
        ) : null}
        <div>
          <button className="button primary" type="button" onClick={validate} disabled={isSubmitting || !jsonText.trim()}>
            검증 및 미리보기
          </button>
        </div>
      </div>
    </section>
  );
}
