# Demo Guide — SAP BDC Sales 360

A ~10-minute flow showing how Snowflake × SAP Business Data Cloud turns SAP Sales
and CRM data into a live, AI-powered app. Full deck (with presenter notes):
[`SAP_Sales_360_Demo_Guide.pptx`](SAP_Sales_360_Demo_Guide.pptx).

## The story in one line
Two platforms, one governed data foundation: SAP BDC shares governed sales & CRM
data into Snowflake with **zero copy**; Snowflake adds AI, apps and global reach —
no pipelines, full SAP context preserved.

## 10-minute flow
1. **Open the app** — no setup; data is already inside (bundled Native App).
2. **Dashboard** — revenue KPIs, top customers, pipeline, sales by country, top reps.
3. **Funnel** — deal stages, sankey, aging and stale deals.
4. **Customer Health** — contract value, revenue, opportunity count, health status.
5. **Products & Leaderboard** — top products/groups; rep quota attainment & win %.
6. **Forecast** — revenue predictions and forecast-vs-actual attainment.
7. **Chat (Ask the Agent)** — live questions to `SAP_SALES_360_AGENT`:
   - "What is total revenue by customer country?"
   - "Show the open pipeline by stage."
   - "Which reps are above quota?"
8. **Recap** — zero-ETL, governed, AI-ready, one-click distribution.

## Key points to land
- Data is **already inside Snowflake** — no ETL, no waiting.
- SAP **business context preserved** (orders, opportunities, quota, forecast).
- The agent answers live, in plain English, with governed SQL.
- One definition → **three regions** (US, EMEA, APAC), each its own governed install.

## Do / Don't
- **Do** ask the agent a real question live; lead with sales outcomes.
- **Don't** pre-load canned answers or dwell on architecture/SQL.
- **Don't** promise cross-region magic — each region is its own governed install.
