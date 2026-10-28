# 1. Concepts

What Sales 360 is, what the SAP Business Data Cloud share provides, and which
commercial questions this data can and cannot answer.

All figures in this handbook were verified against the live account on
**2026-09-21**. Account `MSB89522`, region `PUBLIC.AWS_US_WEST_2`.

---

## The problem this addresses

A revenue picture is assembled from systems that were never designed to be
joined. The opportunity lives in CRM. The order that the opportunity became
lives in SAP sales orders, at header and item grain. The product being sold is
described across nineteen separate SAP product objects — plant, valuation,
costing, storage, procurement, unit of measure — and the quota the rep is
measured against sits in a third place again.

Answering "which products did we win, at what margin, against whose quota" means
reconciling a CRM opportunity key with an SAP order key with an SAP material
number, across objects whose column names and grains are SAP's.

The usual answer is a nightly extract into a star schema. Sales 360 takes a
different route: **the SAP objects stay where SAP publishes them** and Snowflake
reads them through a share, with the joining and enrichment done in Snowflake
rather than in a pipeline.

---

## Zero-copy at the L0 boundary

The L0 sources are SAP BDC Standard Data Products, surfaced into the account as
shared databases. Nothing is copied at that boundary — a query against the share
is a query against the provider's storage.

Two consequences shape every layer above.

First, **you do not control the shape of L0**. Column names, grains, and the
absence of any object SAP does not publish are givens. The curation happens
downstream.

Second, and specific to this build: **the zero-copy property stops at L0**. The
L1 schema in this repository is not a passthrough layer. It is 31 materialised
tables holding 2,551,850 rows, of which 1,437,370 are then duplicated again into
L2. This is the largest single architectural difference between Sales 360 and its
sibling Finance 360, whose L1 is six views and adds no storage at all. It is
recorded as a finding with a severity in
[findings](05-findings.md#l1-is-not-zero-copy) and reflected in the object
inventory in [architecture](02-architecture.md#l1--31-materialised-tables).

---

## The layers

| Layer | Schema | What it is | Objects | Rows |
|---|---|---|---|---|
L0 | SAP BDC shared databases | SAP BDC Standard Data Products, read in place | shared | not copied |
L1 | `SAP_SALES_360.SAP_BDC_L1` | Materialised **tables**, one per SAP object | 31 | 2,551,850 |
L2 | `SAP_SALES_360.SALES_360_L2` | Dynamic tables plus three ML output tables | 14 | 1,478,495 |
Semantic | `SAP_SALES_360.SEMANTIC` | Semantic view, Analyst stage model, Cortex Agent | 3 artefacts | — |

The database carries **3 schemas**.

---

## What the data covers

| Object | Date column | From | To | Rows |
|---|---|---|---|---|
`CRM_OPPORTUNITY_OPPORTUNITY` | `CLOSE_DATE` | 2025-02-18 | 2026-08-16 | 3,774 |
`SALESORDERS_SALESORDER` | `SALESORDERDATE` | 2015-01-03 | 2025-12-31 | 558,011 |
`SALES_FORECAST_VS_ACTUAL` | `PERIOD_DATE` | 2023-01-01 | 2025-12-01 | 41,100 |

Three windows, three different spans, and none of them reaches the date this
handbook was verified. The sales order history is eleven years deep and stops at
the end of 2025. The forecast series stops a month earlier. The opportunity
window is the narrowest at eighteen months, and its **latest close date of
2026-08-16 is in the past** relative to 2026-09-21.

That last point is not a detail. It is why every one of the 3,201 open
opportunities is past due, and why the forecast page in the application
demonstrates a method rather than making a forward call. See
[findings](05-findings.md#the-open-pipeline-is-entirely-past-due).

---

## The commercial shape of the data

| Measure | Value |
|---|---|
Opportunities | 3,774 |
— open | 3,201 |
— closed won | 289 |
— closed lost | 284 |
Sales reps | 8 |
Total quota | $229,988,389 |
Open pipeline | $1,903,302,819 |
Won value | $203,263,038 |
Lost value | $260,553,599 |
Sales orders | 558,011 |
Sales order line items | 735,305 |
Customers | 3,189 |
Products | 16,337 |

Eight reps, 3,774 opportunities, and 558,011 orders. The order history and the
CRM data are on very different scales and cover different periods — they are not
two views of the same commercial activity, and a chart that puts them on one axis
is comparing an eleven-year order book against an eighteen-month CRM extract.

---

## The one number that matters most

Win rate depends on how you count it, and the two answers disagree by a wide
margin:

| Basis | Win rate |
|---|---|
By opportunity **count** | 50.4% |
By opportunity **value** | 43.8% |

The gap is not noise. The average won deal is $703,332; the average lost deal is
$917,442. **The larger the deal, the more likely it was lost.** This is the
single most actionable pattern in the dataset and it is developed in full in
[findings](05-findings.md#they-lose-the-larger-deals).

---

## What this is not

This is **transactional and CRM sales data**: opportunities, activities, orders,
order lines, product masters, quotas, forecast versus actual.

It is **not** a metadata or catalog model — there is no object describing which
SAP data products exist.

It is **not a system of record**. Nothing here posts, amends or closes an
opportunity. Every object is read-only downstream of SAP, and the application
does not write.

Questions this data cannot answer include anything requiring a currently open
pipeline with a future close date (there is none), anything requiring pricing
conditions or discount approval history, and anything requiring sales
organisation hierarchy above the eight-rep roster.

---

## Where the AI layer sits

Three artefacts in this system answer natural-language questions, and they are
not interchangeable.

- **A semantic view** — `SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS`, a
  governed Snowflake object with 64 logical tables, 369 dimensions, 69 facts,
  138 metrics and 44 relationships.
- **A Cortex Analyst stage model** — a YAML file at
  `@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml`, covering
  10 tables, 64 dimensions, 9 facts and **0 verified queries**.
- **A Cortex Agent** — `SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT`, with one
  tool, `cortex_analyst_text_to_sql`, and `auto` orchestration.

The agent's single tool routes to the Analyst model, not to the semantic view.
A 64-table semantic view sitting beside a 10-table stage model is a coverage
asymmetry that determines which file you edit when an answer is wrong; it is set
out in [the semantic layer](08-semantic-layer.md).
