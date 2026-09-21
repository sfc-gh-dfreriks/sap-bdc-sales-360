# 6. References

Where every artefact in this stack lives, what produced it, and what is
deliberately out of scope.

---

## This repository

### [`dfreriks-snow/sap-bdc-sales-360`](https://github.com/dfreriks-snow/sap-bdc-sales-360)

| Path | Contents |
|---|---|
`app/` | React client and Express server; `api.ts` holds all SQL |
`sql/` | L1 and L2 object definitions, semantic view, agent |
`scripts/` | deployment and refresh helpers |
`service/` | Native App service specification |
`docs/` | this handbook, parts 1–8, plus `ARCHITECTURE.md`, `INSTALL.md`, `DEMO_GUIDE.md` |
`docs/docx/` | Word renderings — 8 part documents plus the combined handbook |
`tools/` | fact extraction, document and deck builders |

Branch for these assets: `sales-360-assets`.

---

## Deployed objects

| Object | Identifier |
|---|---|
Account | `MSB89522` |
Region | `PUBLIC.AWS_US_WEST_2` |
Database | `SAP_SALES_360` |
L1 schema | `SAP_SALES_360.SAP_BDC_L1` — 31 tables, 2,551,850 rows |
L2 schema | `SAP_SALES_360.SALES_360_L2` — 14 tables, 1,478,495 rows |
Semantic schema | `SAP_SALES_360.SEMANTIC` |
Semantic view | `SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS` |
Analyst stage model | `@SAP_SALES_360.SEMANTIC.SEMANTIC_STAGE/sap_sales_360_semantic.yaml` |
Cortex Agent | `SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT` |
Application | `mrzht4-sfsenorthamerica-dfreriks-aws1-w2.snowflakecomputing.app` |

The application URL is returned by `CALL SALES_360_APP.CORE.APP_URL()` rather than
hard-coded, so it survives a redeploy.

---

## Upstream data

### SAP Business Data Cloud Standard Data Products

L0 is a set of SAP BDC Standard Data Products, mounted into the account as shared
databases and read in place. Nothing is copied at that boundary.

The object families that reach L1:

| Family | L1 objects | Notes |
|---|---|---|
Sales orders | 2 | header and item; 558,011 and 735,305 rows |
Product master | 19 | plant, valuation, costing, storage, procurement, UoM, quality, forecast facets |
Product classification | 5 | description, group, group text, MRP area, international trade |
CRM opportunity | 3 | opportunity, activity, sales rep |
Customer | 1 | 3,189 rows |
Forecast | 1 | `SALES_FORECAST`, 41,100 rows |

The product master's shape is worth noting when reading the object list: six
objects carry exactly 92,243 rows (the plant grain across facets) and three carry
83,501 (the valuation grain). That repetition is SAP's model reproduced faithfully,
not a load artefact.

The shape of L0 is not ours to change. Column names, grains, and the absence of
anything SAP does not publish are givens — see
[concepts](01-concepts.md#zero-copy-at-the-l0-boundary).

---

## Snowflake platform features used

| Feature | Where | Note |
|---|---|---|
Secure data sharing | L0 → L1 | the zero-copy boundary |
Dynamic tables | L2, 11 objects | refresh driven by the declared lag |
Semantic views | `SEMANTIC.SAP_SALES_360_ANALYTICS` | 64 tables, 369 dims, 69 facts, 138 metrics, 44 relationships |
Cortex Analyst | stage YAML | 10 tables, 64 dims, 9 facts, 0 measures, 0 verified queries |
Cortex Agent | `SAP_SALES_360_AGENT` | 1 tool, `auto` orchestration, `VERSION$1` |
Native Apps | the 7-page application | packaged for Snowpark Container Services |
Snowpark Container Services | app runtime | React client, Express server |
ML output tables | 3 plain tables in L2 | 12, 6 and 7 rows |

Notably **not** used: materialized views (none in either schema), streams and
tasks (dynamic tables cover the refresh), and Cortex Search (the agent has no
search tool).

---

## Companion asset — Finance 360

### [`dfreriks-snow/sap-bdc-finance-360`](https://github.com/dfreriks-snow/sap-bdc-finance-360)

The sibling build over SAP finance data products. It shares the layer naming, the
toolchain and the documentation structure, and differs in three ways that this
handbook refers to directly:

| | Finance 360 | Sales 360 |
|---|---|---|
L1 | 6 passthrough **views**, no storage | 31 materialised **tables**, 2,551,850 rows |
App data sources | L2 **and** the L0 shares | L2 only, 53 reads |
Semantic artefacts | two semantic views plus a stage model | one semantic view plus a stage model |
App pages | 9 | 7 |

The L1 contrast is the substantive one and is argued in
[findings](05-findings.md#l1-is-not-zero-copy). The app-reads contrast cuts the
other way: Sales 360's single-layer dependency is the cleaner of the two.

### Toolchain shared across the family

| Tool | Purpose |
|---|---|
`tools/sales_facts.py` | extracts every figure in this handbook, with a provenance entry per fact |
`tools/build_docs_docx.py` | renders `docs/01`–`08` into `docs/docx/` — 9 files |
`tools/build_management_summary.py` | executive Word summary |
`tools/build_presales_kit.py` | presales Word kit |
`tools/build_presales_deck.py` | PowerPoint deck |
`tools/build_demo_scripts.py` | demo narration scripts |
`tools/docx_kit.py` | shared palette, page setup and table helpers |
`tools/pptx_kit.py` | the PowerPoint equivalent |
`tools/verify_word_assets.py` | checks the Word outputs |

`docx_kit.py` is byte-identical to the Finance 360 copy, which is what makes the
two document sets read as one family.

---

## Generated artefacts

| Artefact | Source | Output |
|---|---|---|
This handbook, parts 1–8 | `docs/0*.md` | markdown, source of record |
Word part documents | `tools/build_docs_docx.py` | `docs/docx/0*_*.docx`, 8 files |
Combined handbook | same | `docs/docx/SAP_Sales_360_Documentation_Handbook.docx` |
Demo guide deck | `tools/build_presales_deck.py` | `docs/SAP_Sales_360_Demo_Guide.pptx` |

The markdown is the source of record. The Word files are regenerated from it and
should never be edited directly — an edit there is lost on the next build.

### A note on the renderer

`build_docs_docx.py` is a bespoke renderer rather than a pandoc invocation,
because the output has to match the palette and table styling of the other Word
and PowerPoint deliverables in the family.

Its one non-obvious behaviour: the GFM table parser accepts rows **without**
leading and trailing pipes. GFM does not require them and most rows in this doc
set omit them. A parser that insists on them drops those rows silently, producing
a shorter table and no error. The row-count check described in
[execution](04-execution.md#word-versions-of-the-documentation) exists solely to
catch a regression in that behaviour.

---

## Fact provenance

Every figure in this handbook traces to one of:

| Source | Facts it establishes |
|---|---|
`INFORMATION_SCHEMA.TABLES` | object inventories and row counts, both schemas |
`INFORMATION_SCHEMA.SCHEMATA` | the 3-schema count |
`SHOW DYNAMIC TABLES` | which objects are dynamic — 0 in L1, 11 in L2 |
`DESCRIBE SEMANTIC VIEW` | 64 / 369 / 69 / 138 / 44 |
`GET` + YAML parse | stage model tables, dimensions, facts, measures, verified queries |
`DESCRIBE AGENT` | tool list, orchestration, versions |
`api.ts` `FROM` clauses | the 53-read census |
`Sidebar.tsx` nav array | the 7 page names |
Aggregate SQL over L2 | pipeline, win/loss, quota, deal size, attainment, date windows |
`CURRENT_ACCOUNT()`, `CURRENT_REGION()` | account and region |

Extraction date: **2026-09-21**.

---

## Boundaries in one table

| Question | Answerable here? |
|---|---|
Pipeline by stage, value and count | yes |
Win rate, by count and by value | yes — both, and they differ |
Deal size by outcome | yes |
Quota attainment by rep and by month | yes |
Order volume and line-item detail | yes — 558,011 orders, 735,305 lines |
Product master attributes | yes — 19 facets |
Customer master | yes — 3,189 |
Forecast versus actual, 2023–2025 | yes |
Forward pipeline with a future close date | **no** — 0 of 3,201 qualify |
Pricing conditions or discount approval history | no — not published |
Sales organisation hierarchy above the 8-rep roster | no |
Which SAP data products exist, as a catalog model | no — not a metadata model |
Anything requiring a write back to SAP | no — read-only throughout |
