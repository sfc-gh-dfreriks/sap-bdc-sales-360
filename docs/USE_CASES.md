# Use Cases — SAP BDC Sales 360

> Joins SAP sales orders with Salesforce CRM pipeline and activity so revenue, pipeline and forecast live in one place.

- **App:** sales_360_react (React, server 3003 / client 5176); SAP_SALES_360_AGENT Streamlit (8501)
- **Semantic view:** `SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS`
- **Analytics tables:** SALESORDERS_SALESORDER / _SALESORDERITEM, CUSTOMER_CUSTOMER, PRODUCT_*, CRM_OPPORTUNITY_OPPORTUNITY / _SALES_REP / _ACTIVITY, SALES_FORECAST_VS_ACTUAL
- **Catalog audited:** 2026-09-28. Each use case maps to an existing app page and to fields in the semantic view or API.

| # | Use case | Persona | App page |
|---|---|---|---|
| 1 | Revenue dashboard | VP Sales / RevOps | Dashboard |
| 2 | Pipeline funnel | Sales manager | Funnel |
| 3 | Forecast vs. actual | CRO / finance partner | Forecast |
| 4 | Rep leaderboard and attainment | Sales manager | Leaderboard |
| 5 | Account health | Account executive / CSM | Health |
| 6 | Product mix | Product / category manager | Products |
| 7 | Sales copilot | Any seller | Chat (Cortex Agent) |

## 1. Revenue dashboard

- **Persona:** VP Sales / RevOps
- **Business question:** What have we booked, by region, customer and product?
- **Where in the app:** Dashboard
- **Data used:** NETAMOUNT, TOTALNETAMOUNT, CUSTOMERNAME, REGION, SALESORGANIZATION
- **Ask the agent:**
  - "What is total net order value by sales organization?"
- **Value:** One view of booked revenue from SAP, not a CRM estimate.

## 2. Pipeline funnel

- **Persona:** Sales manager
- **Business question:** How much pipeline is in each stage, and what is converting?
- **Where in the app:** Funnel
- **Data used:** STAGE_NAME, AMOUNT, PROBABILITY, IS_WON, IS_CLOSED, LEAD_SOURCE
- **Ask the agent:**
  - "What is open pipeline by stage?"
  - "What is our win rate by lead source?"
- **Value:** Finds stalled stages and weak lead sources.

## 3. Forecast vs. actual

- **Persona:** CRO / finance partner
- **Business question:** Are we tracking to forecast and quota?
- **Where in the app:** Forecast
- **Data used:** FORECAST_AMOUNT, ACTUAL_AMOUNT, VARIANCE_AMOUNT, QUOTA_AMOUNT, ATTAINMENT_PCT, FISCAL_QUARTER
- **Ask the agent:**
  - "What is forecast versus actual by fiscal quarter?"
- **Value:** Earlier, more credible forecast calls.

## 4. Rep leaderboard and attainment

- **Persona:** Sales manager
- **Business question:** Who is above or below quota?
- **Where in the app:** Leaderboard
- **Data used:** OWNER_NAME, MANAGER_NAME, TERRITORY, ATTAINMENT_PCT, QUOTA_AMOUNT
- **Ask the agent:**
  - "Which reps have the highest quota attainment?"
- **Value:** Targets coaching where it moves the number.

## 5. Account health

- **Persona:** Account executive / CSM
- **Business question:** Which customers are growing, shrinking or quiet?
- **Where in the app:** Health
- **Data used:** Orders by CUSTOMER over time, ACTIVITY_DATE, ACTIVITY_TYPE, OUTCOME
- **Ask the agent:**
  - "Which customers have had no activity in 90 days?"
- **Value:** Flags at-risk accounts before renewal.

## 6. Product mix

- **Persona:** Product / category manager
- **Business question:** Which products and product groups sell, and where?
- **Where in the app:** Products
- **Data used:** PRODUCT, PRODUCTGROUPNAME, ORDERQUANTITY, NETAMOUNT, PLANT
- **Ask the agent:**
  - "What are the top product groups by net order value?"
- **Value:** Guides assortment and promotion decisions.

## 7. Sales copilot

- **Persona:** Any seller
- **Business question:** Ask pipeline and order questions in plain English.
- **Where in the app:** Chat (Cortex Agent)
- **Data used:** Semantic view SAP_SALES_360_ANALYTICS
- **Ask the agent:**
  - "Which open opportunities over $100K close this quarter?"
- **Value:** Self-service answers without building reports.

---
Example agent questions are suggested prompts; validate answers in the app before customer demos.
