# SAP Sales 360

A self-contained Snowflake Native App that runs the **SAP BDC Sales 360**
dashboard (React + Express) on Snowpark Container Services.

## What's inside

- **Interactive dashboard** — Dashboard, Funnel, Customer Health, Products,
  Leaderboard, Forecast, and a natural-language Chat page.
- **Bundled data** — All sales, CRM opportunity, product, and forecast data is
  packaged with the app (no external references or shares). It runs immediately
  after install.
- **Ask the Agent** — The Chat page uses Cortex Analyst over the bundled
  **`SAP_SALES_360_ANALYTICS`** semantic view — the same model behind the
  account-level **`SAP_SALES_360_AGENT`** Cortex Agent.

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
call Cortex Analyst.
