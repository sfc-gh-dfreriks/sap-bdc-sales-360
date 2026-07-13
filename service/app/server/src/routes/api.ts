import { Router, type Request, type Response } from "express";
import { runQuery, isSpcs } from "../services/snowflake.js";
import { callCortexAnalyst, generateJwt, type AnalystMessage } from "../services/analyst.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function customerWhere(
  include: string[],
  exclude: string[],
  col: string
): string {
  const clauses: string[] = [];
  if (include.length) {
    const escaped = include.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
    clauses.push(`${col} IN (${escaped})`);
  }
  if (exclude.length) {
    const escaped = exclude.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
    clauses.push(`${col} NOT IN (${escaped})`);
  }
  return clauses.length ? " AND " + clauses.join(" AND ") : "";
}

function parseFilter(req: Request): { include: string[]; exclude: string[] } {
  const inc = (req.query.include as string) ?? "";
  const exc = (req.query.exclude as string) ?? "";
  return {
    include: inc ? inc.split(",").map((s) => s.trim()).filter(Boolean) : [],
    exclude: exc ? exc.split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
}

async function parallelQueries(
  queries: Record<string, string>,
  includeKeys?: string[],
  excludeKeys?: string[]
): Promise<Record<string, unknown>> {
  const keys = Object.keys(queries).filter((k) => {
    if (includeKeys && includeKeys.length && !includeKeys.includes(k))
      return false;
    if (excludeKeys && excludeKeys.length && excludeKeys.includes(k))
      return false;
    return true;
  });
  const results = await Promise.all(keys.map((k) => runQuery(queries[k])));
  const out: Record<string, unknown> = {};
  keys.forEach((k, i) => {
    out[k] = results[i];
  });
  return out;
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
router.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/customers
// ---------------------------------------------------------------------------
router.get("/api/customers", async (_req: Request, res: Response) => {
  try {
    const rows = await runQuery(`
      SELECT DISTINCT c.CUSTOMERNAME AS CUSTOMER
      FROM APP_DATA.CUSTOMER_CUSTOMER c
      WHERE c.CUSTOMERNAME IS NOT NULL
      ORDER BY c.CUSTOMERNAME
    `);
    res.json(rows.map((r) => r.customer));
  } catch (err) {
    console.error("GET /api/customers error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------
router.get("/api/dashboard", async (req: Request, res: Response) => {
  try {
    const { include, exclude } = parseFilter(req);
    const orderFilter = customerWhere(include, exclude, "c.CUSTOMERNAME");
    const oppFilter = customerWhere(include, exclude, "SPLIT_PART(NAME, ' - ', 1)");

    const incKeys = req.query.includeKeys
      ? (req.query.includeKeys as string).split(",")
      : undefined;
    const excKeys = req.query.excludeKeys
      ? (req.query.excludeKeys as string).split(",")
      : undefined;

    const queries: Record<string, string> = {
      kpis: `
        SELECT
          (SELECT SUM(s.TOTALNETAMOUNT)
           FROM APP_DATA.SALESORDERS_SALESORDER s
           JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
           WHERE 1=1 ${orderFilter}) AS total_revenue,
          (SELECT COUNT(DISTINCT s.SALESORDER)
           FROM APP_DATA.SALESORDERS_SALESORDER s
           JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
           WHERE 1=1 ${orderFilter}) AS total_orders,
          (SELECT COUNT(DISTINCT s.SOLDTOPARTY)
           FROM APP_DATA.SALESORDERS_SALESORDER s
           JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
           WHERE 1=1 ${orderFilter}) AS total_customers,
          (SELECT SUM(AMOUNT)
           FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
           WHERE 1=1 ${oppFilter}) AS total_pipeline,
          (SELECT CASE WHEN COUNT(CASE WHEN IS_CLOSED='True' THEN 1 END) > 0
                  THEN ROUND(COUNT(CASE WHEN IS_WON='True' THEN 1 END) * 100.0
                       / COUNT(CASE WHEN IS_CLOSED='True' THEN 1 END), 1) ELSE 0 END
           FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
           WHERE 1=1 ${oppFilter}) AS win_rate
      `,
      top_customers: `
        SELECT c.CUSTOMERNAME AS customer,
               SUM(s.TOTALNETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDER s
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
        WHERE 1=1 ${orderFilter}
        GROUP BY c.CUSTOMERNAME
        ORDER BY revenue DESC
        LIMIT 10
      `,
      pipeline_by_stage: `
        WITH top_customers AS (
          SELECT SPLIT_PART(NAME, ' - ', 1) AS customer_name,
                 SUM(AMOUNT) AS total_pipeline
          FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
          WHERE IS_CLOSED = 'False' ${oppFilter}
          GROUP BY customer_name
          ORDER BY total_pipeline DESC
          LIMIT 10
        )
        SELECT tc.customer_name,
               o.STAGE_NAME AS stage_name,
               SUM(o.AMOUNT) AS pipeline_value
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o
        JOIN top_customers tc ON SPLIT_PART(o.NAME, ' - ', 1) = tc.customer_name
        WHERE o.IS_CLOSED = 'False'
        GROUP BY tc.customer_name, o.STAGE_NAME
        ORDER BY tc.customer_name, pipeline_value DESC
      `,
      sales_by_country: `
        SELECT c.COUNTRY AS country,
               COUNT(DISTINCT s.SALESORDER) AS order_count,
               SUM(s.TOTALNETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDER s
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
        WHERE s.TOTALNETAMOUNT > 0
        GROUP BY c.COUNTRY
        ORDER BY revenue DESC
      `,
      top_reps: `
        SELECT r.FULL_NAME AS full_name,
               r.REGION AS region,
               COUNT(o.ID) AS deals,
               SUM(o.AMOUNT) AS pipeline,
               SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) AS won,
               MAX(r.QUOTA_AMOUNT) AS quota,
               CASE WHEN MAX(r.QUOTA_AMOUNT) > 0
                    THEN ROUND(SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END)
                               / MAX(r.QUOTA_AMOUNT) * 100, 1)
                    ELSE NULL END AS quota_pct
        FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP r
        JOIN APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
        GROUP BY r.FULL_NAME, r.REGION
        ORDER BY won DESC
      `,
      revenue_trend: `
        SELECT DATE_TRUNC('MONTH', TO_DATE(SALESORDERDATE)) AS month,
               SUM(TOTALNETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDER
        WHERE SALESORDERDATE >= '2023-01-01'
        GROUP BY month
        ORDER BY month
      `,
      forecast: `
        SELECT TS AS month, FORECAST AS forecast, LOWER_BOUND AS lower, UPPER_BOUND AS upper
        FROM APP_DATA.SALES_REVENUE_PREDICTIONS
        ORDER BY TS
      `,
    };

    const data = await parallelQueries(queries, incKeys, excKeys);

    // Attach forecast history + metrics if forecast was requested
    if (data.forecast) {
      const [history, metrics] = await Promise.all([
        runQuery(`
          SELECT DATE_TRUNC('MONTH', CREATIONDATE) AS month,
                 SUM(TOTALNETAMOUNT) AS revenue
          FROM APP_DATA.SALESORDERS_SALESORDER
          WHERE CREATIONDATE IS NOT NULL
            AND CREATIONDATE >= DATEADD('MONTH', -24, CURRENT_DATE())
          GROUP BY 1 ORDER BY 1
        `),
        runQuery(`
          SELECT ERROR_METRIC AS metric, METRIC_VALUE AS value
          FROM APP_DATA.SALES_REVENUE_FORECAST_METRICS
        `),
      ]);
      data.forecast = { predictions: data.forecast, history, metrics };
    }

    // kpis is a single row → unwrap
    if (data.kpis && Array.isArray(data.kpis) && (data.kpis as unknown[]).length > 0) {
      data.kpis = (data.kpis as Record<string, unknown>[])[0];
    }

    res.json(data);
  } catch (err) {
    console.error("GET /api/dashboard error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/funnel
// ---------------------------------------------------------------------------
router.get("/api/funnel", async (_req: Request, res: Response) => {
  try {
    const queries: Record<string, string> = {
      kpis: `
        WITH ref AS (
          SELECT COALESCE(MAX(LAST_MODIFIED_DATE)::DATE, CURRENT_DATE()) AS as_of
          FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        )
        SELECT COUNT(*) AS total_deals,
               SUM(CASE WHEN IS_CLOSED='False' THEN AMOUNT ELSE 0 END) AS open_pipeline,
               SUM(CASE WHEN IS_WON='True' THEN AMOUNT ELSE 0 END) AS won_value,
               SUM(CASE WHEN IS_CLOSED='True' AND IS_WON='False' THEN AMOUNT ELSE 0 END) AS lost_value,
               AVG(AMOUNT) AS avg_deal_size,
               AVG(CASE WHEN IS_CLOSED='False' THEN DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) END) AS avg_days_open,
               COUNT(CASE WHEN IS_CLOSED='False' AND DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) > 30 THEN 1 END) AS stale_count,
               MAX(CASE WHEN IS_CLOSED='False' THEN DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) END) AS oldest_days,
               MAX(ref.as_of) AS as_of_date
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY, ref
      `,
      stages: `
        SELECT STAGE_NAME AS stage,
               COUNT(*) AS count,
               SUM(AMOUNT) AS sum_amount,
               AVG(PROBABILITY) AS avg_probability
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        GROUP BY STAGE_NAME
        ORDER BY sum_amount DESC
      `,
      sankey: `
        SELECT LEAD_SOURCE AS lead_source,
               TYPE AS type,
               CASE
                 WHEN IS_WON = 'True' THEN 'Closed Won'
                 WHEN IS_CLOSED = 'True' AND IS_WON = 'False' THEN 'Closed Lost'
                 ELSE 'Open'
               END AS outcome,
               COUNT(*) AS value,
               SUM(AMOUNT) AS amount
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        GROUP BY lead_source, type, outcome
      `,
      win_loss_by_source: `
        SELECT LEAD_SOURCE AS lead_source,
               SUM(CASE WHEN IS_WON='True' THEN AMOUNT ELSE 0 END) AS won_amount,
               SUM(CASE WHEN IS_CLOSED='True' AND IS_WON='False' THEN AMOUNT ELSE 0 END) AS lost_amount
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE IS_CLOSED = 'True'
        GROUP BY LEAD_SOURCE
        ORDER BY won_amount DESC
      `,
      aging: `
        WITH ref AS (
          SELECT COALESCE(MAX(LAST_MODIFIED_DATE)::DATE, CURRENT_DATE()) AS as_of
          FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        )
        SELECT ID AS id,
               NAME AS name,
               AMOUNT AS amount,
               STAGE_NAME AS stage,
               DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) AS days_open,
               DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) AS days_since_update
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY, ref
        WHERE IS_CLOSED = 'False'
        ORDER BY days_open DESC
      `,
      stale_deals: `
        WITH ref AS (
          SELECT COALESCE(MAX(LAST_MODIFIED_DATE)::DATE, CURRENT_DATE()) AS as_of
          FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        )
        SELECT NAME AS name,
               SPLIT_PART(NAME, ' - ', 1) AS customer,
               STAGE_NAME AS stage,
               AMOUNT AS amount,
               PROBABILITY AS probability,
               OWNER_NAME AS rep,
               DATEDIFF('day', CREATED_DATE::DATE, ref.as_of) AS days_open,
               DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) AS days_since_update
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY, ref
        WHERE IS_CLOSED = 'False'
          AND DATEDIFF('day', LAST_MODIFIED_DATE::DATE, ref.as_of) > 30
        ORDER BY days_since_update DESC
        LIMIT 50
      `,
    };

    const data = await parallelQueries(queries);
    if (data.kpis && Array.isArray(data.kpis) && (data.kpis as unknown[]).length > 0) {
      data.kpis = (data.kpis as Record<string, unknown>[])[0];
    }
    res.json(data);
  } catch (err) {
    console.error("GET /api/funnel error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/customer-health
// ---------------------------------------------------------------------------
router.get("/api/customer-health", async (req: Request, res: Response) => {
  try {
    const { include, exclude } = parseFilter(req);
    const revFilter = customerWhere(include, exclude, "c.CUSTOMERNAME");
    const oppFilter = customerWhere(include, exclude, "SPLIT_PART(NAME, ' - ', 1)");

    const queries: Record<string, string> = {
      customers: `
        WITH cust_rev AS (
          SELECT c.CUSTOMERNAME, SUM(s.TOTALNETAMOUNT) AS TOTAL_REVENUE
          FROM APP_DATA.SALESORDERS_SALESORDER s
          JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
          WHERE 1=1 ${revFilter}
          GROUP BY c.CUSTOMERNAME
        ),
        cust_opps AS (
          SELECT SPLIT_PART(NAME, ' - ', 1) AS CUST_NAME,
                 COUNT(*) AS TOTAL_OPPS,
                 SUM(CASE WHEN IS_CLOSED='False' THEN 1 ELSE 0 END) AS OPEN_OPPS,
                 SUM(CASE WHEN IS_WON='True' THEN 1 ELSE 0 END) AS WON_OPPS,
                 SUM(CASE WHEN IS_CLOSED='True' AND IS_WON='False' THEN 1 ELSE 0 END) AS LOST_OPPS,
                 SUM(CASE WHEN IS_CLOSED='False' THEN AMOUNT ELSE 0 END) AS OPEN_PIPELINE
          FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
          WHERE 1=1 ${oppFilter}
          GROUP BY CUST_NAME
        )
        SELECT r.CUSTOMERNAME AS customer_name,
               r.TOTAL_REVENUE AS revenue,
               COALESCE(o.TOTAL_OPPS, 0) AS total_opps,
               COALESCE(o.WON_OPPS, 0) AS won_opps,
               COALESCE(o.OPEN_OPPS, 0) AS open_opps,
               COALESCE(o.LOST_OPPS, 0) AS lost_opps,
               COALESCE(o.OPEN_PIPELINE, 0) AS open_pipeline,
               CASE
                 WHEN o.CUST_NAME IS NULL THEN 'No Opportunities'
                 WHEN o.OPEN_OPPS = 0 AND o.LOST_OPPS > 0 THEN 'All Lost'
                 WHEN o.OPEN_OPPS = 0 THEN 'No Pipeline'
                 WHEN o.LOST_OPPS > o.OPEN_OPPS THEN 'More Lost than Open'
                 ELSE 'Healthy'
               END AS health_status
        FROM cust_rev r
        LEFT JOIN cust_opps o ON r.CUSTOMERNAME = o.CUST_NAME
        ORDER BY r.TOTAL_REVENUE DESC
      `,
      revenue_trend: `
        WITH top_cust AS (
          SELECT c.CUSTOMERNAME, SUM(s.TOTALNETAMOUNT) AS REV
          FROM APP_DATA.SALESORDERS_SALESORDER s
          JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
          WHERE 1=1 ${revFilter}
          GROUP BY c.CUSTOMERNAME
          ORDER BY REV DESC
          LIMIT 10
        )
        SELECT c.CUSTOMERNAME AS customer,
               DATE_TRUNC('QUARTER', TO_DATE(s.SALESORDERDATE)) AS qtr,
               SUM(s.TOTALNETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDER s
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
        JOIN top_cust tc ON c.CUSTOMERNAME = tc.CUSTOMERNAME
        GROUP BY c.CUSTOMERNAME, qtr
        ORDER BY qtr, c.CUSTOMERNAME
      `,
      open_opps: `
        SELECT SPLIT_PART(NAME, ' - ', 1) AS customer,
               STAGE_NAME AS stage,
               AMOUNT AS amount,
               CLOSE_DATE AS close_date,
               PROBABILITY AS probability,
               OWNER_NAME AS rep
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE IS_CLOSED = 'False' ${oppFilter}
        ORDER BY AMOUNT DESC
        LIMIT 50
      `,
    };

    const data = await parallelQueries(queries);

    // Compute KPIs from customer data
    const customers = (data.customers ?? []) as Record<string, unknown>[];
    const totalPipeline = customers.reduce(
      (s, c) => s + (Number(c.open_pipeline) || 0),
      0
    );
    const healthCounts = { healthy: 0, warning: 0, at_risk: 0 };
    for (const c of customers) {
      const status = String(c.health_status ?? "");
      if (status === "Healthy") healthCounts.healthy++;
      else if (status === "No Pipeline" || status === "No Opportunities")
        healthCounts.warning++;
      else healthCounts.at_risk++;
    }
    data.kpis = {
      total: customers.length,
      healthy: healthCounts.healthy,
      warning: healthCounts.warning,
      at_risk: healthCounts.at_risk,
      open_pipeline: totalPipeline,
    };

    res.json(data);
  } catch (err) {
    console.error("GET /api/customer-health error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------------------------
router.get("/api/products", async (_req: Request, res: Response) => {
  try {
    const queries: Record<string, string> = {
      kpis: `
        SELECT COUNT(DISTINCT i.MATERIAL) AS products,
               COUNT(DISTINCT i.PRODUCTGROUP) AS product_groups,
               SUM(i.NETAMOUNT) AS total_revenue,
               COUNT(DISTINCT i.SALESORDER) AS orders,
               AVG(i.NETAMOUNT) AS avg_item_value
        FROM APP_DATA.SALESORDERS_SALESORDERITEM i
        WHERE i.NETAMOUNT > 0
      `,
      top_products: `
        SELECT COALESCE(d.PRODUCTDESCRIPTION, i.MATERIAL) AS product_name,
               i.MATERIAL AS product_id,
               COUNT(DISTINCT i.SALESORDER) AS order_count,
               SUM(i.NETAMOUNT) AS revenue,
               AVG(i.NETAMOUNT) AS avg_price
        FROM APP_DATA.SALESORDERS_SALESORDERITEM i
        LEFT JOIN APP_DATA.PRODUCT_PRODUCTDESCRIPTION d
          ON i.MATERIAL = d.PRODUCT AND d.LANGUAGE = 'EN'
        WHERE i.NETAMOUNT > 0
        GROUP BY product_name, i.MATERIAL
        ORDER BY revenue DESC
        LIMIT 20
      `,
      groups_treemap: `
        SELECT COALESCE(gt.PRODUCTGROUPNAME, i.PRODUCTGROUP) AS group_name,
               i.PRODUCTGROUP AS group_id,
               SUM(i.NETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDERITEM i
        LEFT JOIN APP_DATA.PRODUCT_PRODUCTGROUPTEXT gt
          ON i.PRODUCTGROUP = gt.PRODUCTGROUP AND gt.LANGUAGE = 'EN'
        WHERE i.NETAMOUNT > 0 AND i.PRODUCTGROUP IS NOT NULL
        GROUP BY group_name, i.PRODUCTGROUP
        ORDER BY revenue DESC
        LIMIT 15
      `,
      revenue_trend: `
        WITH top_prods AS (
          SELECT COALESCE(d.PRODUCTDESCRIPTION, i.MATERIAL) AS PNAME,
                 SUM(i.NETAMOUNT) AS REV
          FROM APP_DATA.SALESORDERS_SALESORDERITEM i
          LEFT JOIN APP_DATA.PRODUCT_PRODUCTDESCRIPTION d
            ON i.MATERIAL = d.PRODUCT AND d.LANGUAGE = 'EN'
          JOIN APP_DATA.SALESORDERS_SALESORDER s
            ON i.SALESORDER = s.SALESORDER
          WHERE i.NETAMOUNT > 0 AND s.SALESORDERDATE >= '2023-01-01'
          GROUP BY PNAME
          ORDER BY REV DESC
          LIMIT 8
        )
        SELECT tp.PNAME AS product,
               DATE_TRUNC('QUARTER', TO_DATE(s.SALESORDERDATE)) AS qtr,
               SUM(i.NETAMOUNT) AS revenue
        FROM APP_DATA.SALESORDERS_SALESORDERITEM i
        JOIN APP_DATA.SALESORDERS_SALESORDER s ON i.SALESORDER = s.SALESORDER
        LEFT JOIN APP_DATA.PRODUCT_PRODUCTDESCRIPTION d
          ON i.MATERIAL = d.PRODUCT AND d.LANGUAGE = 'EN'
        JOIN top_prods tp ON COALESCE(d.PRODUCTDESCRIPTION, i.MATERIAL) = tp.PNAME
        WHERE i.NETAMOUNT > 0 AND s.SALESORDERDATE >= '2023-01-01'
        GROUP BY tp.PNAME, qtr
        ORDER BY qtr
      `,
      by_country: `
        SELECT c.COUNTRY AS country,
               COUNT(DISTINCT i.MATERIAL) AS product_count,
               COUNT(DISTINCT i.SALESORDER) AS order_count
        FROM APP_DATA.SALESORDERS_SALESORDERITEM i
        JOIN APP_DATA.SALESORDERS_SALESORDER s ON i.SALESORDER = s.SALESORDER
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON s.SOLDTOPARTY = c.CUSTOMER
        WHERE i.NETAMOUNT > 0
        GROUP BY c.COUNTRY
        ORDER BY product_count DESC
      `,
    };

    const data = await parallelQueries(queries);
    if (data.kpis && Array.isArray(data.kpis) && (data.kpis as unknown[]).length > 0) {
      data.kpis = (data.kpis as Record<string, unknown>[])[0];
    }
    res.json(data);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard
// ---------------------------------------------------------------------------
router.get("/api/leaderboard", async (_req: Request, res: Response) => {
  try {
    const queries: Record<string, string> = {
      team_kpis: `
        SELECT SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) AS closed_won,
               SUM(CASE WHEN o.IS_CLOSED='False' THEN o.AMOUNT ELSE 0 END) AS open_pipeline,
               (SELECT SUM(Q) FROM (SELECT MAX(QUOTA_AMOUNT) AS Q FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP GROUP BY FULL_NAME)) AS team_quota,
               CASE WHEN (SELECT SUM(Q) FROM (SELECT MAX(QUOTA_AMOUNT) AS Q FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP GROUP BY FULL_NAME)) > 0
                    THEN ROUND(SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) * 100.0
                         / (SELECT SUM(Q) FROM (SELECT MAX(QUOTA_AMOUNT) AS Q FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP GROUP BY FULL_NAME)), 1)
                    ELSE 0 END AS team_attainment_pct
        FROM APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o
      `,
      reps: `
        SELECT r.FULL_NAME AS full_name,
               r.REGION AS region,
               SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) AS won,
               SUM(CASE WHEN o.IS_CLOSED='False' THEN o.AMOUNT ELSE 0 END) AS open_pipeline,
               MAX(r.QUOTA_AMOUNT) AS quota,
               CASE WHEN MAX(r.QUOTA_AMOUNT) > 0
                    THEN ROUND(SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END)
                               / MAX(r.QUOTA_AMOUNT) * 100, 1)
                    ELSE NULL END AS quota_pct,
               CASE WHEN MAX(r.QUOTA_AMOUNT) > 0
                    THEN ROUND(SUM(CASE WHEN o.IS_CLOSED='False' THEN o.AMOUNT ELSE 0 END)
                               / NULLIF(MAX(r.QUOTA_AMOUNT) - SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END), 0) * 100, 1)
                    ELSE NULL END AS coverage_pct
        FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP r
        JOIN APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
        GROUP BY r.FULL_NAME, r.REGION
        ORDER BY won DESC
      `,
      stage_breakdown: `
        SELECT r.FULL_NAME AS rep,
               o.STAGE_NAME AS stage,
               COUNT(*) AS deal_count,
               SUM(o.AMOUNT) AS stage_value
        FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP r
        JOIN APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
        WHERE o.IS_CLOSED = 'False'
        GROUP BY r.FULL_NAME, o.STAGE_NAME
        ORDER BY r.FULL_NAME, stage_value DESC
      `,
      activities: `
        SELECT a.OWNER_NAME AS rep,
               a.ACTIVITY_TYPE AS activity_type,
               COUNT(*) AS activity_count,
               SUM(a.DURATION_MINUTES) AS total_minutes
        FROM APP_DATA.CRM_OPPORTUNITY_ACTIVITY a
        WHERE a.IS_DELETED = 'False'
        GROUP BY a.OWNER_NAME, a.ACTIVITY_TYPE
        ORDER BY a.OWNER_NAME, activity_count DESC
      `,
      regions: `
        WITH rep_quota AS (
          SELECT REGION, SUM(QUOTA_AMOUNT) AS TOTAL_QUOTA
          FROM (SELECT FULL_NAME, REGION, MAX(QUOTA_AMOUNT) AS QUOTA_AMOUNT
                FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP GROUP BY FULL_NAME, REGION)
          GROUP BY REGION
        )
        SELECT r.REGION AS region,
               COUNT(DISTINCT r.FULL_NAME) AS rep_count,
               SUM(o.AMOUNT) AS pipeline,
               SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) AS won,
               rq.TOTAL_QUOTA AS quota,
               CASE WHEN rq.TOTAL_QUOTA > 0
                    THEN ROUND(SUM(CASE WHEN o.IS_WON='True' THEN o.AMOUNT ELSE 0 END) * 100.0 / rq.TOTAL_QUOTA, 1)
                    ELSE 0 END AS attainment_pct
        FROM APP_DATA.CRM_OPPORTUNITY_SALES_REP r
        JOIN APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY o ON r.REP_ID = o.OWNER_ID
        LEFT JOIN rep_quota rq ON r.REGION = rq.REGION
        GROUP BY r.REGION, rq.TOTAL_QUOTA
        ORDER BY won DESC
      `,
    };

    const data = await parallelQueries(queries);
    if (data.team_kpis && Array.isArray(data.team_kpis) && (data.team_kpis as unknown[]).length > 0) {
      data.team_kpis = (data.team_kpis as Record<string, unknown>[])[0];
    }
    res.json(data);
  } catch (err) {
    console.error("GET /api/leaderboard error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/forecast
// ---------------------------------------------------------------------------
router.get("/api/forecast", async (req: Request, res: Response) => {
  try {
    const version = (req.query.version as string) ?? "PLAN";

    const queries: Record<string, string> = {
      kpis: `
        SELECT SUM(FORECAST_AMOUNT) AS forecast_amount,
               SUM(ACTUAL_AMOUNT) AS actual_amount,
               SUM(VARIANCE_AMOUNT) AS variance_amount,
               AVG(ATTAINMENT_PCT) AS avg_attainment_pct,
               ROUND(SUM(CASE WHEN ATTAINMENT_PCT >= 100 THEN 1 ELSE 0 END) * 100.0
                     / NULLIF(COUNT(DISTINCT FORECAST_ID), 0), 1) AS above_plan_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL
        WHERE FORECAST_VERSION = '${version}'
      `,
      trend: `
        SELECT PERIOD_DATE AS month,
               SUM(FORECAST_AMOUNT) AS forecast,
               SUM(ACTUAL_AMOUNT) AS actual
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL
        WHERE FORECAST_VERSION = '${version}'
        GROUP BY PERIOD_DATE
        ORDER BY PERIOD_DATE
      `,
      by_org: `
        SELECT SALESORGANIZATION AS sales_org,
               SUM(FORECAST_AMOUNT) AS forecast,
               SUM(ACTUAL_AMOUNT) AS actual,
               AVG(ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL
        WHERE FORECAST_VERSION = '${version}'
        GROUP BY SALESORGANIZATION
        ORDER BY actual DESC
      `,
      version_compare: `
        SELECT FISCAL_YEAR AS fiscal_year,
               FORECAST_VERSION AS version,
               SUM(FORECAST_AMOUNT) AS forecast,
               SUM(ACTUAL_AMOUNT) AS actual,
               AVG(ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL
        GROUP BY FISCAL_YEAR, FORECAST_VERSION
        ORDER BY FISCAL_YEAR, FORECAST_VERSION
      `,
      top_customers: `
        SELECT c.CUSTOMERNAME AS customer,
               SUM(f.FORECAST_AMOUNT) AS forecast,
               SUM(f.ACTUAL_AMOUNT) AS actual,
               AVG(f.ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL f
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON f.SOLDTOPARTY = c.CUSTOMER
        WHERE f.FORECAST_VERSION = '${version}'
        GROUP BY c.CUSTOMERNAME
        HAVING SUM(f.FORECAST_AMOUNT) > 0
        ORDER BY attainment_pct DESC
        LIMIT 10
      `,
      bottom_customers: `
        SELECT c.CUSTOMERNAME AS customer,
               SUM(f.FORECAST_AMOUNT) AS forecast,
               SUM(f.ACTUAL_AMOUNT) AS actual,
               AVG(f.ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL f
        JOIN APP_DATA.CUSTOMER_CUSTOMER c ON f.SOLDTOPARTY = c.CUSTOMER
        WHERE f.FORECAST_VERSION = '${version}'
        GROUP BY c.CUSTOMERNAME
        HAVING SUM(f.FORECAST_AMOUNT) > 0
        ORDER BY attainment_pct ASC
        LIMIT 10
      `,
      territory_heatmap: `
        SELECT SALESORGANIZATION AS sales_org,
               PERIOD_DATE AS month,
               AVG(ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL
        WHERE FORECAST_VERSION = '${version}'
        GROUP BY SALESORGANIZATION, PERIOD_DATE
        ORDER BY SALESORGANIZATION, PERIOD_DATE
      `,
      product_heatmap: `
        SELECT gt.PRODUCTGROUPNAME AS product_group,
               f.FISCAL_YEAR AS fiscal_year,
               AVG(f.ATTAINMENT_PCT) AS attainment_pct
        FROM APP_DATA.SALES_FORECAST_VS_ACTUAL f
        LEFT JOIN APP_DATA.PRODUCT_PRODUCTGROUPTEXT gt
          ON f.PRODUCTGROUP = gt.PRODUCTGROUP AND gt.LANGUAGE = 'EN'
        WHERE f.FORECAST_VERSION = '${version}'
          AND f.PRODUCTGROUP != 'GENERAL'
        GROUP BY gt.PRODUCTGROUPNAME, f.FISCAL_YEAR
        HAVING SUM(f.FORECAST_AMOUNT) > 0
        ORDER BY gt.PRODUCTGROUPNAME, f.FISCAL_YEAR
      `,
      predictions: `
        SELECT MONTH AS month, FORECAST AS forecast, LOWER_BOUND AS lower, UPPER_BOUND AS upper
        FROM APP_DATA.ATTAINMENT_PREDICTIONS
        WHERE FORECAST_VERSION = '${version}'
        ORDER BY MONTH
      `,
    };

    const data = await parallelQueries(queries);
    if (data.kpis && Array.isArray(data.kpis) && (data.kpis as unknown[]).length > 0) {
      data.kpis = (data.kpis as Record<string, unknown>[])[0];
    }
    res.json(data);
  } catch (err) {
    console.error("GET /api/forecast error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/analyst
// ---------------------------------------------------------------------------
router.post("/api/analyst", async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const formatted: AnalystMessage[] = messages.map((m: any) => ({
      role: m.role === "assistant" ? "analyst" : m.role,
      content: Array.isArray(m.content)
        ? m.content
        : [{ type: "text", text: String(m.content) }],
    }));
    const result = await callCortexAnalyst(formatted);
    res.json(result);
  } catch (err) {
    console.error("POST /api/analyst error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/analyst/run-sql
// ---------------------------------------------------------------------------
router.post("/api/analyst/run-sql", async (req: Request, res: Response) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "sql string is required" });
    }
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      return res.status(400).json({ error: "Only SELECT/WITH queries are allowed" });
    }
    const rows = await runQuery(sql);
    res.json({ rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] });
  } catch (err) {
    console.error("POST /api/analyst/run-sql error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent — Cortex Agent SSE pass-through
// ---------------------------------------------------------------------------
router.post("/api/agent", async (req: Request, res: Response) => {
  try {
    // In the packaged Native App (SPCS) the account-level Cortex Agent object is
    // not available. Fail fast so the client falls back to /api/analyst, which
    // uses the bundled APP_DATA semantic view via the Cortex Analyst API.
    if (isSpcs()) {
      return res.status(501).json({ error: "Agent unavailable in packaged app; use /api/analyst." });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const account = process.env.SNOWFLAKE_ACCOUNT ?? "";
    const token = generateJwt();
    const url = `https://${account}.snowflakecomputing.com/api/v2/cortex/agent:run`;

    const systemPrompt =
      "You are a concise executive sales analyst. " +
      "Respond in short, scannable answers suitable for a VP of Sales: " +
      "lead with the key number or insight, use bullet points for lists, " +
      "and keep total text under 4 sentences unless the user asks for detail. " +
      "Always include a chart or table when data is available. " +
      "Do not repeat the question or add caveats.";

    const payload = {
      agent_name: "SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT",
      messages: [
        { role: "user", content: [{ type: "text", text: systemPrompt }] },
        { role: "assistant", content: [{ type: "text", text: "Understood." }] },
        ...messages,
      ],
      tools: [
        {
          tool_spec: {
            type: "cortex_analyst_text_to_sql",
            name: "query_sales_360",
          },
        },
      ],
      tool_resources: {
        query_sales_360: {
          semantic_view: "SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS",
          execution_environment: {
            type: "warehouse",
            warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "COMPUTE_WH",
          },
        },
      },
    };

    const upstreamRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT",
      },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return res.status(upstreamRes.status).json({ error: errText });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = upstreamRes.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    console.error("POST /api/agent error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    } else {
      res.end();
    }
  }
});

export default router;
