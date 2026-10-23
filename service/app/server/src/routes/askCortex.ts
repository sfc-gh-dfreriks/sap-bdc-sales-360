import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { runQuery, isSpcs } from "../services/snowflake.js";

// ================================================================ Ask Cortex
// Each topic is a set of SQL "facts" the model must treat as authoritative.
// Queries mirror the page endpoints in api.ts, aggregated/limited to stay small.
const router = Router();
const L2 = "APP_DATA";
const MODEL = process.env.CORTEX_MODEL ?? "claude-sonnet-4-5";

type Facts = (args: Record<string, string>) => Promise<Record<string, unknown>>;
const T = (sql: string, binds: string[] = []) => runQuery(sql, binds);
const first = async (sql: string) => (await T(sql))[0];

const AS_OF = `ref AS (SELECT COALESCE(MAX(LAST_MODIFIED_DATE)::DATE, CURRENT_DATE()) AS as_of FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY)`;
const STALE = "IS_CLOSED='False' AND DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) >= 10 AND DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) >= 180";

const q = {
  kpis: `SELECT
      (SELECT SUM(TOTALNETAMOUNT) FROM ${L2}.SALESORDERS_SALESORDER) AS total_revenue,
      (SELECT COUNT(DISTINCT SALESORDER) FROM ${L2}.SALESORDERS_SALESORDER) AS total_orders,
      (SELECT COUNT(DISTINCT SOLDTOPARTY) FROM ${L2}.SALESORDERS_SALESORDER) AS total_customers,
      (SELECT SUM(AMOUNT) FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY) AS total_pipeline,
      (SELECT ROUND(100*COUNT_IF(IS_WON='True')/NULLIF(COUNT_IF(IS_CLOSED='True'),0),1) FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY) AS win_rate_pct`,
  topCustomers: `SELECT c.CUSTOMERNAME AS customer, SUM(s.TOTALNETAMOUNT) AS revenue
      FROM ${L2}.SALESORDERS_SALESORDER s JOIN ${L2}.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  byCountry: `SELECT c.COUNTRY AS country, COUNT(DISTINCT s.SALESORDER) AS orders, SUM(s.TOTALNETAMOUNT) AS revenue
      FROM ${L2}.SALESORDERS_SALESORDER s JOIN ${L2}.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
      WHERE s.TOTALNETAMOUNT > 0 GROUP BY 1 ORDER BY 3 DESC LIMIT 15`,
  revenueByMonth: `SELECT TO_CHAR(DATE_TRUNC('MONTH', TO_DATE(SALESORDERDATE)),'YYYY-MM') AS month, SUM(TOTALNETAMOUNT) AS revenue
      FROM ${L2}.SALESORDERS_SALESORDER WHERE SALESORDERDATE >= '2023-01-01' GROUP BY 1 ORDER BY 1`,
  mlForecast: `SELECT TO_CHAR(TS,'YYYY-MM') AS month, FORECAST AS forecast, LOWER_BOUND AS lower, UPPER_BOUND AS upper
      FROM ${L2}.SALES_REVENUE_PREDICTIONS ORDER BY TS`,
  funnelKpis: `WITH ${AS_OF} SELECT COUNT(*) AS total_deals,
      SUM(IFF(IS_CLOSED='False',AMOUNT,0)) AS open_pipeline, SUM(IFF(IS_WON='True',AMOUNT,0)) AS won_value,
      SUM(IFF(IS_CLOSED='True' AND IS_WON='False',AMOUNT,0)) AS lost_value, ROUND(AVG(AMOUNT),0) AS avg_deal_size,
      ROUND(AVG(IFF(IS_CLOSED='False', DATEDIFF('day', CREATED_DATE::DATE, ref.as_of), NULL)),0) AS avg_days_open,
      COUNT_IF(${STALE}) AS stale_count, SUM(IFF(${STALE},AMOUNT,0)) AS stale_amount, MAX(ref.as_of) AS as_of_date
      FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY, ref`,
  stages: `SELECT STAGE_NAME AS stage, COUNT(*) AS deals, SUM(AMOUNT) AS amount, ROUND(AVG(PROBABILITY),1) AS avg_probability
      FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY GROUP BY 1 ORDER BY 3 DESC`,
  winLossBySource: `SELECT LEAD_SOURCE AS lead_source, COUNT_IF(IS_WON='True') AS won, COUNT_IF(IS_WON='False') AS lost,
      SUM(IFF(IS_WON='True',AMOUNT,0)) AS won_amount, SUM(IFF(IS_WON='False',AMOUNT,0)) AS lost_amount
      FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY WHERE IS_CLOSED='True' GROUP BY 1 ORDER BY 4 DESC`,
  staleDeals: `WITH ${AS_OF} SELECT NAME AS deal, STAGE_NAME AS stage, AMOUNT AS amount, OWNER_NAME AS rep,
      DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) AS days_open, DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) AS days_since_update
      FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY, ref WHERE ${STALE} ORDER BY AMOUNT DESC LIMIT 15`,
  customerHealth: `WITH rev AS (SELECT c.CUSTOMERNAME AS customer, SUM(s.TOTALNETAMOUNT) AS revenue
        FROM ${L2}.SALESORDERS_SALESORDER s JOIN ${L2}.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER GROUP BY 1),
      opp AS (SELECT SPLIT_PART(NAME,' - ',1) AS customer, COUNT(*) AS total_opps, COUNT_IF(IS_CLOSED='False') AS open_opps,
        COUNT_IF(IS_WON='True') AS won_opps, COUNT_IF(IS_CLOSED='True' AND IS_WON='False') AS lost_opps,
        SUM(IFF(IS_CLOSED='False',AMOUNT,0)) AS open_pipeline FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY GROUP BY 1)
      SELECT r.customer, r.revenue, COALESCE(o.total_opps,0) total_opps, COALESCE(o.open_opps,0) open_opps,
        COALESCE(o.won_opps,0) won_opps, COALESCE(o.lost_opps,0) lost_opps, COALESCE(o.open_pipeline,0) open_pipeline
      FROM rev r LEFT JOIN opp o ON r.customer = o.customer ORDER BY r.revenue DESC LIMIT 25`,
  atRiskCustomers: `SELECT SPLIT_PART(NAME,' - ',1) AS customer, COUNT_IF(IS_CLOSED='True' AND IS_WON='False') AS lost_opps,
      COUNT_IF(IS_WON='True') AS won_opps, SUM(IFF(IS_CLOSED='False',AMOUNT,0)) AS open_pipeline
      FROM ${L2}.CRM_OPPORTUNITY_OPPORTUNITY GROUP BY 1 HAVING lost_opps > won_opps ORDER BY open_pipeline DESC LIMIT 15`,
  productKpis: `SELECT COUNT(DISTINCT MATERIAL) AS products, COUNT(DISTINCT PRODUCTGROUP) AS product_groups,
      SUM(NETAMOUNT) AS total_revenue, COUNT(DISTINCT SALESORDER) AS orders, ROUND(AVG(NETAMOUNT),0) AS avg_item_value
      FROM ${L2}.SALESORDERS_SALESORDERITEM WHERE NETAMOUNT > 0`,
  topProducts: `SELECT COALESCE(d.PRODUCTDESCRIPTION, i.MATERIAL) AS product, COUNT(DISTINCT i.SALESORDER) AS orders,
      SUM(i.NETAMOUNT) AS revenue, ROUND(AVG(i.NETAMOUNT),0) AS avg_price
      FROM ${L2}.SALESORDERS_SALESORDERITEM i LEFT JOIN ${L2}.PRODUCT_PRODUCTDESCRIPTION d ON i.MATERIAL = d.PRODUCT AND d.LANGUAGE = 'EN'
      WHERE i.NETAMOUNT > 0 GROUP BY 1 ORDER BY 3 DESC LIMIT 15`,
  productGroups: `SELECT COALESCE(gt.PRODUCTGROUPNAME, i.PRODUCTGROUP) AS product_group, SUM(i.NETAMOUNT) AS revenue
      FROM ${L2}.SALESORDERS_SALESORDERITEM i LEFT JOIN ${L2}.PRODUCT_PRODUCTGROUPTEXT gt ON i.PRODUCTGROUP = gt.PRODUCTGROUP AND gt.LANGUAGE = 'EN'
      WHERE i.NETAMOUNT > 0 AND i.PRODUCTGROUP IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
  productQuarterly: `SELECT TO_CHAR(DATE_TRUNC('QUARTER', TO_DATE(s.SALESORDERDATE)),'YYYY-"Q"Q') AS qtr, SUM(i.NETAMOUNT) AS revenue,
      COUNT(DISTINCT i.MATERIAL) AS products_sold
      FROM ${L2}.SALESORDERS_SALESORDERITEM i JOIN ${L2}.SALESORDERS_SALESORDER s ON i.SALESORDER = s.SALESORDER
      WHERE i.NETAMOUNT > 0 AND s.SALESORDERDATE >= '2023-01-01' GROUP BY 1 ORDER BY 1`,
  reps: `SELECT r.FULL_NAME AS rep, r.REGION AS region, SUM(IFF(o.IS_WON='True',o.AMOUNT,0)) AS won,
      SUM(IFF(o.IS_CLOSED='False',o.AMOUNT,0)) AS open_pipeline, MAX(r.QUOTA_AMOUNT) AS quota,
      ROUND(100*SUM(IFF(o.IS_WON='True',o.AMOUNT,0))/NULLIF(MAX(r.QUOTA_AMOUNT),0),1) AS quota_pct,
      ROUND(100*SUM(IFF(o.IS_CLOSED='False',o.AMOUNT,0))/NULLIF(MAX(r.QUOTA_AMOUNT),0),1) AS coverage_pct
      FROM ${L2}.CRM_OPPORTUNITY_SALES_REP r JOIN ${L2}.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25`,
  regions: `WITH rq AS (SELECT REGION, SUM(Q) AS quota FROM (SELECT FULL_NAME, REGION, MAX(QUOTA_AMOUNT) Q FROM ${L2}.CRM_OPPORTUNITY_SALES_REP GROUP BY 1,2) GROUP BY 1)
      SELECT r.REGION AS region, COUNT(DISTINCT r.FULL_NAME) AS reps, SUM(o.AMOUNT) AS pipeline,
      SUM(IFF(o.IS_WON='True',o.AMOUNT,0)) AS won, rq.quota, ROUND(100*SUM(IFF(o.IS_WON='True',o.AMOUNT,0))/NULLIF(rq.quota,0),1) AS attainment_pct
      FROM ${L2}.CRM_OPPORTUNITY_SALES_REP r JOIN ${L2}.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
      LEFT JOIN rq ON r.REGION = rq.REGION GROUP BY r.REGION, rq.quota ORDER BY won DESC`,
  activities: `SELECT ACTIVITY_TYPE AS activity_type, COUNT(*) AS activities, SUM(DURATION_MINUTES) AS minutes, COUNT(DISTINCT OWNER_NAME) AS reps
      FROM ${L2}.CRM_OPPORTUNITY_ACTIVITY WHERE IS_DELETED = 'False' GROUP BY 1 ORDER BY 2 DESC`,
  forecastByVersion: `SELECT FORECAST_VERSION AS version, SUM(FORECAST_AMOUNT) AS forecast, SUM(ACTUAL_AMOUNT) AS actual,
      SUM(VARIANCE_AMOUNT) AS variance, ROUND(AVG(ATTAINMENT_PCT),1) AS avg_attainment_pct
      FROM ${L2}.SALES_FORECAST_VS_ACTUAL GROUP BY 1 ORDER BY 1`,
  forecastByGroup: `SELECT COALESCE(gt.PRODUCTGROUPNAME, f.PRODUCTGROUP) AS product_group, f.FISCAL_YEAR AS fiscal_year,
      SUM(f.FORECAST_AMOUNT) AS forecast, SUM(f.ACTUAL_AMOUNT) AS actual, ROUND(AVG(f.ATTAINMENT_PCT),1) AS attainment_pct
      FROM ${L2}.SALES_FORECAST_VS_ACTUAL f LEFT JOIN ${L2}.PRODUCT_PRODUCTGROUPTEXT gt ON f.PRODUCTGROUP = gt.PRODUCTGROUP AND gt.LANGUAGE = 'EN'
      WHERE f.FORECAST_VERSION = 'PLAN' AND f.PRODUCTGROUP != 'GENERAL' GROUP BY 1,2 HAVING SUM(f.FORECAST_AMOUNT) > 0 ORDER BY 1,2 LIMIT 60`,
  forecastTrend: `SELECT TO_CHAR(PERIOD_DATE,'YYYY-MM') AS month, SUM(FORECAST_AMOUNT) AS forecast, SUM(ACTUAL_AMOUNT) AS actual
      FROM ${L2}.SALES_FORECAST_VS_ACTUAL WHERE FORECAST_VERSION = 'PLAN' GROUP BY 1 ORDER BY 1`,
  attainmentPredictions: `SELECT TO_CHAR(MONTH,'YYYY-MM') AS month, FORECAST AS forecast, LOWER_BOUND AS lower, UPPER_BOUND AS upper
      FROM ${L2}.ATTAINMENT_PREDICTIONS WHERE FORECAST_VERSION = 'PLAN' ORDER BY MONTH`,
};

export const TOPICS: Record<string, { title: string; facts: Facts }> = {
  general: { title: "overall sales performance across orders, pipeline, customers, products, reps and forecast", facts: async () => ({
    kpis: await first(q.kpis),
    top_customers: await T(q.topCustomers),
    revenue_by_month: await T(q.revenueByMonth),
    pipeline_kpis: await first(q.funnelKpis),
    stages: await T(q.stages),
    top_products: (await T(q.topProducts)).slice(0, 8),
    regions: await T(q.regions),
    forecast_by_version: await T(q.forecastByVersion),
  }) },
  dashboard: { title: "sales dashboard: revenue, orders, pipeline, top customers and countries", facts: async () => ({
    kpis: await first(q.kpis),
    top_customers: await T(q.topCustomers),
    revenue_by_country: await T(q.byCountry),
    revenue_by_month: await T(q.revenueByMonth),
    ml_revenue_forecast: await T(q.mlForecast),
  }) },
  funnel: { title: "sales funnel: pipeline stages, win/loss by lead source and stale deals", facts: async () => ({
    kpis: await first(q.funnelKpis),
    stages: await T(q.stages),
    win_loss_by_source: await T(q.winLossBySource),
    stale_deals: await T(q.staleDeals),
  }) },
  health: { title: "customer health: revenue vs. opportunity win/loss and open pipeline", facts: async () => ({
    top_customers_by_revenue: await T(q.customerHealth),
    customers_losing_more_than_winning: await T(q.atRiskCustomers),
  }) },
  products: { title: "product and product-group sales performance", facts: async () => ({
    kpis: await first(q.productKpis),
    top_products: await T(q.topProducts),
    product_groups: await T(q.productGroups),
    quarterly_revenue: await T(q.productQuarterly),
  }) },
  leaderboard: { title: "sales rep leaderboard: quota attainment, pipeline coverage, regions and activity", facts: async () => ({
    reps: await T(q.reps),
    regions: await T(q.regions),
    activities: await T(q.activities),
  }) },
  forecast: { title: "sales forecast vs. actuals and attainment predictions", facts: async () => ({
    by_version: await T(q.forecastByVersion),
    plan_trend: await T(q.forecastTrend),
    plan_by_product_group: await T(q.forecastByGroup),
    attainment_predictions: await T(q.attainmentPredictions),
  }) },
};

const SYSTEM = `Before answering, check that every number and characterisation in your summary (profit vs loss, up vs down, ages, counts, totals) matches the facts and any table you include; never state a figure the facts do not support.
You are Snowflake Cortex, an SAP sales analyst. Data comes from SAP Business Data Cloud data products
(sales orders, order items, customers, products) in APP_DATA, plus CRM opportunity, sales rep,
activity and forecast tables that are demo/simulated enrichment. The demo data is not refreshed, so deal ages are
measured from the latest update date in the data (as_of_date), not today. Amounts are in the order/document currency.

Rules:
- The JSON facts below are authoritative. Cite specific customers, products, reps, regions, stages, months,
  percentages and amounts from them. Never invent numbers.
- Lead with the direct answer in one or two sentences, then evidence (a small markdown table when comparing),
  then 2-4 concrete recommended actions.
- If the facts do not cover the question, say so plainly and suggest which page or data would.
- When you rely on CRM pipeline, rep, activity or forecast data, note briefly that it is demo/simulated.
- Keep it under 300 words.`;

// Inside the Native App, Cortex needs the consumer to grant SNOWFLAKE.CORTEX_USER to the application.
function friendlyError(err: unknown): string {
  const msg = String(err);
  if (isSpcs() && /cortex|not authorized|insufficient privileges|unknown function|does not exist/i.test(msg)) {
    return "Ask Cortex is not available in this installation. An account admin can enable it with: " +
      "GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO APPLICATION <app name>; (Cortex must also be available in this region.) Details: " + msg;
  }
  return msg;
}

interface Job { status: "running" | "done" | "error"; answer?: string; error?: string; started: number }
const jobs = new Map<string, Job>();

export async function runAsk(topic: string, args: Record<string, string>, question: string): Promise<string> {
  const t = TOPICS[topic];
  const facts = await t.facts(args);
  const ask = question?.trim() || `Analyse this ${t.title}: what stands out, why, and what should we do?`;
  const prompt = `${SYSTEM}\n\nTopic: ${t.title}\nContext: ${JSON.stringify(args)}\n\nFACTS (JSON):\n${JSON.stringify(facts).slice(0, 60000)}\n\nQuestion: ${ask}`;
  const rows = await runQuery(`SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?) AS answer`, [MODEL, prompt]);
  const r = rows[0] as Record<string, unknown> | undefined;
  return String(r?.ANSWER ?? r?.answer ?? "No answer returned.");
}

router.get("/api/ask-cortex/topics", (_req, res) => {
  res.json(Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, v.title])));
});

router.post("/api/ask-cortex", (req: Request, res: Response) => {
  const { topic, args = {}, question = "" } = req.body ?? {};
  if (typeof topic !== "string" || !TOPICS[topic]) return res.status(400).json({ error: "unknown topic" });
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) if (typeof v === "string" && v.length < 80) clean[k] = v;
  const id = crypto.randomUUID();
  jobs.set(id, { status: "running", started: Date.now() });
  runAsk(topic, clean, String(question).slice(0, 1000))
    .then((answer) => jobs.set(id, { status: "done", answer, started: Date.now() }))
    .catch((err) => jobs.set(id, { status: "error", error: friendlyError(err), started: Date.now() }));
  // Prune jobs older than an hour.
  for (const [k, j] of jobs) if (Date.now() - j.started > 3_600_000) jobs.delete(k);
  res.json({ id });
});

router.get("/api/ask-cortex/:id", (req: Request, res: Response) => {
  const j = jobs.get(String(req.params.id));
  if (!j) return res.status(404).json({ error: "job not found" });
  res.json(j);
});

export default router;
