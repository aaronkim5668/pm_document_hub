"use client";

import { useEffect, useState } from "react";

type BudgetSettings = {
  monthly_budget_usd: string;
  current_month_spend: string;
  budget_month: string;
  is_locked: boolean;
  alert_threshold_pct: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState("0");
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/settings/budget");
    const result = await response.json();
    setSettings(result.settings);
    setMonthlyBudget(result.settings?.monthly_budget_usd ?? "0");
    setAlertThreshold(String(result.settings?.alert_threshold_pct ?? 80));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setMessage("");
    const response = await fetch("/api/settings/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_budget_usd: Number(monthlyBudget),
        alert_threshold_pct: Number(alertThreshold),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "저장 실패");
      return;
    }
    setSettings(result.settings);
    setMessage("저장되었습니다.");
  }

  return (
    <section className="stack">
      <div>
        <h1>Settings</h1>
        <p className="muted">Budget 설정만 제공합니다. 외부 AI 호출 기능은 없습니다.</p>
      </div>

      <div className="panel stack">
        <div className="grid">
          <label className="label">
            월 예산 USD
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={monthlyBudget}
              onChange={(event) => setMonthlyBudget(event.target.value)}
            />
          </label>
          <label className="label">
            경고 임계값 %
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={alertThreshold}
              onChange={(event) => setAlertThreshold(event.target.value)}
            />
          </label>
        </div>
        <div>
          <button className="button primary" type="button" onClick={save} disabled={Number(monthlyBudget) < 0}>
            저장
          </button>
        </div>
        {message ? <p className={message.includes("실패") || message.includes("non-negative") ? "error" : "muted"}>{message}</p> : null}
      </div>

      {settings ? (
        <div className="panel">
          <h2>현재 상태</h2>
          <p>월 예산: ${settings.monthly_budget_usd}</p>
          <p>이번 달 사용: ${settings.current_month_spend}</p>
          <p>예산 월: {settings.budget_month}</p>
          <p>잠금 상태: {settings.is_locked ? "locked" : "unlocked"}</p>
        </div>
      ) : null}
    </section>
  );
}
