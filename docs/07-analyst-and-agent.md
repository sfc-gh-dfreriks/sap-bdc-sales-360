# 7. The analyst and agent layer

What answers a natural-language question in this stack, what it is bound to, and
the work still outstanding before those answers can be trusted in front of a
customer.

---

## Two consumers, two different bindings

| Consumer | Reads | Scale of what it reads |
|---|---|---|
Direct `SEMANTIC_VIEW(...)` SQL | `SEMANTIC.SAP_SALES_360_ANALYTICS` | 64 tables, 369 dimensions, 138 metrics |
`SAP_SALES_360_AGENT`, and the app's **Ask the Agent** page | the Analyst **stage model** | 10 tables, 64 dimensions, 0 measures |

One data layer, two semantic descriptions of it, and the natural-language path
goes through the smaller one. Everything else in this part follows from that.

---

## The agent

| Property | Value |
|---|---|
Name | `SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT` |
Comment | Sales Analytics Agent for SAP Sales 360 Dynamic Tables |
Versions | `VERSION$1` |
Default version | `LAST` |
Orchestration | `auto` |
Tools | **1** — `cortex_analyst_text_to_sql` |

One tool is the simplest agent configuration there is, and it has a clear
consequence: **every question becomes text-to-SQL against the stage model.** There
is no routing decision to get wrong, and equally no fallback.

What that configuration cannot do:

| Capability | Present? | Because |
|---|---|---|
Answer from unstructured content or documentation | no | no Cortex Search tool |
Call an external system | no | no custom tool |
Answer from the 138 semantic-view metrics | no | the tool binds to the stage model |
Answer about a table outside the model's 10 | no | nothing to land on |

`auto` orchestration with a single tool means the orchestration setting is
effectively inert today. It matters the moment a second tool is added — and adding
a Cortex Search tool over this handbook would be the natural second one, because
several of the questions a customer will ask are documentation questions, not data
questions: *why is the pipeline past due*, *what does win rate mean here*.

---

## The stage model

```
@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml
```

| Property | Value |
|---|---|
Model name | `SAP_SALES_360_ANALYTICS` |
Base tables | 10 |
Dimensions | 64 |
Facts | 9 |
**Measures** | **0** |
**Verified queries** | **0** |

The ten base tables:

| Model table | Corresponds to |
|---|---|
`SALESORDER` | order header, 558,011 rows |
`SALESORDERITEM` | order line, 735,305 rows |
`CUSTOMER` | 3,189 customers |
`PRODUCT` | 16,337 products |
`PRODUCT_DESCRIPTION` | 73,242 rows |
`PRODUCT_GROUP` | 1,023 groups |
`PRODUCT_GROUP_TEXT` | 11,168 rows |
`SFDC_OPPORTUNITY` | 3,774 opportunities |
`ACTIVITY` | 35,313 activities |
`SALES_REP` | 8 reps |

This is a well-chosen ten. It is the commercial core — orders, lines, customers,
products, opportunities, activities, reps — and it covers every question a sales
audience is likely to ask. The selection is not the problem.

### What is outside the model

| Not modelled | Consequence |
|---|---|
`SALES_FORECAST_VS_ACTUAL` (41,100 rows) | no natural-language question about forecast attainment can land |
`ATTAINMENT_PREDICTIONS` (12 rows) | predicted attainment is unreachable |
`SALES_REVENUE_PREDICTIONS` (6 rows) | predicted revenue is unreachable |
`SALES_REVENUE_FORECAST_METRICS` (7 rows) | model quality is unreachable |

All four omissions are in the same domain. **The agent cannot answer any question
about forecast or prediction**, which is precisely the domain the application
dedicates a whole page to. "What is our forecast attainment this year" has no table
to land on, and the answer will be a graceful failure or a wrong table — neither
of which is what you want on a call that has just left the Sales Forecast page.

Adding `SALES_FORECAST_VS_ACTUAL` to the model is the single highest-value change
available, and it is one table.

---

## Zero measures

A Cortex Analyst model declares dimensions (what you group by), facts (raw numeric
columns), and measures (named aggregations over facts). This model declares 9 facts
and **0 measures**.

With no measures, the generated SQL invents every aggregation. Nothing pins:

- **won value** to `SUM(AMOUNT) WHERE IS_CLOSED AND IS_WON`
- **win rate** to either basis — see below
- **quota attainment** to actual ÷ quota
- **average deal size** to the outcome-partitioned average

Each of those has a correct definition in this dataset, and none of them is
written down anywhere the model can read. Nine facts with no measures is a model
that knows what the numbers are and not what they mean.

---

## The verified query gap

**Zero verified queries.** This is the most consequential gap in the AI layer, and
the cheapest to close.

A verified query pairs a question with SQL a human has confirmed correct. It does
three things that a schema cannot: it teaches a convention, it makes an answer
reproducible across sessions, and it is retrievable — Analyst uses a matching
verified query in preference to re-deriving SQL from scratch.

This dataset has conventions the schema does not express, and each is a route to a
fluent wrong answer.

### The queries to add first

In priority order. The first three encode the traps; the rest cover the questions
an audience actually asks.

| # | Question | What it pins down |
|---|---|---|
1 | What is our win rate? | that the answer is **two numbers** — 50.4% by count, 43.8% by value — never one |
2 | What is our average deal size for won versus lost deals? | the outcome partition: $703,332 won, $917,442 lost |
3 | What is our open pipeline by stage? | that "open" is `NOT IS_CLOSED`, and that no date-relative filter applies |
4 | How is each rep tracking against quota? | actual ÷ quota over the 8 reps, $229,988,389 total |
5 | Which products appear most in won opportunities? | the opportunity → order line → product join path |
6 | What is total order value by year? | the order grain, and the 2015–2025 window |
7 | How many activities precede a won opportunity? | the activity-to-opportunity grain, 35,313 activities |
8 | What is forecast attainment by month? | requires `SALES_FORECAST_VS_ACTUAL` to be added to the model first |

Query 1 is the one to write before any of the others.

---

## Three traps a verified query should encode

### 1. Win rate is ambiguous by 6.6 points

| Basis | Result |
|---|---|
By count — 289 ÷ 573 | **50.4%** |
By value — $203,263,038 ÷ $463,816,637 | **43.8%** |

An Analyst asked "what is our win rate" will produce one of these and present it
without qualification. Which one it picks depends on wording it was not told is
significant. The verified query must return both, labelled, because the gap is the
finding — see
[findings](05-findings.md#they-lose-the-larger-deals).

### 2. No date-relative filter works

| Series | Ends |
|---|---|
Opportunity close dates | 2026-08-16 |
Sales order dates | 2025-12-31 |
Forecast periods | 2025-12-01 |

Verified on 2026-09-21, all three are in the past. "This quarter", "last 90 days"
and "year to date" all return empty or near-empty, and an Analyst reaching for
`CURRENT_DATE()` — which is the natural thing to generate — produces an empty
result set that reads as "we have no pipeline".

**Every verified query over this data should use absolute date ranges.** The
pipeline is $1,903,302,819 and 100% past due; a query that filters to the future
finds none of it.

### 3. Opportunities and order lines are different grains at different scales

3,774 opportunities against 735,305 order line items, over different periods — CRM
covers eighteen months, orders cover eleven years. A question that joins them and
then counts is at risk of fanning out, and a question that charts them together is
comparing an eleven-year order book against an eighteen-month CRM extract.

---

## The Ask the Agent page

Page 7 of the application. It is the natural-language surface, and it inherits
everything above: 10 tables, 64 dimensions, 0 measures, 0 verified queries, and no
forecast table.

Two implications for a demo.

**Ask questions inside the model's 10 tables.** Pipeline, win/loss, deal size, rep
performance, products, customers, orders, activities — all answerable. Forecast and
prediction are not.

**Avoid relative dates.** Ask "what is our open pipeline by stage", not "what
closed this quarter". The first is a strong answer; the second returns nothing, for
a reason that takes two minutes to explain and undoes the demonstration.

---

## Honest summary for a customer conversation

What is genuinely built and demonstrable:

- One data layer, two semantic descriptions, and a working agent over the smaller
  one.
- A 10-table Analyst model covering the commercial core well.
- A semantic view with 138 metrics and 44 declared relationships — real modelling
  effort, queryable directly.
- An agent with a single, well-chosen tool and `auto` orchestration, reachable from
  the application.

What is not finished, and is better said than found:

- **0 verified queries.** Nothing pins a correct answer to a known question.
- **0 measures.** Every aggregation in an answer is invented by the generated SQL.
- **No forecast table in the model.** The domain the app dedicates a page to is
  unreachable from natural language.
- **The 138 semantic-view metrics are unreachable from the agent**, because the
  agent's tool binds to the stage model.

None of these is a platform limitation. All four are hours of modelling work, and
the first — one verified query for win rate — is worth more than the other three
combined.
