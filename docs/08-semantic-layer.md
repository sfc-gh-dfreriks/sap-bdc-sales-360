# 8. The semantic layer

Two artefacts describe the same data at very different resolutions. Which one you
edit determines whether your change has any effect.

---

## Two artefacts, one data layer

| | Semantic view | Analyst stage model |
|---|---|---|
Identifier | `SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS` | `@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml` |
Model name | `SAP_SALES_360_ANALYTICS` | `SAP_SALES_360_ANALYTICS` |
Form | first-class Snowflake object | YAML file on a stage |
Logical tables | 64 | 10 |
Dimensions | 369 | 64 |
Facts | 69 | 9 |
Metrics / measures | 138 metrics | 0 measures |
Relationships | 44 | — |
Verified queries | n/a | 0 |
Read by | direct `SEMANTIC_VIEW(...)` SQL | the Cortex Agent, and the app's Ask the Agent page |

**They carry the same model name.** That is the first thing to internalise, because
it is why the confusion described below is so easy to fall into.

---

## The coverage asymmetry

6.4× the tables, 5.8× the dimensions, and all 138 metrics on the side the agent
does not read.

| Ratio | Semantic view : stage model |
|---|---|
Logical tables | 64 : 10 |
Dimensions | 369 : 64 |
Facts | 69 : 9 |
Metrics / measures | 138 : 0 |

### Why the semantic view is so large

64 logical tables exceeds the 14 objects in `SALES_360_L2`, so the view is reaching
past L2 into L1 and the product master. That is where 369 dimensions comes from: 19
product master facets, each a wide SAP object, each retained column becoming a
dimension.

Read 369 as what it is — a count of rows returned by `DESCRIBE SEMANTIC VIEW`, not
a count of curated, documented, business-named dimensions. A wide SAP table
contributes dozens of dimensions for the cost of being included. The 138 metrics
are the part that represents deliberate modelling, and 44 declared relationships is
a substantive join graph.

### Why the stage model is small, and right to be

Its 10 tables are the commercial core: `SALESORDER`, `SALESORDERITEM`, `CUSTOMER`,
`PRODUCT`, `PRODUCT_DESCRIPTION`, `PRODUCT_GROUP`, `PRODUCT_GROUP_TEXT`,
`SFDC_OPPORTUNITY`, `ACTIVITY`, `SALES_REP`.

A Cortex Analyst model gets *worse* as it gets wider. Every extra table is another
candidate for the model to land a question on wrongly, and 369 dimensions of SAP
plant-costing attributes would degrade every answer about pipeline. Ten focused
tables is the better engineering decision, and the asymmetry is not a defect in the
stage model — it is a defect in the *relationship* between the two artefacts, which
nothing documents.

The one omission that does hurt is domain coverage, not breadth:
`SALES_FORECAST_VS_ACTUAL`, `ATTAINMENT_PREDICTIONS`, `SALES_REVENUE_PREDICTIONS`
and `SALES_REVENUE_FORECAST_METRICS` are all absent, so the entire forecast domain
is unreachable from natural language while the app devotes a page to it.

---

## Which artefact to edit

**The agent's single tool is `cortex_analyst_text_to_sql`. That binds to the stage
model.** Every natural-language question in this system is answered from the
10-table YAML. The 64-table semantic view answers nothing the agent is asked.

| Symptom | Artefact to edit | Effect of editing the other one |
|---|---|---|
Agent answer wrong | **stage YAML** | none |
Ask the Agent page wrong | **stage YAML** | none |
Agent cannot find a table | **stage YAML** — add it | none |
A metric definition is wrong in `SEMANTIC_VIEW(...)` output | **semantic view** | none on the SQL path |
A join is wrong in `SEMANTIC_VIEW(...)` output | **semantic view** — 44 relationships live there | none |

### The failure mode, concretely

An agent answer is wrong. Someone goes looking for the semantic model. What they
find is the semantic view: a first-class database object, discoverable through
`SHOW SEMANTIC VIEWS`, carrying 138 metrics and 44 relationships, **and bearing the
same model name as the stage file**. Every signal says this is the model.

They add the missing metric, redeploy, re-ask the question. Nothing changes. The
answer is still wrong. The edit was correct and irrelevant, because the agent never
read that object.

The reverse drift is quieter and worse. A definition fixed only in the stage YAML
is invisible to anyone querying the semantic view, so the two descriptions of the
same data diverge with nothing to reconcile them. With 138 metrics on one side and
0 measures on the other, they have already diverged as far as they can: there is
not one metric definition shared between them.

### What to do about it

| Action | Effort | Value |
|---|---|---|
Add `SALES_FORECAST_VS_ACTUAL` to the stage model | one table | unlocks the forecast domain for the agent |
Declare measures in the stage model for won value, lost value, win rate by both bases, attainment, average deal size | hours | stops the generated SQL inventing aggregations |
Add the verified queries listed in [part 7](07-analyst-and-agent.md#the-queries-to-add-first) | hours | pins correct answers to known questions |
Write a header comment in both artefacts naming the other and stating which the agent reads | minutes | prevents the wasted-edit cycle entirely |

The last one costs the least and prevents the most. Two comments.

---

## What the semantic layer must encode

Three properties of this data are invisible in the schema, and each produces a
confident wrong answer if the semantic layer does not carry it.

### 1. Win rate has two answers

| Basis | Value |
|---|---|
By count — 289 won of 573 closed | **50.4%** |
By value — $203,263,038 of $463,816,637 | **43.8%** |

Six and a half points apart, because the average lost deal ($917,442) is 1.30×
the average won deal ($703,332).

A single metric named `WIN_RATE` is a trap whichever basis it uses. Declare two,
named so that neither can be mistaken for the other — `WIN_RATE_BY_COUNT` and
`WIN_RATE_BY_VALUE` — and describe each in terms that make the distinction
retrievable from a natural-language question. Currently the stage model declares
zero measures, so it declares neither.

### 2. The date horizon has elapsed

| Series | Ends | Relative to 2026-09-21 |
|---|---|---|
Opportunity close dates | 2026-08-16 | past |
Sales order dates | 2025-12-31 | past |
Forecast periods | 2025-12-01 | past |

Zero of the 3,201 open opportunities have a future close date, and all
$1,903,302,819 of open pipeline is past due.

An Analyst model that does not say so will generate `CURRENT_DATE()` filters — the
natural thing to generate — and return empty result sets. An empty result reads as
"we have no pipeline", which is the opposite of what the data shows.

The semantic layer must encode that **"open" means `NOT IS_CLOSED`, not "closing in
the future"**, and every verified query should use absolute dates.

### 3. Grains are not interchangeable

| Object | Rows | Window |
|---|---|---|
`SFDC_OPPORTUNITY` | 3,774 | 2025-02-18 to 2026-08-16 |
`SALESORDER` | 558,011 | 2015-01-03 to 2025-12-31 |
`SALESORDERITEM` | 735,305 | inherits the order window |
`ACTIVITY` | 35,313 | — |
`SALES_REP` | 8 | — |

Two orders of magnitude between opportunities and order lines, over windows that
barely overlap — eighteen months of CRM against eleven years of orders. A count
after joining them fans out; a chart of both on one axis compares different
periods.

The 44 relationships declared on the semantic view are how this is meant to be
handled on the SQL path. The stage model's join behaviour is governed by its own
table definitions, which is another reason a fix applied to one artefact does not
reach the other.

---

## Attainment is variable, and the annual means hide it

| Basis | Value |
|---|---|
Monthly attainment, minimum | **80.00%** |
Monthly attainment, maximum | **117.65%** |
Monthly standard deviation | **9.41 points** |
FY2023 average | 95.30% |
FY2024 average | 95.34% |
FY2025 average | 95.44% |

The three annual averages sit within 0.14 points of each other, which looks flat
and is not. Underneath them, months range from 20 points below quota to nearly 18
points above, with a 9.4-point standard deviation.

**Do not describe attainment in this dataset as flat.** The annual aggregation is
flat; the data is not. A semantic layer that exposes only a yearly average
destroys the only real signal in the series, and a demo that shows three
indistinguishable annual bars is showing the aggregation rather than the business.

The forecast variance is consistently negative and consistently proportional:

| Fiscal year | Forecast | Actual | Variance |
|---|---|---|---|
2023 | $10,278,488,722 | $9,695,336,023 | −$583,152,699 |
2024 | $11,767,821,411 | $11,121,387,615 | −$646,433,796 |
2025 | $12,250,556,433 | $11,561,838,549 | −$688,717,884 |

Three years of forecasting roughly 4.6% high, growing in absolute terms with the
forecast itself. A monthly grain is where that becomes usable; expose it.

Note that these are forecast-series figures, several times larger than the
opportunity amounts. They are different populations at different grains and must
not be compared to the $203,263,038 of won opportunity value.

---

## Recommended end state

| Change | Artefact |
|---|---|
Header comment in each artefact naming the other and stating which the agent reads | both |
`SALES_FORECAST_VS_ACTUAL` added as an 11th table | stage model |
Measures declared: won value, lost value, win rate by count, win rate by value, average deal size by outcome, quota attainment | stage model |
Verified queries 1–8 from [part 7](07-analyst-and-agent.md#the-queries-to-add-first) | stage model |
"Open" documented as `NOT IS_CLOSED`, with the elapsed horizon stated | both |
Attainment exposed at monthly grain, not only annual | both |

None of this requires a change to L1, L2 or the application. The data is in place;
what is missing is the description of what it means.
