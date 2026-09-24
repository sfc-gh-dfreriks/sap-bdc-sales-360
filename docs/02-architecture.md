# 2. Architecture

Every object in the stack, what reads what, and the three places where the wiring
is not what the layer diagram would suggest.

---

## Data flow

```
SAP BDC Standard Data Products                  (L0, shared databases, not copied)
        |
        v
SAP_SALES_360.SAP_BDC_L1                        (L1, 31 materialised TABLES,
  CRM_OPPORTUNITY_OPPORTUNITY  ...                    2,551,850 rows,
  SALESORDERS_SALESORDER / SALESORDERITEM              0 dynamic tables)
  19 PRODUCT_* objects  CUSTOMER_CUSTOMER
  CRM_OPPORTUNITY_SALES_REP / ACTIVITY  SALES_FORECAST
        |
        |   10 of the 31 names reappear below with identical row counts
        |   -> 1,437,370 rows materialised twice
        v
SAP_SALES_360.SALES_360_L2                      (L2, 14 tables, 1,478,495 rows,
  11 dynamic tables                                   11 dynamic + 3 plain)
  ATTAINMENT_PREDICTIONS                              plain, ML output
  SALES_REVENUE_FORECAST_METRICS                      plain, ML output
  SALES_REVENUE_PREDICTIONS                           plain, ML output
        |
        +--> SEMANTIC.SAP_SALES_360_ANALYTICS              (semantic view, 64 tables)
        +--> @SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml  (Analyst model, 10 tables)
        +--> SEMANTIC.SAP_SALES_360_AGENT                  (Cortex Agent, 1 tool)
        |
        v
React + Express app, 7 pages, 53 reads — all against L2
```

Three things in that diagram are worth stating plainly before the detail.

1. **L1 is not a passthrough layer.** It holds storage, and more than half of
   what it holds is duplicated downstream.
2. **The app reads exactly one layer.** 53 `FROM` clauses, all on L2, none on L1,
   none on the shares.
3. **The agent does not read the semantic view.** Its one tool is
   `cortex_analyst_text_to_sql`, which binds to the stage model.

---

## L1 — 31 materialised tables

| Property | Value |
|---|---|
Objects | 31 |
Object type | `BASE TABLE` |
Dynamic tables | 0 |
Views | 0 |
Rows | 2,551,850 |
Rows also present in L2 with identical counts | 1,437,370 |
Share of L1 rows duplicated into L2 | 56.3% |
Storage added | all 2,551,850 rows |

`SHOW DYNAMIC TABLES IN SAP_BDC_L1` returns nothing. Every L1 object is a plain
table, which means L1 has a load step, a freshness question and a storage cost —
none of which a view layer would have.

This is a deliberate contrast with Finance 360, where L1 is six views, adds no
storage, and has no refresh lag because a view cannot have one. The Sales 360 L1
is five times the object count and carries the full row volume. The consequence
and the recommendation are in
[findings](05-findings.md#l1-is-not-zero-copy).

### The 31 objects by family

| Family | Objects | Largest object | Rows in largest |
|---|---|---|---|
Sales orders | 2 | `SALESORDERS_SALESORDERITEM` | 735,305 |
Product master | 19 | `PRODUCT_PRODUCTPLANTCOSTING` | 92,243 |
CRM | 3 | `CRM_OPPORTUNITY_ACTIVITY` | 35,313 |
Customer | 1 | `CUSTOMER_CUSTOMER` | 3,189 |
Forecast | 1 | `SALES_FORECAST` | 41,100 |
Product classification | 5 | `PRODUCT_PRODUCTDESCRIPTION` | 73,242 |

Nineteen of the 31 objects are product master facets. Six of them carry exactly
92,243 rows — `PRODUCT_PRODUCTPLANT` and its costing, international trade,
procurement, forecast and storage siblings — which is the plant-level grain
repeated across facets. Another three carry 83,501, the valuation grain. That
repetition is SAP's data model, faithfully reproduced.

The two objects that carry the transactional volume are
`SALESORDERS_SALESORDERITEM` at 735,305 rows and `SALESORDERS_SALESORDER` at
558,011 — together 1,293,316 rows, just over half of L1.

---

## L2 — 14 tables, 11 of them dynamic

| Object | Rows | Type |
|---|---|---|
`SALESORDERS_SALESORDERITEM` | 735,305 | dynamic table |
`SALESORDERS_SALESORDER` | 558,011 | dynamic table |
`PRODUCT_PRODUCTDESCRIPTION` | 73,242 | dynamic table |
`SALES_FORECAST_VS_ACTUAL` | 41,100 | dynamic table |
`CRM_OPPORTUNITY_ACTIVITY` | 35,313 | dynamic table |
`PRODUCT_PRODUCT` | 16,337 | dynamic table |
`PRODUCT_PRODUCTGROUPTEXT` | 11,168 | dynamic table |
`CRM_OPPORTUNITY_OPPORTUNITY` | 3,774 | dynamic table |
`CUSTOMER_CUSTOMER` | 3,189 | dynamic table |
`PRODUCT_PRODUCTGROUP` | 1,023 | dynamic table |
`ATTAINMENT_PREDICTIONS` | 12 | **plain table** |
`CRM_OPPORTUNITY_SALES_REP` | 8 | dynamic table |
`SALES_REVENUE_FORECAST_METRICS` | 7 | **plain table** |
`SALES_REVENUE_PREDICTIONS` | 6 | **plain table** |
**Total** | **1,478,495** | 14 objects, 11 dynamic |

The three plain tables are ML outputs, and their being plain is correct: a
prediction is the result of a training run, not of a SQL refresh, so a dynamic
table would be the wrong object. They are also tiny — 25 rows between them — and
account for 0.002% of L2.

### Ten names appear in both L1 and L2 with identical row counts

| Object | Rows (both layers) |
|---|---|
`SALESORDERS_SALESORDERITEM` | 735,305 |
`SALESORDERS_SALESORDER` | 558,011 |
`PRODUCT_PRODUCTDESCRIPTION` | 73,242 |
`CRM_OPPORTUNITY_ACTIVITY` | 35,313 |
`PRODUCT_PRODUCT` | 16,337 |
`PRODUCT_PRODUCTGROUPTEXT` | 11,168 |
`CRM_OPPORTUNITY_OPPORTUNITY` | 3,774 |
`CUSTOMER_CUSTOMER` | 3,189 |
`PRODUCT_PRODUCTGROUP` | 1,023 |
`CRM_OPPORTUNITY_SALES_REP` | 8 |
**Total** | **1,437,370** |

That is 97.2% of all L2 rows and 56.3% of all L1 rows, stored twice. Identical
counts do not by themselves prove identical content — the L2 dynamic table may
rename or recast columns — but they do establish that L2 is not filtering or
aggregating these ten. The transform is projection, and a projection over a
materialised table costs storage that a projection over a view would not.

Only four L2 objects have no L1 counterpart: `SALES_FORECAST_VS_ACTUAL`, which
derives from L1's `SALES_FORECAST`, and the three ML tables. Together they are
41,125 rows — everything in L2 that is genuinely new.

---

## The app reads one layer

The Express server's `api.ts` holds all SQL. Its `FROM`-clause census:

| Source | `FROM` clauses |
|---|---|
`SALES_360_L2.CRM_OPPORTUNITY_OPPORTUNITY` | 16 |
`SALES_360_L2.SALESORDERS_SALESORDER` | 10 |
`SALES_360_L2.CRM_OPPORTUNITY_SALES_REP` | 8 |
`SALES_360_L2.SALES_FORECAST_VS_ACTUAL` | 8 |
`SALES_360_L2.SALESORDERS_SALESORDERITEM` | 6 |
`SALES_360_L2.CUSTOMER_CUSTOMER` | 1 |
`SALES_360_L2.CRM_OPPORTUNITY_ACTIVITY` | 1 |
`SALES_360_L2.SALES_REVENUE_PREDICTIONS` | 1 |
`SALES_360_L2.SALES_REVENUE_FORECAST_METRICS` | 1 |
`SALES_360_L2.ATTAINMENT_PREDICTIONS` | 1 |
**Total** | **53** |

| Layer | Reads |
|---|---|
L2 | 53 |
L1 | 0 |
L0 shares, directly | 0 |

This is a cleaner dependency graph than Finance 360, whose app splits its reads
roughly evenly between L2 and the L0 shares. Here there is exactly one contract:
the app depends on L2 and on nothing else, so an L1 or L0 change can only reach
the app through a dynamic table.

It also means the app cannot demonstrate zero-copy directly — no page queries a
share — and that the 31 L1 tables exist to feed 11 dynamic tables and nothing
else. Ten L2 objects carry the 53 reads; four of the 14 are unread by the app.

`CRM_OPPORTUNITY_OPPORTUNITY` at 16 clauses is the most-read object in the
system, which is consistent with an application whose centre of gravity is the
pipeline rather than the order book.

---

## Semantic objects

| Artefact | Type | Scale |
|---|---|---|
`SEMANTIC.SAP_SALES_360_ANALYTICS` | semantic view | 64 tables, 369 dimensions, 69 facts, 138 metrics, 44 relationships |
`@SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml` | Analyst stage model | 10 tables, 64 dimensions, 9 facts, 0 measures, 0 verified queries |
`SEMANTIC.SAP_SALES_360_AGENT` | Cortex Agent | 1 tool, `auto` orchestration, `VERSION$1` |

The asymmetry is the point. The semantic view declares 64 logical tables against
a 14-table L2 — it is reaching across L1 and the product master facets. The stage
model declares 10, and those ten are the commercially meaningful core:
`SALESORDER`, `SALESORDERITEM`, `CUSTOMER`, `PRODUCT`, `PRODUCT_DESCRIPTION`,
`PRODUCT_GROUP`, `PRODUCT_GROUP_TEXT`, `SFDC_OPPORTUNITY`, `ACTIVITY`,
`SALES_REP`.

**The agent's one tool is `cortex_analyst_text_to_sql`, so the agent reads the
stage model.** The 369-dimension semantic view is not what answers a question
asked through the agent. Editing it to fix a bad agent answer will have no
effect. This is the highest-value operational fact in the stack and it is
developed in [the semantic layer](08-semantic-layer.md#which-artefact-to-edit).

Note also that the stage model declares 9 facts and **0 measures**. An Analyst
model with no measures has no aggregations of its own to offer, so every
aggregate in an answer is one the generated SQL invents.

---

## The forecast page has no future to forecast

The application's Sales Forecast page reads `SALES_FORECAST_VS_ACTUAL`,
`SALES_REVENUE_PREDICTIONS`, `SALES_REVENUE_FORECAST_METRICS` and
`ATTAINMENT_PREDICTIONS` — the ML outputs plus the historical series.

Its inputs stop before the present. `SALES_FORECAST_VS_ACTUAL` ends 2025-12-01.
The opportunity close dates end 2026-08-16. Verified on 2026-09-21, **zero of the
3,201 open opportunities have a future close date** and all $1,903,302,819 of
open pipeline is past due.

The page therefore demonstrates the mechanism — a prediction table, an attainment
series, a metrics table — against a horizon that has already elapsed. It is a
method demonstration, not a forward call, and it should be presented as one. The
finding is recorded with a severity in
[findings](05-findings.md#the-open-pipeline-is-entirely-past-due).

---

## Application

| Component | Detail |
|---|---|
Client | React |
Server | Express + TypeScript, `api.ts` holding all SQL |
Packaging | Snowflake Native App on Snowpark Container Services |
Pages | 7 |
Data layer read | `SALES_360_L2` only |
Deployed URL | `mrzht4-sfsenorthamerica-dfreriks-aws1-w2.snowflakecomputing.app` |

| # | Page | Principal L2 objects |
|---|---|---|
1 | Dashboard | opportunity, sales order, sales rep |
2 | Sales Funnel | opportunity |
3 | Customer Health | customer, sales order |
4 | Products | product, order item |
5 | Rep Leaderboard | sales rep, opportunity |
6 | Sales Forecast | forecast vs actual, three ML tables |
7 | Ask the Agent | Cortex Agent / Analyst stage model |

Pages 1–5 are conventional dashboards over L2. Page 6 is the forecast surface
whose horizon caveat is above. Page 7 is the natural-language surface, and it is
bound to the stage model rather than to the semantic view.

All SQL lives in the server, so the `FROM`-clause census above is a complete
inventory of what the application reads.
