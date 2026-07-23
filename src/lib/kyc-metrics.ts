/** OpenPay public KYC Metrics API (no auth). https://openpy.space/admin-kyc-metrics */

export const KYC_METRICS_API_BASE =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/kyc-metrics-api";

export type KycPeriod = {
  label?: string;
  approved: number;
  previous?: number;
  change_pct?: number;
};

export type KycMetrics = {
  generated_at: string;
  source?: string;
  site?: string;
  users: {
    total: number;
    verified: number;
    verification_rate_pct: number;
  };
  applications: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    approval_rate_pct: number;
  };
  periods: {
    today?: KycPeriod;
    last_7_days?: KycPeriod;
    month?: KycPeriod;
    year?: KycPeriod;
  };
};

export type KycTimeseries = {
  generated_at: string;
  days: number;
  series: Array<{ date: string; approved: number }>;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${KYC_METRICS_API_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`KYC metrics API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function fetchKycMetrics() {
  return getJson<KycMetrics>("/metrics");
}

export function fetchKycTimeseries(days = 30) {
  const d = Math.min(365, Math.max(1, Math.floor(days)));
  return getJson<KycTimeseries>(`/timeseries?days=${d}`);
}

export function fetchKycHealth() {
  return getJson<{ ok: boolean; service?: string; time?: string }>("/health");
}
