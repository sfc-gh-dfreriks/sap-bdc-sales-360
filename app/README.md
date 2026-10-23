# SAP Sales 360

A self-contained Snowflake Native App that runs the **SAP BDC Sales 360**
dashboard (React + Express) on Snowpark Container Services.

## What's inside

- **Interactive dashboard** — Ask Cortex, Dashboard, Funnel, Customer Health, Products,
  Leaderboard, Forecast, and a natural-language Chat page.
- **Bundled data** — All sales, CRM opportunity, product, and forecast data is
  packaged with the app (no external references or shares). It runs immediately
  after install.
- **Ask the Agent** — The Chat page uses Cortex Analyst over the bundled
  **`SAP_SALES_360_ANALYTICS`** semantic view — the same model behind the
  account-level **`SAP_SALES_360_AGENT`** Cortex Agent.

- **Ask Cortex** — An Ask Cortex page plus an "Ask Cortex about <page>" button on each
  data page. The app gathers live facts from its bundled tables and asks Snowflake Cortex
  (`claude-sonnet-4-5`) for a plain-language analysis with recommended actions.

## Data model

SAP sales orders + line items, CRM opportunities/activities/reps, customer and
product master, and revenue forecast/prediction tables.

## Install

1. Grant the requested account privileges (CREATE COMPUTE POOL, BIND SERVICE
   ENDPOINT, CREATE WAREHOUSE).
2. Activate the app — the version initializer creates the compute pool,
   warehouse, and the `SALES_360_SERVICE` container service.
3. Launch the app from the default web endpoint.

## Cortex access

Grant the app the `SNOWFLAKE.CORTEX_USER` database role so the Chat page can
call Cortex Analyst and Ask Cortex can call `SNOWFLAKE.CORTEX.COMPLETE`:

```sql
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO APPLICATION <app name>;
```

Without it, Ask Cortex shows a "not available in this installation" message.
