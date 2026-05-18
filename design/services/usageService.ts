
export interface ModelUsage {
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

export interface DayUsage {
  models: Record<string, ModelUsage>;
}

export interface UsageData {
  days: Record<string, DayUsage>; // key: "YYYY-MM-DD"
}

export async function recordUsage(
  model: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  fetch('/api/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, model, tokensIn, tokensOut }),
  }).catch(() => {}); // fire-and-forget — never block the UI
}

export async function loadUsage(): Promise<UsageData> {
  const res = await fetch('/api/usage').catch(() => null);
  if (!res?.ok) return { days: {} };
  return res.json();
}
