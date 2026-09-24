#!/usr/bin/env python3
"""Build the SAP Sales 360 presales kit documents.

Third in the set, after Supply Chain 360 and Finance 360, and deliberately
consistent with them in numbering, branding and tone:

    00_START_HERE.docx               what is in the kit and which file to open
    03_SE_Quick_Start.docx           positioning, demo path, objections
    05_Architecture_and_Install.docx the stack and how to stand it up
    06_Setup_and_Access.docx         deployment and how to get in

Every figure is read from /tmp/sales_facts.json, produced by tools/sales_facts.py
straight from the account. Nothing is carried over from an earlier document.

Sales 360 is not shaped like Finance 360, and the kit says so rather than reusing
the Finance narrative:

    - L1 here is a materialised copy, so the "no copy anywhere" line is false
    - ten L2 tables re-materialise their L1 counterparts row for row
    - there is a real Cortex Agent object, which Finance has not
    - every open opportunity is already past its close date

Run the extractor first:

    python3 tools/sales_facts.py
    python3 tools/build_presales_kit.py
"""
from __future__ import annotations

import json
import pathlib
import sys
from datetime import date

from docx import Document
from docx.shared import Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from docx_kit import (  # noqa: E402
    GREY,
    RED,
    SAP_NAVY,
    SNOW_BLUE,
    body,
    bullet,
    callout,
    h1,
    h2,
    money,
    setup_page,
    table,
)

KIT = pathlib.Path.home() / "Documents" / "SAP" / "Sales_360_Presales_Kit"
FACTS_FILE = pathlib.Path("/tmp/sales_facts.json")
DATE = date.today().strftime("%d %B %Y")

PAGE_PURPOSE = {
    "Dashboard": "Pipeline, bookings and attainment headline",
    "Sales Funnel": "Stage-by-stage conversion and value by stage",
    "Customer Health": "Account-level order history and risk signals",
    "Products": "What sells, by product and product group",
    "Rep Leaderboard": "Quota, attainment and ranking by rep",
    "Sales Forecast": "Forecast against actual, with ML predictions",
    "Ask the Agent": "Natural-language questions via the Cortex Agent",
}


def load_facts() -> dict:
    if not FACTS_FILE.exists():
        sys.exit(f"{FACTS_FILE} missing — run: python3 tools/sales_facts.py")
    return json.loads(FACTS_FILE.read_text())["facts"]


def title_block(doc, title, subtitle, strap):
    for text_, size, bold, color, after in (
        (title, 20, True, SAP_NAVY, 2),
        (subtitle, 11.5, False, SNOW_BLUE, 2),
        (strap, 9, False, GREY, 14),
    ):
        p = doc.add_paragraph()
        r = p.add_run(text_)
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        p.paragraph_format.space_after = Pt(after)


def pipeline_callout(doc, F):
    """The one caveat most likely to embarrass someone in front of a customer."""
    if not F["pipeline_is_entirely_past_due"]:
        return
    callout(
        doc, "Read this before you demo",
        f"**Every open opportunity is already past its close date.** All "
        f"{F['open_opps_past_due']:,} of them, worth "
        f"{money(F['open_amount_past_due'])}, sit behind today's date, and "
        f"{F['open_opps_future']} have a future one. So this is not a forward "
        f"pipeline — do not present it as commit, coverage or 'what we expect to "
        f"close'. Describe it as a snapshot of pipeline structure: stage mix, "
        f"deal size, conversion. If a customer spots the dates, say plainly that "
        f"it is a fixed reference dataset, not a live CRM feed.",
    )


def provenance_table(doc, F):
    h1(doc, "Figures are verified, not copied")
    body(doc, "Every number here was read from the account by `tools/sales_facts.py` "
              f"on {F['verified_on']}. Re-run the stated source to check any of them.")
    sv, M = F["semantic_view"], F["analyst_model"]
    table(doc, ["Figure", "Source"], [
        [f"{F['l1_table_count']} L1 tables, {F['l1_rows']:,} rows",
         "INFORMATION_SCHEMA.TABLES, SAP_BDC_L1"],
        [f"{F['l2_table_count']} L2 tables, {F['l2_rows']:,} rows "
         f"({F['l2_dynamic_count']} dynamic)", "INFORMATION_SCHEMA + SHOW DYNAMIC TABLES"],
        [f"{sv['tables']} tables, {sv['facts']} facts, {sv['metrics']} metrics, "
         f"{sv['relationships']} relationships", "DESCRIBE SEMANTIC VIEW"],
        [f"Analyst model: {len(M.get('tables') or [])} tables, {M.get('dimensions')} "
         f"dimensions, {M.get('verified_queries')} verified queries", "stage YAML"],
        [f"{F['app_page_count']} app pages", "Sidebar.tsx nav array"],
        [f"{F['opportunity_count']:,} opportunities, {F['sales_reps']} reps",
         "COUNT(*) over the L2 tables"],
        [f"{F['order_value_total']:,} sales orders", "COUNT(*), SALESORDERS_SALESORDER"],
    ], [4.0, 2.9], zebra=True)


# ---------------------------------------------------------------- START HERE


def build_start_here(F):
    doc = Document()
    setup_page(doc)
    title_block(doc, "SAP Sales 360", "Presales kit — start here",
                f"{DATE} · verified against account {F['account']} · {F['region']}")

    body(doc, "This kit is for a Snowflake SE or partner SE who needs to show SAP "
              "sales and CRM data working together in Snowflake, without standing "
              "anything up first. Read this page, then open one other file.")

    h1(doc, "What this demonstrates")
    body(doc,
         "SAP sales orders and product master joined to CRM opportunity data, shaped "
         "into an analytics layer, and then queried three ways: through a "
         f"{F['app_page_count']}-page application, through a governed semantic view, "
         "and in natural language through a Cortex Agent.")
    bullet(doc, "**Two source systems, one model.** SAP order history and CRM "
                "opportunities are joined on the customer key — the thing neither "
                "system can show on its own.")
    bullet(doc, f"**{F['l2_dynamic_count']} dynamic tables** keep the analytics layer "
                "current as the sources change.")
    bullet(doc, "**A real Cortex Agent**, not just a text-to-SQL call — "
                f"`{F['cortex_agent']['name'].split('.')[-1]}` with "
                f"{F['cortex_agent'].get('tool_count', 0)} tool and "
                f"`{F['cortex_agent'].get('orchestration')}` orchestration.")

    h1(doc, "Which file to open")
    table(doc, ["If you want to", "Open", "Audience"], [
        ["Demo it in ten minutes", "03_SE_Quick_Start.docx", "seller / SE"],
        ["Drop slides into your own deck", "00_Presales_Overview.pptx", "seller"],
        ["Explain the architecture", "05_Architecture_and_Install.docx", "technical"],
        ["Get access, or deploy it", "06_Setup_and_Access.docx", "technical"],
        ["Hand something to a customer", "01_Demo_Guide_Deck.pptx", "customer"],
    ], [2.6, 2.6, 1.6], zebra=True)

    pipeline_callout(doc, F)

    h1(doc, "What is in the data")
    d = {bool(r["IS_WON"]): r for r in F["deal_size"]}
    w, l = d.get(True, {}), d.get(False, {})
    table(doc, ["Measure", "Value"], [
        ["Open pipeline (all past due)", money(F["open_pipeline"])],
        ["Opportunities", f"{F['opportunity_count']:,}"],
        ["Win rate by deal count", f"{F['win_rate_pct']}%"],
        ["Win rate by value", f"{F['win_rate_value_pct']}%"],
        ["Average won deal", money(w.get("AVG_DEAL", 0))],
        ["Average lost deal", money(l.get("AVG_DEAL", 0))],
        ["Sales orders", f"{F['order_value_total']:,}"],
        ["Reps / total quota", f"{F['sales_reps']} / {money(F['quota_total'])}"],
    ], [3.4, 2.0], align_right=(1,), zebra=True)

    callout(doc, "The insight worth leading with",
            f"They win **{F['win_rate_pct']}%** of deals but only "
            f"**{F['win_rate_value_pct']}%** of the value: the average won deal is "
            f"{money(w.get('AVG_DEAL', 0))} and the average lost deal is "
            f"{money(l.get('AVG_DEAL', 0))}. They are losing the big ones. That is a "
            f"real finding in this dataset, it is the kind of question a rep cannot "
            f"answer from CRM alone, and it lands better than any platform claim.")

    provenance_table(doc, F)

    h1(doc, "The companion kits")
    body(doc, "Supply Chain 360 and Finance 360 are the sibling asset sets. Same "
              "branding, same file numbering, same medallion idea over different SAP "
              "domains. Note the layers are **not** built identically — Finance reads "
              "its share through passthrough views, Sales materialises it. If you "
              "present two of them together, be ready for that question.")

    h1(doc, "Support")
    body(doc, f"Source, issues and build scripts: {F['repo']}")
    out = KIT / "00_START_HERE.docx"
    doc.save(str(out))
    return out


# --------------------------------------------------------------- QUICK START


def build_quick_start(F):
    doc = Document()
    setup_page(doc)
    title_block(doc, "SE Quick Start", "SAP Sales 360",
                f"{DATE} · a ten-minute path, and what to say")

    h1(doc, "Positioning, in three sentences")
    body(doc,
         "A sales leader's two most important datasets live in two different systems: "
         "orders in SAP, opportunities in CRM. Joining them normally means a project, "
         "so most teams settle for two reports and a spreadsheet. This shows both in "
         "one governed model in Snowflake, with the agent answering questions across "
         "the join.")

    h1(doc, "Before you start")
    bullet(doc, f"Open the app: {F['app_url'] or 'see 06_Setup_and_Access.docx'}")
    bullet(doc, "Read the pipeline caveat below. It is the one thing that will catch "
                "you out.")
    bullet(doc, "Decide whether you are demoing the funnel or the agent. Both in ten "
                "minutes is rushed.")
    pipeline_callout(doc, F)

    h1(doc, "The ten-minute path")
    d = {bool(r["IS_WON"]): r for r in F["deal_size"]}
    w, l = d.get(True, {}), d.get(False, {})
    top = F["pipeline_by_stage"][0] if F["pipeline_by_stage"] else {}
    steps = [
        ["1", "Dashboard", f"Open on the headline — {money(F['open_pipeline'])} pipeline "
         f"across {F['opportunity_count']:,} opportunities. Say: orders from SAP, "
         f"opportunities from CRM, one model."],
        ["2", "Sales Funnel", f"Walk the stages. Largest is {top.get('STAGE_NAME','—')} "
         f"at {money(top.get('AMOUNT', 0))}. Point out value concentrating in early "
         f"stages — that is a coverage conversation."],
        ["3", "Rep Leaderboard", f"{F['sales_reps']} reps against "
         f"{money(F['quota_total'])} of quota. Ask who owns quota-setting in their org."],
        ["4", "Sales Forecast", "Forecast against actual. Monthly attainment ranges "
         f"{F['attainment_spread']['min']}–{F['attainment_spread']['max']}%, so there "
         f"is real variance to talk about, not a flat line."],
        ["5", "Ask the Agent", "Ask one question in plain English. Let them pick it. "
         "This is the moment that lands."],
    ]
    table(doc, ["#", "Page", "What to do and say"], steps, [0.4, 1.7, 4.8], zebra=True)

    h2(doc, "The win-rate reframe")
    callout(doc, "Say:",
            f"Win rate looks healthy at {F['win_rate_pct']}% of deals. But by value it "
            f"is {F['win_rate_value_pct']}% — the average won deal is "
            f"{money(w.get('AVG_DEAL', 0))} and the average lost deal is "
            f"{money(l.get('AVG_DEAL', 0))}. The big deals are the ones getting away. "
            f"Neither SAP nor the CRM will tell you that on its own.")

    h2(doc, "Questions that work on the agent")
    M = F["analyst_model"]
    for q in ("What is open pipeline by stage?",
              "Which reps are furthest from quota?",
              "What is our win rate, and how does it differ by value?",
              "Which products appear most often in won opportunities?",
              "Show forecast against actual by month."):
        bullet(doc, q)
    callout(doc, "Scope and phrasing",
            f"The agent (`{F['cortex_agent']['name'].split('.')[-1]}`) has "
            f"{F['cortex_agent'].get('tool_count', 0)} tool — "
            f"`{', '.join(F['cortex_agent'].get('tools') or [])}` — over a semantic "
            f"model covering {len(M.get('tables') or [])} tables and "
            f"{M.get('dimensions')} dimensions. It ships with "
            f"**{M.get('verified_queries')} verified queries**, so phrasing matters: "
            f"there are no curated question patterns to fall back on. Rephrase rather "
            f"than repeat if an answer looks wrong.")

    h1(doc, "What is on each page")
    table(doc, ["Page", "What it shows"],
          [[p, PAGE_PURPOSE.get(p, "")] for p in F["app_pages"]],
          [2.0, 4.9], zebra=True)

    h1(doc, "Discovery questions")
    for q in ("How do you reconcile CRM pipeline against what SAP actually shipped?",
              "When a deal is won, how long before it shows as an order?",
              "Can you see win rate by value, not just by count?",
              "Who can answer a pipeline question without asking an analyst?"):
        bullet(doc, q)

    h1(doc, "Objections, and what to say")
    table(doc, ["Objection", "Response"], [
        ["We already have CRM dashboards.",
         "They stop at the CRM boundary. This joins opportunities to SAP order history."],
        ["Our CRM is not SAP.",
         "Nor is the CRM data here — it is CRM opportunity data joined on the customer key."],
        ["Is this a copy of our data?",
         "At L1, yes — be straight about it. See 05_Architecture_and_Install.docx."],
        ["Can we trust the agent's numbers?",
         "It answers through a defined semantic model. It cannot invent a measure, "
         "though with no verified queries phrasing does affect results."],
        ["The pipeline dates look wrong.",
         "They are past due. Fixed reference dataset, not a live feed. Say so."],
    ], [2.4, 4.5], zebra=True)

    h1(doc, "If it goes wrong")
    bullet(doc, "**App will not load** — the service may be suspended. See "
                "06_Setup_and_Access.docx.")
    bullet(doc, "**Agent answers oddly** — no verified queries exist; rephrase the "
                "question rather than repeating it.")
    bullet(doc, "**A date looks wrong** — it probably is. Orders run to "
                f"{F['data_windows']['SALESORDERS_SALESORDER']['max']}, opportunities to "
                f"{F['data_windows']['CRM_OPPORTUNITY_OPPORTUNITY']['max']}.")
    out = KIT / "03_SE_Quick_Start.docx"
    doc.save(str(out))
    return out


# -------------------------------------------------------------- ARCHITECTURE


def build_architecture(F):
    doc = Document()
    setup_page(doc)
    title_block(doc, "Architecture and Install", "SAP Sales 360",
                f"{DATE} · the stack, and where it differs from the siblings")

    sv, M = F["semantic_view"], F["analyst_model"]
    h1(doc, "The stack")
    table(doc, ["Layer", "What it is", "Objects"], [
        ["L0 — share", "SAP BDC share plus CRM opportunity data.",
         "SAP_BDC_DEMO_* catalog-linked databases"],
        ["L1 — curated", f"**Materialised tables**, not passthrough views. "
         f"{F['l1_rows']:,} rows land here.",
         f"{F['l1_table_count']} tables in SAP_BDC_L1"],
        ["L2 — analytics", "Dynamic tables that shape and join, plus three static ML "
         "outputs.",
         f"{F['l2_table_count']} tables in SALES_360_L2 "
         f"({F['l2_dynamic_count']} dynamic)"],
        ["Semantic", "A semantic view, and a separate stage model the agent reads.",
         f"{sv['tables']} tables / {sv['metrics']} metrics"],
        ["Agent", "A Cortex Agent object with its own versioning.",
         F["cortex_agent"]["name"].split(".")[-1]],
        ["App", "React service on SPCS, inside a native app.",
         f"SALES_360_APP, {F['app_page_count']} pages"],
    ], [1.3, 3.2, 2.4], zebra=True)

    h1(doc, "L1 is a copy — do not claim otherwise")
    body(doc,
         f"This is the sharpest difference from Finance 360, which reads its share "
         f"through passthrough views and genuinely copies nothing. Here L1 is "
         f"**{F['l1_table_count']} plain tables** holding **{F['l1_rows']:,} rows**, "
         f"with {F['l1_dynamic_count']} dynamic tables among them. The data is "
         f"materialised inside Snowflake.")
    callout(doc, "And it is materialised twice",
            f"{len(F['l1_l2_identical_counts'])} L2 tables carry row counts identical "
            f"to their L1 counterparts — **{F['l1_l2_duplicated_rows']:,} rows** held "
            f"in both layers. That is a deliberate trade (L2 adds joins and shaping) "
            f"but it is still two materialisations on top of a share, and a storage "
            f"question deserves an honest answer.")

    h1(doc, "The analytics layer")
    rows = [[o["TABLE_NAME"], f"{(o['ROW_COUNT'] or 0):,}",
             "dynamic" if o["TABLE_NAME"] in F["l2_dynamic"] else "plain"]
            for o in F["l2_objects"]]
    table(doc, ["Table", "Rows", "Refresh"], rows, [3.2, 1.3, 2.4],
          align_right=(1,), zebra=True)
    if F["l2_plain"]:
        callout(doc, "Static by design, stale by consequence",
                ", ".join(f"**{n}**" for n in F["l2_plain"]) +
                " are plain tables holding ML output, so they do not refresh with the "
                "dynamic tables. Anything on the Sales Forecast page sourced from them "
                "is frozen at the time the model last ran.")

    h1(doc, "What reads what")
    body(doc, "As with the Finance kit, worth being exact — the app and the agent do "
              "not read the same object.")
    table(doc, ["Consumer", "Reads", "Evidence"], [
        ["Application (all pages)", f"L2 only — {F['app_reads_l2']} FROM clauses",
         f"{F['app_reads_l1']} on L1, {F['app_reads_share_directly']} on the share"],
        ["Cortex Agent / Analyst", f"stage model, {len(M.get('tables') or [])} tables",
         M["stage_file"].split("/")[-1]],
        ["Semantic view", f"{sv['tables']} tables, {sv['metrics']} metrics",
         "richer than the stage model"],
    ], [2.0, 2.6, 2.3], zebra=True)
    body(doc, f"The semantic view is considerably larger than the model the agent "
              f"reads ({sv['tables']} tables versus {len(M.get('tables') or [])}). "
              f"If a customer asks the agent something the view could answer but the "
              f"stage model cannot, it will fail — that gap is the likeliest cause.",
         italic=True)

    h1(doc, "Build order")
    for i, s in enumerate((
        "Mount the SAP BDC share and confirm the catalog-linked databases exist.",
        f"Create SAP_SALES_360 and load the {F['l1_table_count']} L1 curated tables.",
        "Create the L2 dynamic tables; they backfill on creation.",
        "Load the three ML output tables (static).",
        "Create the semantic view, and upload the stage semantic model.",
        "Create the Cortex Agent over the stage model.",
        "Build and push the service image, then create the native app.",
    ), 1):
        bullet(doc, f"{i}. {s}")

    h1(doc, "Security notes")
    bullet(doc, "L1 is materialised, so normal Snowflake governance applies to it — "
                "this is not read-through-only.")
    bullet(doc, "The app runs as the application role, not the invoking user.")
    bullet(doc, "The agent inherits the privileges of its caller over the stage model.")
    out = KIT / "05_Architecture_and_Install.docx"
    doc.save(str(out))
    return out


# --------------------------------------------------------------- SETUP/ACCESS


def build_setup(F):
    doc = Document()
    setup_page(doc)
    title_block(doc, "Setup and Access", "SAP Sales 360",
                f"{DATE} · how to get in, and how to stand it up")

    h1(doc, "Pick your route")
    table(doc, ["You want", "Route", "Effort"], [
        ["To show it today", "Use the reference deployment below", "none"],
        ["To show it on your own account", "Install the native app", "~30 min"],
        ["To rebuild it from scratch", "Follow 05_Architecture_and_Install.docx", "a day"],
    ], [2.3, 3.2, 1.4], zebra=True)

    h1(doc, "The reference deployment")
    table(doc, ["Region", "Account", "URL"], [
        ["North America", f"{F['account']} · {F['region']}", F["app_url"] or "unavailable"],
    ], [1.5, 2.3, 3.1], zebra=True)
    body(doc, "Only North America was verified in this pass, from "
              "`CALL SALES_360_APP.CORE.APP_URL()`. Other regions are deliberately not "
              "listed rather than assumed.", color=RED)

    h1(doc, "Snowflake objects")
    table(doc, ["Object", "Name"], [
        ["Database", "SAP_SALES_360"],
        ["L1 schema", "SAP_BDC_L1"],
        ["L2 schema", "SALES_360_L2"],
        ["Semantic view", F["semantic_view"]["name"]],
        ["Agent semantic model", F["analyst_model"]["stage_file"]],
        ["Cortex Agent", F["cortex_agent"]["name"]],
        ["Native app", "SALES_360_APP"],
    ], [1.9, 5.0], zebra=True)

    h1(doc, "If the app will not load")
    body(doc, "The service is owned by the application, so ACCOUNTADMIN cannot suspend "
              "or resume it directly. Use the app's own procedures:")
    for c in ("CALL SALES_360_APP.CORE.GET_SERVICE_STATUS();",
              "CALL SALES_360_APP.CORE.SUSPEND_SERVICE();",
              "CALL SALES_360_APP.CORE.RESUME_SERVICE();"):
        bullet(doc, f"`{c}`")
    body(doc, "A suspend/resume recreates the container and re-pulls the image, about "
              "twenty seconds.", italic=True)

    h1(doc, "Data currency")
    w = F["data_windows"]
    table(doc, ["Table", "Column", "From", "To", "Rows"],
          [[k, v["column"], v["min"], v["max"], f"{v['rows']:,}"] for k, v in w.items()],
          [2.3, 1.5, 1.0, 1.0, 1.1], align_right=(4,), zebra=True)
    body(doc, "Note the three windows do not line up — orders span eleven years, "
              "opportunities eighteen months, the forecast three. Do not put an order "
              "trend and an opportunity trend on one axis.", color=RED)
    pipeline_callout(doc, F)

    h1(doc, "Related assets")
    bullet(doc, f"Source and build scripts: {F['repo']}")
    bullet(doc, "Sibling kits: Finance_360_Presales_Kit, Supply_Chain_360_Presales_Kit")
    out = KIT / "06_Setup_and_Access.docx"
    doc.save(str(out))
    return out


def main() -> int:
    F = load_facts()
    KIT.mkdir(parents=True, exist_ok=True)
    built = [build_start_here(F), build_quick_start(F),
             build_architecture(F), build_setup(F)]
    print(f"Sales 360 presales kit -> {KIT}")
    for p in built:
        print(f"  {p.name:34s} {p.stat().st_size / 1024:6.0f} KB")
    print(f"\nfigures verified {F['verified_on']} against account {F['account']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
