# 5. Findings

Things that were not obvious, that cost time, and that anyone building or
presenting this stack should know. Two are properties of the commercial data, two
are architectural, and two are open gaps in the AI layer.

All figures verified 2026-09-21 against account `MSB89522`.

---

## They lose the larger deals

**Severity: high — analytical, and the most actionable pattern in the dataset.**

Win rate has two defensible definitions and they disagree by 6.6 points:

| Basis | Won | Lost | Win rate |
|---|---|---|---|
Opportunity **count** | 289 | 284 | **50.4%** |
Opportunity **value** | $203,263,038 | $260,553,599 | **43.8%** |

A count-based rate above 50% and a value-based rate below 44% can only mean one
thing, and the deal sizes confirm it:

| Outcome | Opportunities | Value | Average deal |
|---|---|---|---|
Won | 289 | $203,263,038 | **$703,332** |
Lost | 284 | $260,553,599 | **$917,442** |

The average lost deal is $214,110 larger than the average won deal — 1.30 times
the size. On 573 closed opportunities, 284 losses carry **more total value than
289 wins**.

This is the finding to lead with in any commercial conversation about this data,
for three reasons.

First, it inverts the usual read. A 50.4% win rate sounds healthy. The same book of
business at 43.8% by value is a different business, and the difference is not
rounding.

Second, it is specific enough to act on. The pattern is not "we lose deals", it is
"deal size predicts loss", which points at named mechanisms: competitive
displacement at the top of the range, approval friction on large discounts,
procurement entering late on big-ticket cycles, or single-threaded coverage on
deals that need a committee.

Third, it is a trap for anyone reporting on this data. **A win-rate metric that
does not state its basis is ambiguous by 6.6 points here.** Any semantic model
over this data should expose both, named distinctly, so that a natural-language
question cannot silently pick the flattering one. That requirement is carried into
[the semantic layer](08-semantic-layer.md#what-the-semantic-layer-must-encode).

For context on scale: total quota across the 8 reps is $229,988,389, and won value
is $203,263,038 — 88.4% of it. The $260,553,599 lost is more than the entire
quota. Recovering even a fifth of the lost value would exceed the gap to quota.

---

## The open pipeline is entirely past due

**Severity: high — presentation-blocking if unstated, harmless if stated.**

| Measure | Value |
|---|---|
Open opportunities | 3,201 |
Open pipeline value | $1,903,302,819 |
Open opportunities with a close date **before** 2026-09-21 | **3,201** |
Open opportunities with a close date **on or after** 2026-09-21 | **0** |
Past-due open value | **$1,903,302,819** |

Not most of it. All of it. The latest `CLOSE_DATE` anywhere in
`CRM_OPPORTUNITY_OPPORTUNITY` is 2026-08-16, about five weeks before the
verification date, so no open opportunity *can* have a future close date.

This is a demo-data artefact. The dataset was generated with a close-date window
that has since elapsed; nothing about the pipeline's internal structure is wrong.
The stage distribution is intact and reconciles exactly:

| Stage | Opportunities | Value | Avg probability |
|---|---|---|---|
Needs Analysis | 532 | $298,047,416 | 40% |
Id. Decision Makers | 385 | $270,081,010 | 60% |
Negotiation/Review | 380 | $244,081,033 | 90% |
Prospecting | 447 | $235,418,270 | 10% |
Proposal/Price Quote | 371 | $228,648,259 | 75% |
Perception Analysis | 395 | $218,244,975 | 70% |
Qualification | 354 | $206,254,267 | 20% |
Value Proposition | 337 | $202,527,589 | 50% |
**Total** | **3,201** | **$1,903,302,819** | — |

**The consequence: the Sales Forecast page demonstrates method, not a forward
call.** It shows a prediction table, an attainment series and a model-metrics
table wired correctly together over a horizon that has already passed. That is a
legitimate thing to demonstrate — the mechanism is what a customer is evaluating —
but it must be framed as the mechanism. Presenting $1.9bn of elapsed pipeline as
forward coverage is a claim the data does not support, and it is the kind of claim
an architect in the room will test.

Two secondary observations from the same table, both worth a sentence on a call:

**The funnel is not a funnel.** Stage counts run 337 to 532 and stage values
$202.5m to $298.0m — a near-uniform distribution. A real pipeline narrows toward
close. This one does not, which is the generator showing through. Any conversion or
stage-velocity analysis over it will produce arithmetic rather than insight.

**Probability is stage-derived, not deal-derived.** Every stage returns a whole,
constant average probability — 10, 20, 40, 50, 60, 70, 75, 90. The probability
column is a lookup on stage name, not a per-deal judgement, so a
probability-weighted pipeline is a re-expression of the stage mix and adds no
information beyond it.

### How to say it

> All 3,201 open opportunities in this dataset have a close date in the past — the
> generated close-date window has elapsed. The pipeline distribution and the
> forecasting mechanism are real; the horizon is not. What you are seeing on this
> page is how the forecast is produced, not what it predicts.

---

## L1 is not zero-copy

**Severity: medium — architectural, with a clear and cheap fix.**

The zero-copy story holds at the L0 boundary and stops immediately above it.

| Layer | Objects | Object type | Dynamic tables | Rows | Storage added |
|---|---|---|---|---|---|
L1, Sales 360 | 31 | `BASE TABLE` | 0 | 2,551,850 | all of it |
L1, Finance 360 | 6 | `VIEW` | 0 | — | none |

`SHOW DYNAMIC TABLES IN SAP_BDC_L1` returns zero rows and
`INFORMATION_SCHEMA.TABLES` returns 31 base tables. L1 is a materialised copy of
the share.

And most of it is then copied again. Ten object names appear in both L1 and L2 with
identical row counts:

| Object | Rows, stored in both layers |
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
**Total duplicated** | **1,437,370** |

That is **97.2% of L2's 1,478,495 rows** and **56.3% of L1's 2,551,850**. Only
41,125 rows in L2 are genuinely new: `SALES_FORECAST_VS_ACTUAL` at 41,100 and the
three ML tables at 25 between them.

### Contrast with Finance 360, explicitly

Finance 360 builds L1 as six views. Each selects from its L0 counterpart and adds
column comments. The result adds naming, documentation and access control, and adds
**no storage, no load step and no refresh lag** — a view cannot be stale.

Sales 360 builds L1 as 31 tables holding 2.5m rows, which means:

| Property | Finance 360 L1 (views) | Sales 360 L1 (tables) |
|---|---|---|
Storage | none | 2,551,850 rows |
Load step to maintain | none | yes |
Can be stale | no | yes |
Zero-copy claim survives to L1 | yes | no |
Failure mode | compile error or grant error — loud | stale data — silent |

The last row is the reason this is a finding rather than a preference. A broken
view fails loudly. A stale table returns yesterday's numbers with no error, and
nothing in the stack flags it.

### Recommendation

**Convert the 31 L1 tables to passthrough views.** Nothing downstream needs to
change: a dynamic table selects from a view exactly as it selects from a table, and
L2's 11 dynamic tables already hold the materialisation that the app actually
reads — all 53 of its `FROM` clauses are on L2, none on L1.

The change removes 2,551,850 rows of storage, removes the L1 load step from the
refresh runbook, eliminates the staleness failure mode, and makes the zero-copy
claim true up to the point where materialisation is genuinely earned. There is no
identified consumer of L1 that would be affected.

---

## Zero verified queries on the stage model

**Severity: medium — open gap, and the cheapest high-value work remaining.**

| Property | Value |
|---|---|
Stage file | `@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml` |
Model name | `SAP_SALES_360_ANALYTICS` |
Base tables | 10 |
Dimensions | 64 |
Facts | 9 |
Measures | 0 |
**Verified queries** | **0** |

A verified query is a question paired with SQL a human has confirmed is correct.
It is how a Cortex Analyst model is taught the conventions of its data, and it is
the mechanism by which an answer becomes reproducible rather than re-derived.

With zero of them, every question is answered from the schema alone, and this
dataset has at least three conventions the schema does not express — the win-rate
basis ambiguity, the elapsed date horizon, and the grain difference between
opportunities and order lines. Each is a way for a fluent, well-formed,
confidently-presented wrong answer to be produced.

**0 measures compounds it.** A model with no declared measures offers no
aggregations of its own, so every `SUM` and `AVG` in an answer is invented by the
generated SQL. There is nothing to pin `won value` or `attainment` to a definition.

The specific queries to add, in priority order, are in
[the analyst and agent layer](07-analyst-and-agent.md#the-queries-to-add-first).

---

## A 64-table semantic view beside a 10-table stage model

**Severity: medium — operational, and the failure mode is wasted effort.**

Two semantic artefacts over the same data layer, at very different scales:

| | Semantic view | Analyst stage model |
|---|---|---|
Name | `SEMANTIC.SAP_SALES_360_ANALYTICS` | `SAP_SALES_360_ANALYTICS` |
Form | Snowflake object | YAML on a stage |
Logical tables | **64** | **10** |
Dimensions | **369** | **64** |
Facts | 69 | 9 |
Metrics / measures | 138 metrics | **0 measures** |
Relationships | 44 | — |
Verified queries | — | 0 |

The two carry the same model name and are not the same artefact. That alone has
cost time.

**The asymmetry is a 6.4× difference in table coverage and a 5.8× difference in
dimensions.** The semantic view reaches across 64 logical tables — more than the 14
objects in L2, so it is pulling in L1 and the product master facets. The stage
model covers 10: `SALESORDER`, `SALESORDERITEM`, `CUSTOMER`, `PRODUCT`,
`PRODUCT_DESCRIPTION`, `PRODUCT_GROUP`, `PRODUCT_GROUP_TEXT`, `SFDC_OPPORTUNITY`,
`ACTIVITY`, `SALES_REP`.

### Which artefact the agent actually reads

`SAP_SALES_360_AGENT` declares exactly one tool: `cortex_analyst_text_to_sql`.
That tool binds to the **Analyst stage model**. Therefore:

- Every question asked through the agent, and through the application's **Ask the
  Agent** page, is answered against the **10-table stage model**.
- The 64-table, 369-dimension, 138-metric semantic view answers **nothing** asked
  through the agent. It serves direct `SEMANTIC_VIEW(...)` SQL.

### What that means when someone edits the wrong one

This is the practical cost, and it is a specific, repeatable waste:

An agent answer is wrong. The obvious place to look is the large, well-populated,
138-metric semantic view — it is a first-class database object, it is
discoverable, and it has the same name as the model. Someone adds the missing
metric there, redeploys, re-asks, and **nothing changes**. The answer is still
wrong, because the agent never read that object. The edit is correct in itself and
irrelevant to the symptom.

Worse, the reverse also holds. A metric fixed only in the stage YAML does not
appear to anyone querying the semantic view, so the two artefacts drift. With 138
metrics on one side and 0 measures on the other, they have already drifted about
as far as they can.

### The rule

| Symptom | Edit |
|---|---|
Agent answer wrong; Ask the Agent page wrong | the **stage YAML** |
`SEMANTIC_VIEW(...)` result wrong | the **semantic view** |

Anything a customer is expected to ask the agent must be in the stage model. The
54 logical tables that exist only in the semantic view are unreachable from
natural language, and the 138 metrics are unreachable from the agent. Detail in
[the semantic layer](08-semantic-layer.md#which-artefact-to-edit).

---

## Summary of open gaps

| Gap | Severity | Fix |
|---|---|---|
Open pipeline is 100% past due — 0 of 3,201 have a future close date | high | state it when the forecast page appears; regenerate close dates to fix properly |
Win rate is ambiguous by 6.6 points between count and value basis | high | expose both bases as distinctly named metrics |
L1 is 31 materialised tables, 1,437,370 rows duplicated into L2 | medium | convert L1 to passthrough views |
0 verified queries on the stage model | medium | add the queries listed in part 7 |
0 measures on the stage model | medium | declare measures for won value, attainment, win rate |
64-table semantic view vs 10-table stage model; agent reads only the latter | medium | promote the metrics that matter into the stage model, or document the split at the top of both |
Three ML tables are plain and will not refresh with the dynamic tables | low | add re-inference to the refresh runbook |
No series reaches the current date — three different end dates | low | use absolute date ranges in demo and verified queries |
