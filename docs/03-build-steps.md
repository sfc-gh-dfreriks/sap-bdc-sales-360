# 3. Build steps

The order in which the stack was built, what each step produces, and the check
that tells you the step worked.

Figures verified 2026-09-21 against account `MSB89522`.

---

## Step 0 — Confirm the L0 shares are readable

Before anything is built, establish that the SAP BDC Standard Data Products are
mounted and that the role in use can read them. A share that is present but
ungranted fails at the first `SELECT`, not at mount time.

The check is a row count against one share object. If it returns, the grant chain
reaches the provider's storage and the rest of the build is Snowflake-local work.

Failure here is a provider-side or grant problem, not a modelling problem. Do not
proceed to L1 until a count succeeds.

---

## Step 1 — L1 objects

L1 in this repository is **31 base tables** in `SAP_SALES_360.SAP_BDC_L1`, one per
SAP object, holding 2,551,850 rows.

| Family | Objects |
|---|---|
Product master and classification | 24 |
Sales orders | 2 |
CRM (opportunity, activity, sales rep) | 3 |
Customer | 1 |
Forecast | 1 |

The build creates each table and loads it from its L0 counterpart.

**Check:** `SELECT COUNT(*)` per table, summed, equals 2,551,850; and
`SHOW DYNAMIC TABLES IN SAP_BDC_L1` returns zero rows, confirming every object is
a plain table.

That second check passing is also the finding. A passthrough L1 would return zero
dynamic tables *and* zero base tables, because it would be views. This one returns
31 base tables, which is why
[findings](05-findings.md#l1-is-not-zero-copy) recommends converting the layer.

If you are rebuilding this stack rather than reproducing it, build L1 as views
here instead. The downstream steps do not change: a dynamic table can select from
a view exactly as it selects from a table.

---

## Step 2 — L2 dynamic tables

Eleven dynamic tables in `SAP_SALES_360.SALES_360_L2`, selecting from L1.

| Dynamic table | Rows | Source grain |
|---|---|---|
`SALESORDERS_SALESORDERITEM` | 735,305 | order line |
`SALESORDERS_SALESORDER` | 558,011 | order header |
`PRODUCT_PRODUCTDESCRIPTION` | 73,242 | product × language |
`SALES_FORECAST_VS_ACTUAL` | 41,100 | period × forecast unit |
`CRM_OPPORTUNITY_ACTIVITY` | 35,313 | activity |
`PRODUCT_PRODUCT` | 16,337 | product |
`PRODUCT_PRODUCTGROUPTEXT` | 11,168 | product group × language |
`CRM_OPPORTUNITY_OPPORTUNITY` | 3,774 | opportunity |
`CUSTOMER_CUSTOMER` | 3,189 | customer |
`PRODUCT_PRODUCTGROUP` | 1,023 | product group |
`CRM_OPPORTUNITY_SALES_REP` | 8 | rep |

Ten of the eleven land on the same row count as their L1 source. Only
`SALES_FORECAST_VS_ACTUAL` is a genuine transform — it derives from L1's
`SALES_FORECAST`, also 41,100 rows, by joining actuals onto the forecast series.

**Check:** `SHOW DYNAMIC TABLES IN SALES_360_L2` returns 11 names, and the summed
row count across all 14 L2 objects equals 1,478,495.

**Second check, and the one worth writing down:** compare row counts between L1
and L2 for the ten shared names. All ten match, totalling 1,437,370 rows. That
equality is the duplication finding — the check that confirms the build is also
the check that exposes the storage cost.

---

## Step 3 — The three ML output tables

| Table | Rows | What it holds |
|---|---|---|
`ATTAINMENT_PREDICTIONS` | 12 | predicted attainment by period |
`SALES_REVENUE_PREDICTIONS` | 6 | predicted revenue by period |
`SALES_REVENUE_FORECAST_METRICS` | 7 | model quality metrics |

These are plain tables, written by a training and inference run rather than
refreshed by SQL. That is the correct object type: a dynamic table would recompute
a projection, not retrain a model.

**Check:** the three tables exist, are not returned by
`SHOW DYNAMIC TABLES`, and hold 12, 6 and 7 rows respectively.

**Caveat to record at this step, not later:** the prediction horizon is bounded by
the input series, which ends 2025-12-01. Predictions produced from it do not reach
2026-09-21. Note it in the demo script rather than discovering it on a call.

---

## Step 4 — The semantic view

`SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS`.

| Property | Value |
|---|---|
Logical tables | 64 |
Dimensions | 369 |
Facts | 69 |
Metrics | 138 |
Relationships | 44 |

**Check:** `DESCRIBE SEMANTIC VIEW` returns those five tallies.

Read the tallies for what they are. 64 logical tables against a 14-object L2 means
the view reaches beyond L2, and 369 dimensions is a consequence of SAP objects
being wide — every retained column becomes a dimension. It is a count of rows
returned by `DESCRIBE`, not a count of curated, documented dimensions. The 138
metrics are the part that carries real modelling effort.

---

## Step 5 — The Cortex Analyst stage model

```
@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml
```

| Property | Value |
|---|---|
Model name | `SAP_SALES_360_ANALYTICS` |
Base tables | 10 |
Dimensions | 64 |
Facts | 9 |
Measures | 0 |
Verified queries | **0** |

Base tables: `SALESORDER`, `SALESORDERITEM`, `CUSTOMER`, `PRODUCT`,
`PRODUCT_DESCRIPTION`, `PRODUCT_GROUP`, `PRODUCT_GROUP_TEXT`, `SFDC_OPPORTUNITY`,
`ACTIVITY`, `SALES_REP`.

**Check:** `GET` the file from the stage and parse it. Confirm 10 tables and 64
dimensions.

**The step is not finished.** Zero verified queries means nothing in the model
pins a correct answer to a known question, and zero measures means the model
offers no aggregations of its own. Both are recorded as gaps in
[findings](05-findings.md#zero-verified-queries-on-the-stage-model), with the
queries to add first listed in
[the analyst and agent layer](07-analyst-and-agent.md#the-queries-to-add-first).

---

## Step 6 — The Cortex Agent

`SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT`.

| Property | Value |
|---|---|
Comment | Sales Analytics Agent for SAP Sales 360 Dynamic Tables |
Versions | `VERSION$1` |
Default version | `LAST` |
Orchestration | `auto` |
Tools | 1 — `cortex_analyst_text_to_sql` |

**Check:** `DESCRIBE AGENT` returns one tool and `auto` orchestration.

One tool means one routing decision, which is the simplest possible agent and the
easiest to reason about: every question becomes text-to-SQL against the stage
model. There is no search tool, so the agent cannot answer from documentation, and
no custom tool, so it cannot call out.

It also means the agent inherits every limitation of the stage model, including
the zero verified queries from step 5.

---

## Step 7 — The application

A React client and an Express server, packaged as a Native App on Snowpark
Container Services, seven pages.

**Check:** `CALL SALES_360_APP.CORE.APP_URL()` returns the endpoint, and the
`FROM`-clause census over `api.ts` shows 53 reads, all on `SALES_360_L2`.

That census is the architectural check, not a code-style check. 53 on L2, 0 on L1,
0 on the shares means the app has exactly one data contract. Keep it that way: a
single read against L1 or a share would double the surface that a schema change
can break.

---

## Step 8 — Extract the facts

Every figure in this handbook comes from one extraction run against the live
account, written to a JSON file with a provenance entry per fact.

The pattern matters more than the file. Each fact records the query or the parse
that produced it — `INFORMATION_SCHEMA.TABLES` for object inventories,
`SHOW DYNAMIC TABLES` for object types, `DESCRIBE SEMANTIC VIEW` and
`DESCRIBE AGENT` for the AI layer, `api.ts` `FROM` clauses for the app, and
aggregate SQL for the commercial figures.

**Check:** the derived figures reconcile against the extracted ones without
adjustment.

| Derivation | Result |
|---|---|
289 won + 284 lost | 573 closed |
3,774 − 573 | 3,201 open, equal to the past-due count |
Sum of the 8 pipeline stages | 3,201 opportunities, $1,903,302,819 |
289 ÷ 573 | 50.4% |
$203,263,038 ÷ $463,816,637 | 43.8% |

Five independent paths, no residuals. If a rebuild breaks any one of them, the
extraction is wrong before the documentation is.

---

## Step 9 — Documentation and Word deliverables

The eight markdown documents in `docs/` are the source of record. `tools/build_docs_docx.py`
renders them into `docs/docx/` as eight part documents plus a combined handbook.

**Check:** nine `.docx` files, and the table-row count the renderer reports
matches the count of GFM table rows in the sources.

That second check exists because of a specific failure mode. GFM does not require
leading and trailing pipes on table rows, and this doc set omits them on most
rows. A parser that requires them drops those rows **silently** — no error, just a
shorter table in a document nobody diffs cell by cell. The renderer's `split_row`
tolerates missing pipes deliberately, and the row-count assertion is what proves
it still does.
