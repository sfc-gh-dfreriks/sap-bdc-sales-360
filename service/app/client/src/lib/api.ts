const BASE = '/api';

function camelizeKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[camelizeKey(k)] = camelizeKeys(v);
    }
    return out;
  }
  return obj;
}

function buildParams(include: string[], exclude: string[]): string {
  const params = new URLSearchParams();
  if (include.length) params.set('include', include.join(','));
  if (exclude.length) params.set('exclude', exclude.join(','));
  return params.toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return camelizeKeys(json) as T;
}

export function fetchCustomers(): Promise<string[]> {
  return get('/customers');
}

export function fetchDashboard(include: string[], exclude: string[]) {
  const qs = buildParams(include, exclude);
  return get<any>(`/dashboard?${qs}`);
}

export function fetchFunnel() {
  return get<any>('/funnel');
}

export function fetchCustomerHealth(include: string[], exclude: string[]) {
  const qs = buildParams(include, exclude);
  return get<any>(`/customer-health?${qs}`);
}

export function fetchProducts() {
  return get<any>('/products');
}

export function fetchLeaderboard() {
  return get<any>('/leaderboard');
}

export function fetchForecast(version: string) {
  return get<any>(`/forecast?version=${version}`);
}

export async function fetchAnalyst(messages: { role: string; content: any }[]) {
  const res = await fetch(`${BASE}/analyst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchRunSql(sql: string) {
  const res = await fetch(`${BASE}/analyst/run-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }));
    throw new Error(err.error || 'Query failed');
  }
  return res.json();
}
