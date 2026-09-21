# 4. Execution

How to run, verify and refresh the stack, and what to check when a number looks
wrong.

---

## Prerequisites

| Requirement | Detail |
|---|---|
Account | `MSB89522`, region `PUBLIC.AWS_US_WEST_2` |
Database | `SAP_SALES_360` |
Schemas | `SAP_BDC_L1`, `SALES_360_L2`, `SEMANTIC` |
L0 access | SAP BDC Standard Data Product shares mounted and granted |
Warehouse | one, sized for a 735,305-row dynamic table refresh |
Python | `python-docx` for the Word deliverables |

The role in use needs read on the shares, ownership or equivalent on the three
schemas, and usage on the semantic view and the agent.

---

## Verifying a deployment

Five checks, in this order. Each one either passes cleanly or tells you which
layer to look at.

### 1. Object inventory

| Layer | Expected objects | Expected rows |
|---|---|---|
`SAP_BDC_L1` | 31 base tables, 0 dynamic | 2,551,850 |
`SALES_360_L2` | 14 tables — 11 dynamic, 3 plain | 1,478,495 |

A short L1 count means a load did not run. A short L2 count means a dynamic table
has not refreshed, which is a lag question rather than a load failure.

### 2. The duplication check

Compare row counts for the ten names present in both layers. All ten should match,
totalling 1,437,370 rows.

This check has two readings. Matching counts mean the dynamic tables are current.
They also mean 1,437,370 rows are stored twice — 97.2% of L2, 56.3% of L1. If you
act on the recommendation in
[findings](05-findings.md#l1-is-not-zero-copy) and convert L1 to views, the
counts should still match and the storage should not.

### 3. The commercial reconciliation

| Derivation | Expected |
|---|---|
Closed opportunities | 573 (289 won + 284 lost) |
Open opportunities | 3,201 |
Sum over the 8 pipeline stages | 3,201 opportunities, $1,903,302,819 |
Win rate by count | 50.4% |
Win rate by value | 43.8% |

The stage sum reconciling to the open pipeline total is the most useful single
check here, because it exercises the opportunity table's `IS_CLOSED` flag,
`STAGE_NAME` and `AMOUNT` together.

### 4. The horizon check

```
-- open opportunities with a future close date
NOT IS_CLOSED AND CLOSE_DATE >= CURRENT_DATE()
```

On 2026-09-21 this returns **0** against 3,201 open opportunities. That is
expected for this dataset and not a bug — see
[findings](05-findings.md#the-open-pipeline-is-entirely-past-due) — but it is the
check to run before any demo that touches the forecast, because the answer changes
the script.

### 5. The AI layer

| Artefact | Check | Expected |
|---|---|---|
Semantic view | `DESCRIBE SEMANTIC VIEW` | 64 / 369 / 69 / 138 / 44 |
Stage model | `GET` and parse the YAML | 10 tables, 64 dimensions, 9 facts, 0 verified queries |
Agent | `DESCRIBE AGENT` | 1 tool, `auto` orchestration |

The stage model returning 0 verified queries is the current state, not a failure
of the check. It is a gap, recorded as one.

---

## Data windows to keep in mind

| Series | Ends | Age at 2026-09-21 |
|---|---|---|
`SALESORDERS_SALESORDER` (`SALESORDERDATE`) | 2025-12-31 | just under nine months |
`SALES_FORECAST_VS_ACTUAL` (`PERIOD_DATE`) | 2025-12-01 | just under ten months |
`CRM_OPPORTUNITY_OPPORTUNITY` (`CLOSE_DATE`) | 2026-08-16 | about five weeks |

Three different ends, and none of them is today. Any query with a
`CURRENT_DATE()`-relative filter — last quarter, this month, next 90 days —
returns empty or near-empty against at least one of these series. Use absolute
date ranges in demo queries and in verified queries.

The order history begins 2015-01-03, so the sales order series is eleven years
deep. A "year over year" chart over it has ten comparisons available; a
"year over year" chart over opportunities has one partial one.

---

## Refreshing after the SAP data changes

1. Reload the 31 L1 tables. This is the step that exists only because L1 is
   materialised; a view layer would need nothing here.
2. Let the 11 L2 dynamic tables refresh, or force them.
3. Re-run the duplication check. The ten shared counts should match again.
4. Re-train and rewrite the three ML tables if the input series moved. They are
   plain tables and will not refresh themselves — 12, 6 and 7 rows that a
   dynamic-table refresh will silently leave stale.
5. Re-run the commercial reconciliation.
6. Re-extract the facts, then rebuild the documentation.

Step 4 is the one that gets missed. Dynamic tables make most of this layer
self-maintaining, which makes the three tables that are not easy to forget.

---

## Editing the semantic layer

Decide which artefact you are editing before you open a file.

| Symptom | Artefact to edit |
|---|---|
An answer from the agent or the app's Ask the Agent page is wrong | the **stage model** YAML |
A `SEMANTIC_VIEW(...)` query returns the wrong metric | the **semantic view** |
The agent picks the wrong tool | the **agent** — though with one tool there is no wrong pick |

Editing the semantic view to fix an agent answer will have no effect, because the
agent's single tool is `cortex_analyst_text_to_sql` and that binds to the stage
model. The 369-dimension semantic view and the 64-dimension stage model are
separate artefacts over the same data, and the large one is not the one the agent
reads. Full treatment in
[the semantic layer](08-semantic-layer.md#which-artefact-to-edit).

After editing the YAML, `PUT` it back to
`@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/` under the same name and re-ask the
question that failed.

---

## Running a demo against this data

Three things to say before anyone asks.

**On the pipeline.** $1,903,302,819 across 3,201 opportunities is a real
distribution over eight stages, and all of it has a close date in the past. Say so
when the pipeline appears. It costs one sentence and it removes the only question
that can derail the forecast page.

**On win rate.** Lead with both numbers. 50.4% by count and 43.8% by value is a
more interesting opening than either alone, and it sets up the finding that
follows: average won deal $703,332, average lost deal $917,442.

**On attainment.** Monthly attainment runs 80% to 117.65% with a standard
deviation of 9.4 points. Do not describe it as flat. The three fiscal-year
averages — 95.30%, 95.34%, 95.44% — are what look flat, and they are annual means
over genuinely variable months.

---

## Word versions of the documentation

```
python tools/build_docs_docx.py
```

Reads the eight markdown files in `docs/` and writes nine files to `docs/docx/`:
one per source plus `SAP_Sales_360_Documentation_Handbook.docx`, which carries a
contents table and all eight parts in reading order.

Output goes to the repository rather than to a user directory, because these are
regenerated artefacts and reviewers expect them next to their sources.

The renderer prints a per-file line count and a table-row count. **Check the
table-row count.** Most GFM table rows in this doc set omit leading and trailing
pipes, which GFM permits; a parser that requires them drops those rows without
raising anything. The row-count assertion is the only thing standing between that
failure mode and a handbook with most of its tables quietly truncated.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
L2 row count below 1,478,495 | a dynamic table has not refreshed |
The ten shared counts disagree | L1 reloaded, L2 not yet refreshed — check in that order |
A date-relative query returns nothing | the series ends before `CURRENT_DATE()`; use absolute dates |
The forecast page shows no future periods | expected — the input series ends 2025-12-01 |
Open pipeline shows entirely past due | expected — 0 of 3,201 open opportunities have a future close date |
An agent answer is wrong and editing the semantic view changed nothing | you edited the wrong artefact; edit the stage YAML |
An ML prediction looks stale after a reload | the three ML tables are plain and do not refresh; re-run inference |
A rendered table is shorter than its markdown source | the table parser is rejecting rows without outer pipes |
