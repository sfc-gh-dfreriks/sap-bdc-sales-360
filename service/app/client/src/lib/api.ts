// Data access layer. Two modes:
//   - Live (default): fetch from the Express server at /api/*
//   - Static (VITE_STATIC=1): read pre-baked JSON snapshots from <base>/data/*
//     and route the Cortex agent to VITE_AGENT_URL (a serverless function).
// Note: the customer include/exclude filter is disabled in the static build
// (see Sidebar showFilters gate); dashboards show the all-customers snapshot.
const STATIC = import.meta.env.VITE_STATIC === '1';
const AGENT_BASE = (import.meta.env.VITE_AGENT_URL ?? '').replace(/\/$/, '');
const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const BASE = '/api';

function camelizeKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}
function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[camelizeKey(k)] = camelizeKeys(v);
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

async function liveGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return camelizeKeys(await res.json()) as T;
}

const fileCache = new Map<string, Promise<any>>();
function loadStaticFile(file: string): Promise<any> {
  let p = fileCache.get(file);
  if (!p) {
    p = fetch(`${DATA_BASE}/${file}.json`).then((res) => {
      if (!res.ok) throw new Error(`Static data error: ${res.status} ${file}`);
      return res.json();
    });
    fileCache.set(file, p);
  }
  return p;
}
async function staticGet<T>(file: string): Promise<T> {
  return camelizeKeys(await loadStaticFile(file)) as T;
}

export function fetchCustomers(): Promise<string[]> {
  if (STATIC) return loadStaticFile('customers');
  return liveGet('/customers');
}

export function fetchDashboard(include: string[], exclude: string[]) {
  if (STATIC) return staticGet<any>('dashboard');            // all customers
  return liveGet<any>(`/dashboard?${buildParams(include, exclude)}`);
}

export function fetchFunnel() {
  return STATIC ? staticGet<any>('funnel') : liveGet<any>('/funnel');
}

export function fetchCustomerHealth(include: string[], exclude: string[]) {
  if (STATIC) return staticGet<any>('customer-health');      // all customers
  return liveGet<any>(`/customer-health?${buildParams(include, exclude)}`);
}

export function fetchProducts() {
  return STATIC ? staticGet<any>('products') : liveGet<any>('/products');
}

export function fetchLineage() {
  return STATIC ? staticGet<any>('lineage') : liveGet<any>('/lineage');
}

export function fetchLeaderboard() {
  return STATIC ? staticGet<any>('leaderboard') : liveGet<any>('/leaderboard');
}

export async function fetchForecast(version: string) {
  if (STATIC) {
    const map = await loadStaticFile('forecast');
    return camelizeKeys(map[version] ?? map['PLAN'] ?? {});
  }
  return liveGet<any>(`/forecast?version=${version}`);
}

export async function fetchAnalyst(messages: { role: string; content: any }[]) {
  const base = STATIC ? AGENT_BASE : BASE;
  const res = await fetch(`${base}/analyst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchRunSql(sql: string) {
  const base = STATIC ? AGENT_BASE : BASE;
  const res = await fetch(`${base}/analyst/run-sql`, {
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
