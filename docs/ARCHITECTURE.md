# Architecture — SAP BDC Sales 360

Sales 360 is built on a **medallion architecture** inside Snowflake, reading SAP
Sales, CRM and Product data via **SAP Business Data Cloud (BDC) zero-copy
shares**. No ETL, no copy, full SAP business context preserved.

```
 SAP S/4HANA + SAP CRM            SAP Business Data Cloud
 (source of record)   ─────  Sales / CRM / Product Products  ─────►  Snowflake
                                     (governed, zero-copy)
                                                                │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L0  BRONZE  — SAP BDC Standard Data Products                              │
 │      Sales Orders · CRM Opportunities/Activities/Reps · Customer · Product │
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │  (curated / loaded)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L1  SILVER  — SAP_SALES_360.SAP_BDC_L1 (31 curated tables)               │
 │      SALESORDERS_* · CRM_OPPORTUNITY_* · CUSTOMER_* · PRODUCT_* (+ plant / │
 │      valuation / costing extensions)                                       │
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │  (dynamic tables + ML)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L2  GOLD  — SAP_SALES_360.SALES_360_L2                                    │
 │      SALESORDERS_SALESORDER / SALESORDERITEM · CRM_OPPORTUNITY_* ·         │
 │      CUSTOMER_CUSTOMER · PRODUCT_* · SALES_FORECAST_VS_ACTUAL ·            │
 │      SALES_REVENUE_PREDICTIONS · ATTAINMENT_PREDICTIONS (ML outputs)       │
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  SEMANTIC — SAP_SALES_360_ANALYTICS semantic view (+ verified queries)    │
 └──────────────────────────────────────────────────────────────────────────┘
              │                                        │
              ▼                                        ▼
   SAP_SALES_360_AGENT                      Native App Chat page
   (Snowflake Intelligence, SSE)            (Cortex Analyst in-app)
                                                        │
                                            React + Express on SPCS
```

## Layer detail

- **L0 (bronze)** — SAP BDC Sales/CRM/Product standard data products, zero-copy
  shared. See [`sql/01_l0_sources.md`](../sql/01_l0_sources.md).
- **L1 (silver)** — `SAP_BDC_L1`: 31 curated tables (sales orders + items, CRM
  opportunities/activities/reps, customer + product master with plant/valuation
  extensions). DDL: [`sql/02_l1_curated_tables.sql`](../sql/02_l1_curated_tables.sql).
- **L2 (gold)** — `SALES_360_L2`: analytics dynamic tables plus ML output tables
  (revenue predictions, attainment predictions, forecast-vs-actual).
  DDL: [`sql/03_l2_analytics_dynamic_tables.sql`](../sql/03_l2_analytics_dynamic_tables.sql).
- **Semantic** — `SAP_SALES_360_ANALYTICS` semantic view over L2, with a
  verified-query extension. DDL: [`sql/04_semantic_view.sql`](../sql/04_semantic_view.sql).
- **Agent** — `SAP_SALES_360_AGENT` Cortex Agent.
  DDL: [`sql/05_cortex_agent.sql`](../sql/05_cortex_agent.sql).

## Native App packaging & the Chat page

For distribution the app is packaged as a **self-contained Native App**: the 14
`SALES_360_L2` tables the UI needs (~1.4M rows) are **bundled** into the
package's `SHARED_DATA` schema, and an in-app copy of the
`SAP_SALES_360_ANALYTICS` semantic view powers the Chat page.

> The standalone app's Chat uses the account-level `SAP_SALES_360_AGENT` via
> Cortex Agent SSE, with an Analyst fallback. Inside the **packaged Native App**
> the account agent isn't available, so the container's `/api/agent` returns 501
> and the client falls back to **`/api/analyst`** over the bundled semantic view
> — same governed answers, fully self-contained. See
> [`service/app/server/src/routes/api.ts`](../service/app/server/src/routes/api.ts).
