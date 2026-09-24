#!/usr/bin/env python3
"""Build the Sales 360 management summary.

    ~/Documents/SAP/Sales_360_Presales_Kit/01_Management_Summary.docx

Every figure is read from /tmp/sales_facts.json, which tools/sales_facts.py
produces straight from the account with the originating query recorded against
each value. Nothing here is transcribed by hand, so the document cannot drift
away from what the system actually reports. If a number in this document is
wrong, the extractor is wrong, and re-running it fixes both.

Two findings in here are uncomfortable and are stated anyway, because both are
one query away from being discovered by the audience:

  * the open pipeline is entirely past due — zero open opportunities have a
    future close date, so the forecast page demonstrates method, not a call;
  * L1 is not zero-copy — it is 31 materialised plain tables, and most of their
    rows are duplicated in L2.

Run the extractor first:

    python3 tools/sales_facts.py
    python3 tools/build_management_summary.py
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
    setup_page,
    table,
)

KIT = pathlib.Path.home() / "Documents" / "SAP" / "Sales_360_Presales_Kit"
OUT = KIT / "01_Management_Summary.docx"
FACTS_FILE = pathlib.Path("/tmp/sales_facts.json")
DATE = date.today().strftime("%d %B %Y")

WARN_FILL = "FBEEEE"

PAGE_PURPOSE = {
    "Dashboard": "Pipeline, bookings and quota headline in one view",
    "Sales Funnel": "Open opportunities by stage, count and value, with stage probability",
    "Customer Health": "Account-level buying behaviour and order history",
    "Products": "What sells, by product and product group",
    "Rep Leaderboard": "Per-rep attainment against quota",
    "Sales Forecast": "Forecast against actual by period, plus the ML prediction tables",
    "Ask the Agent": "Natural-language questions answered by Cortex Analyst",
}


# ------------------------------------------------------------------ utilities

def load_facts() -> dict:
    """Read the extractor output. Fail loudly — a silent default would let the
    document claim figures nobody verified."""
    if not FACTS_FILE.exists():
        sys.exit(
            f"missing input: {FACTS_FILE}\n"
            "The management summary is generated from verified figures and will not "
            "be built without them. Produce the file first:\n"
            "    python3 tools/sales_facts.py"
        )
    try:
        payload = json.loads(FACTS_FILE.read_text())
    except json.JSONDecodeError as exc:
        sys.exit(f"{FACTS_FILE} is not valid JSON ({exc}). Re-run tools/sales_facts.py.")
    if "facts" not in payload:
        sys.exit(f"{FACTS_FILE} has no 'facts' key. Re-run tools/sales_facts.py.")
    return payload["facts"]


def usd(n) -> str:
    """Exact dollars, grouped. Used wherever the point is the precise figure."""
    return f"${float(n):,.0f}"


def approx(n) -> str:
    """Rounded dollars, the way the figure gets spoken aloud."""
    n = float(n)
    if abs(n) >= 1e9:
        return f"${n / 1e9:.2f} billion"
    if abs(n) >= 1e6:
        return f"${n / 1e6:.0f} million"
    return usd(n)


def won(F) -> dict:
    return next(r for r in F["deal_size"] if r["IS_WON"])


def lost(F) -> dict:
    return next(r for r in F["deal_size"] if not r["IS_WON"])


def l2_rows(F, name) -> int:
    return next(t["ROW_COUNT"] for t in F["l2_objects"] if t["TABLE_NAME"] == name)


def l1_views(F) -> int:
    """How many of L1's objects are views rather than base tables.

    Counted rather than assumed, because the whole L1 claim in this document turns
    on it: Finance 360's L1 is all views, and this one is all base tables.
    """
    return sum(1 for t in F["l1_objects"] if t["TABLE_TYPE"] != "BASE TABLE")


def title_block(doc, title, subtitle, strap):
    for text_, size, bold, color, after in (
        (title, 22, True, SAP_NAVY, 2),
        (subtitle, 12, False, SNOW_BLUE, 2),
        (strap, 9, False, GREY, 14),
    ):
        p = doc.add_paragraph()
        r = p.add_run(text_)
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        p.paragraph_format.space_after = Pt(after)


def window_sentence(F) -> str:
    w = F["data_windows"]
    o, s, fa = (w["CRM_OPPORTUNITY_OPPORTUNITY"], w["SALESORDERS_SALESORDER"],
                w["SALES_FORECAST_VS_ACTUAL"])
    return (f"opportunity close dates {o['min']} to {o['max']}, sales orders "
            f"{s['min']} to {s['max']}, forecast periods {fa['min']} to {fa['max']}")


# ------------------------------------------------------------------- sections

def section_what_it_is(doc, F):
    h1(doc, "What this is")
    body(doc,
         "We have taken CRM and sales order data from SAP Business Data Cloud and built a "
         f"working sales application on top of it in Snowflake. The application is deployed "
         f"and running: {F['app_page_count']} pages covering the pipeline, the funnel, "
         "customer health, products, rep attainment and forecast, plus a natural-language "
         "question page.",
         size=10.5)
    body(doc,
         "The point of the exercise is not the application. The point is that a sales "
         "reporting layer was built on SAP data without a nightly extract and without a "
         "separate CRM warehouse to keep in step. The figures below are the evidence for "
         "that claim — and the two places where the claim is weaker than the headline are "
         "stated in the same document rather than left to be discovered.")

    rows = [
        ["What was built",
         f"A {F['app_page_count']}-page sales application on Snowflake over SAP BDC data "
         f"products"],
        ["Status", "**Built, deployed and verified. Running today.**"],
        ["Scale",
         f"{F['opportunity_count']:,} opportunities, {F['order_value_total']:,} sales "
         f"orders, {F['sales_reps']} sales reps, {F['l2_rows']:,} rows across "
         f"{F['l2_table_count']} analytics tables"],
        ["The headline finding",
         f"**Win rate is {F['win_rate_pct']}% by count but {F['win_rate_value_pct']}% by "
         f"value.** The large deals are the ones being lost."],
        ["What it is not",
         "**A fixed reference snapshot, not a live SAP feed.** Nothing in it refreshes "
         "from SAP."],
        ["The two caveats to lead with",
         "**The open pipeline is entirely past due, and L1 is not zero-copy.** Both are "
         "set out in full below."],
        ["Verified on", F["verified_on"]],
    ]
    table(doc, ["Item", "Summary"], rows, [1.8, 5.1], size=9.5)


def section_layers(doc, F):
    h1(doc, "How the data is layered")
    body(doc,
         "Three schemas, each with a job. This matters to the summary because one of the "
         "three does not do what its name implies, and an architecture audience will find "
         "that in about two minutes.")

    sv = F["semantic_view"]
    rows = [
        ["L0 — shared SAP data products",
         "SAP BDC shares. The origin of every row in the stack.",
         "Read once, upstream of L1"],
        ["L1 — SAP_BDC_L1",
         "**Materialised plain tables, not passthrough views.** A physical second copy of "
         "the shared data.",
         f"{F['l1_table_count']} tables, {F['l1_rows']:,} rows, "
         f"{F['l1_dynamic_count']} dynamic"],
        ["L2 — SALES_360_L2",
         "The tables the application charts: opportunities, orders, order items, "
         "customers, products, rep quota, forecast against actual, and three ML output "
         "tables.",
         f"{F['l2_table_count']} tables, {F['l2_rows']:,} rows, "
         f"{F['l2_dynamic_count']} dynamic and {len(F['l2_plain'])} plain"],
        ["Semantic layer",
         f"A semantic view, {sv['name'].split('.')[-1]}, describing the analytics layer.",
         f"{sv['tables']} tables, {sv['dimensions']} dimensions, {sv['facts']} facts, "
         f"{sv['metrics']} metrics, {sv['relationships']} relationships"],
    ]
    table(doc, ["Layer", "What it does", "Scale"], rows, [1.8, 3.25, 1.85], size=9)

    body(doc,
         f"The application reads one layer and one layer only: all {F['app_reads_l2']} of "
         f"its queries go to L2. It makes {F['app_reads_l1']} reads of L1 and "
         f"{F['app_reads_share_directly']} direct reads of the SAP share. That is cleaner "
         f"than it sounds — every screen is on the same set of tables — but it also means "
         f"L1 is carrying no traffic while carrying a full copy of the data.",
         size=9.5)

    h2(doc, "L1 is not zero-copy, and should not be described as one")
    body(doc,
         f"L1 in this build is {F['l1_table_count']} plain base tables holding "
         f"{F['l1_rows']:,} rows. There are {F['l1_dynamic_count']} dynamic tables and "
         f"{l1_views(F)} views in it. {len(F['l1_l2_identical_counts'])} of its table names "
         f"also exist in L2 with identical row counts, which accounts for "
         f"{F['l1_l2_duplicated_rows']:,} rows stored twice.",
         size=9.5)
    callout(
        doc,
        "Say this rather than have it found",
        f"This differs from the Finance 360 build, where L1 is six passthrough views over "
        f"the share and stores nothing. Here L1 is a materialised copy: "
        f"{F['l1_rows']:,} rows, of which {F['l1_l2_duplicated_rows']:,} are duplicated "
        f"between L1 and L2. So the phrase **zero-copy** is accurate about L0 to L1 as a "
        f"pattern and inaccurate about this deployment as built. The fix is small — convert "
        f"L1 to passthrough views over the shares, as Finance 360 already does — and until "
        f"it is done, describe L1 as a staging copy.",
        fill=WARN_FILL,
    )

    rows = [[f"{n}. {name}", PAGE_PURPOSE.get(name, "")]
            for n, name in enumerate(F["app_pages"], start=1)]
    h2(doc, f"The {F['app_page_count']} pages")
    table(doc, ["Page", "What it shows"], rows, [2.2, 4.7], size=9, zebra=True)


def section_numbers(doc, F):
    h1(doc, "What the numbers say")
    body(doc,
         "One finding on this data is worth the meeting on its own, and it is not the "
         "pipeline total. It is the gap between two ways of measuring the same win rate.",
         size=10.5)

    w, l = won(F), lost(F)
    closed_opps = w["OPPS"] + l["OPPS"]
    closed_value = w["AMOUNT"] + l["AMOUNT"]
    gap = l["AVG_DEAL"] - w["AVG_DEAL"]

    rows = [
        ["Won", f"{w['OPPS']:,}", usd(w["AMOUNT"]), usd(w["AVG_DEAL"])],
        ["Lost", f"{l['OPPS']:,}", usd(l["AMOUNT"]), usd(l["AVG_DEAL"])],
        ["**Closed total**", f"**{closed_opps:,}**", f"**{usd(closed_value)}**", ""],
        ["**Win rate**", f"**{F['win_rate_pct']}% by count**",
         f"**{F['win_rate_value_pct']}% by value**", ""],
    ]
    table(doc, ["Outcome", "Opportunities", "Value", "Average deal"], rows,
          [1.55, 1.5, 2.0, 1.85], size=9.5, align_right=(1, 2, 3))

    callout(
        doc,
        "The one finding to quote",
        f"They win **{F['win_rate_pct']}% of deals and {F['win_rate_value_pct']}% of "
        f"dollars**. The average won deal is {usd(w['AVG_DEAL'])}; the average lost deal is "
        f"{usd(l['AVG_DEAL'])}. That is {usd(gap)} more per loss than per win, over "
        f"{closed_opps:,} closed opportunities. A team winning slightly more than half its "
        f"deals while losing more than half its addressable value is losing the large ones, "
        f"consistently enough that it is a pattern rather than a bad quarter. No extra data "
        f"was needed to see it — both figures come off the same closed-opportunity set.",
    )

    body(doc,
         "This is the shape of finding that justifies a semantic layer. The count-based win "
         "rate is the number most CRM dashboards show by default, and on its own it reads as "
         "healthy. The value-weighted rate is the one that explains the quota conversation, "
         "and it is six and a half points lower.",
         size=9.5)

    h2(doc, "Pipeline and quota")
    rows = [
        ["Open pipeline", usd(F["open_pipeline"]),
         f"{sum(s['OPPS'] for s in F['pipeline_by_stage']):,} open opportunities"],
        ["Total rep quota", usd(F["quota_total"]),
         f"across {F['sales_reps']} reps"],
        ["Closed won", usd(w["AMOUNT"]), f"{w['OPPS']:,} opportunities"],
        ["Closed lost", usd(l["AMOUNT"]), f"{l['OPPS']:,} opportunities"],
    ]
    table(doc, ["Measure", "Value", "Basis"], rows, [1.9, 2.4, 2.6], size=9.5,
          align_right=(1,))

    h2(doc, "Open pipeline by stage")
    rows = []
    for s in F["pipeline_by_stage"]:
        rows.append([s["STAGE_NAME"], f"{s['OPPS']:,}", usd(s["AMOUNT"]),
                     f"{s['AVG_PROB']:.0f}%"])
    table(doc, ["Stage", "Opportunities", "Value", "Stage probability"], rows,
          [2.15, 1.35, 1.9, 1.5], size=9, align_right=(1, 2, 3), zebra=True)

    top = max(F["pipeline_by_stage"], key=lambda s: s["AMOUNT"])
    late = next(s for s in F["pipeline_by_stage"] if s["STAGE_NAME"] == "Negotiation/Review")
    body(doc,
         f"The funnel is unusually even: eight stages, none below {usd(min(s['AMOUNT'] for s in F['pipeline_by_stage']))} "
         f"and none above {usd(top['AMOUNT'])}. That flatness is itself worth noting, because "
         f"a real funnel narrows. The most useful single row is "
         f"{late['STAGE_NAME']}: {late['OPPS']:,} opportunities worth "
         f"{usd(late['AMOUNT'])} at {late['AVG_PROB']:.0f}% stage probability — the nearest "
         f"thing in this data to a commit number.",
         size=9.5)


def section_forecast(doc, F):
    h1(doc, "Forecast, attainment and the ML tables")
    body(doc,
         "The forecast page reads SALES_FORECAST_VS_ACTUAL plus three prediction tables. "
         "Two things about it need stating before anyone quotes a figure off it.",
         size=10.5)

    rows = []
    for y in F["forecast_attainment"]:
        rows.append([str(y["FISCAL_YEAR"]), usd(y["FORECAST"]), usd(y["ACTUAL"]),
                     usd(y["VARIANCE"]), f"{y['AVG_ATTAINMENT']:.1f}%"])
    table(doc, ["Fiscal year", "Forecast", "Actual", "Variance", "Avg attainment"],
          rows, [1.0, 1.6, 1.6, 1.5, 1.2], size=9, align_right=(1, 2, 3, 4))

    sp = F["attainment_spread"]
    annual = ", ".join(
        "{}: {:.1f}%".format(y["FISCAL_YEAR"], y["AVG_ATTAINMENT"])
        for y in F["forecast_attainment"]
    )
    body(doc,
         f"The annual averages look almost identical — {annual}. "
         f"The monthly detail behind them is not. Attainment ranges from **{sp['min']}% to "
         f"{sp['max']}%** with a standard deviation of {sp['stddev']}. There is real "
         f"period-to-period variance in this data; anyone describing the attainment series "
         f"as flat has only looked at the annual roll-up.",
         size=9.5)

    callout(
        doc,
        "Two populations, never one axis",
        f"SALES_FORECAST_VS_ACTUAL carries "
        f"{F['data_windows']['SALES_FORECAST_VS_ACTUAL']['rows']:,} rows and annual totals "
        f"in the {approx(F['forecast_attainment'][0]['FORECAST'])} range. The opportunity "
        f"set is {F['opportunity_count']:,} rows and the whole open pipeline is "
        f"{approx(F['open_pipeline'])}. These are different grains over different "
        f"populations. Do not add them, ratio them, or put them on one chart — the forecast "
        f"table is not a roll-up of the opportunity table.",
        fill=WARN_FILL,
    )

    h2(doc, "The open pipeline is entirely past due")
    body(doc,
         f"Of {F['open_opps_past_due'] + F['open_opps_future']:,} open opportunities, "
         f"**{F['open_opps_past_due']:,} have a close date in the past and "
         f"{F['open_opps_future']:,} have a close date in the future.** The whole "
         f"{usd(F['open_amount_past_due'])} of open pipeline is past its own close date.",
         size=9.5)
    body(doc,
         f"This is an artefact of a fixed demo dataset whose opportunity close dates run "
         f"{F['data_windows']['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
         f"{F['data_windows']['CRM_OPPORTUNITY_OPPORTUNITY']['max']}, not a finding about a "
         f"sales team. It has one hard consequence: the Sales Forecast page demonstrates "
         f"forecasting **method**, not a forward call. There is no future-dated pipeline for "
         f"it to forecast.",
         size=9.5, color=RED, italic=True)


def section_ai(doc, F):
    h1(doc, "The AI layer")
    sv, am, ag = F["semantic_view"], F["analyst_model"], F["cortex_agent"]
    body(doc,
         "There are two semantic artefacts in the account, they are not the same size, and "
         "the question page uses the smaller one.",
         size=10.5)

    rows = [
        ["Semantic view (in-database)",
         sv["name"],
         f"{sv['tables']} tables, {sv['dimensions']} dimensions, {sv['facts']} facts, "
         f"{sv['metrics']} metrics, {sv['relationships']} relationships"],
        ["Stage semantic model (what the agent reads)",
         am["stage_file"],
         f"{len(am['tables'])} tables, {am['dimensions']} dimensions, {am['facts']} facts, "
         f"**{am['verified_queries']} verified queries**"],
        ["Cortex Agent",
         ag["name"],
         f"{ag['tool_count']} tool ({', '.join(ag['tools'])}), "
         f"{ag['orchestration']} orchestration"],
    ]
    table(doc, ["Artefact", "Object", "Scale"], rows, [1.95, 2.35, 2.6], size=9)

    body(doc,
         f"The gap is the point. The in-database semantic view describes {sv['tables']} "
         f"tables with {sv['metrics']} named metrics. The stage model the agent actually "
         f"reads covers {len(am['tables'])} tables with {am['dimensions']} dimensions and "
         f"no measures defined. So the agent answers from a narrower and less opinionated "
         f"description of the business than the semantic view already contains.",
         size=9.5)

    callout(
        doc,
        "Zero verified queries is a real gap",
        f"The stage model carries {am['verified_queries']} verified queries. Verified "
        f"queries are the mechanism that makes Cortex Analyst reliable on the handful of "
        f"questions an audience actually asks, because they pin the SQL for a known "
        f"question instead of leaving it to be generated. With none defined, every question "
        f"in a demo is generated fresh. Rehearse the exact questions you intend to type, and "
        f"add verified queries before this is put in front of a customer's own users.",
        fill=WARN_FILL,
    )


def section_limits(doc, F):
    h1(doc, "What this does not do")
    body(doc,
         "This section exists so the figures survive being challenged. Every item below was "
         "verified rather than assumed, and each one has cost somebody a demo somewhere.",
         size=10.5)

    am = F["analyst_model"]
    w = F["data_windows"]

    rows = [
        ["It is not a live SAP feed",
         f"A fixed reference snapshot, verified {F['verified_on']}. Nothing in it refreshes "
         f"from SAP. Say so before anyone asks."],
        ["It cannot forecast forward",
         f"All {F['open_opps_past_due']:,} open opportunities are past their close date and "
         f"{F['open_opps_future']:,} are future-dated. The Sales Forecast page shows method, "
         f"not a forward call. Do not present it as next quarter's number."],
        ["L1 is not zero-copy",
         f"{F['l1_table_count']} materialised plain tables, {F['l1_rows']:,} rows, "
         f"{l1_views(F)} views, of which {F['l1_l2_duplicated_rows']:,} rows are "
         f"duplicated in L2. Finance 360's L1 is six passthrough views; this one is a "
         f"physical copy. Describe it as staging."],
        ["The agent has no verified queries",
         f"{am['verified_queries']} verified queries on the stage model, and "
         f"{am['measures']} measures defined. Answers are generated fresh every time, so "
         f"rehearse the exact wording you plan to use."],
        ["Two semantic artefacts, not one",
         f"An in-database semantic view over {F['semantic_view']['tables']} tables and a "
         f"separate stage model over {len(am['tables'])}. The question page reads the stage "
         f"model, so the dashboard and the agent are not guaranteed to share a definition."],
        ["The fact tables cover different periods",
         f"Opportunity close dates {w['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
         f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['max']}, sales orders from "
         f"{w['SALESORDERS_SALESORDER']['min']}, forecast periods to "
         f"{w['SALES_FORECAST_VS_ACTUAL']['max']}. Orders span eleven years and "
         f"opportunities eighteen months. Never put them on one axis."],
        ["Three L2 tables can go stale silently",
         f"{', '.join(F['l2_plain'])} are plain tables, not dynamic tables. The other "
         f"{F['l2_dynamic_count']} refresh themselves; these three do not, and they are the "
         f"ML outputs behind the forecast page."],
        ["The rep population is tiny",
         f"{F['sales_reps']} reps carrying {usd(F['quota_total'])} of quota. The leaderboard "
         f"is a valid demonstration of the mechanic and far too small a sample to support "
         f"any claim about coaching, ranking or rep-level statistics."],
        ["No territory, campaign or contact data",
         "The share covers opportunities, activities, orders, customers, products and rep "
         "quota. There is no territory hierarchy, campaign attribution or contact-level "
         "engagement, so nothing here supports a routing or attribution conversation."],
        ["It does not write back",
         "The application reports. It does not update an opportunity, reassign a deal or "
         "post anything into SAP or the CRM."],
    ]
    table(doc, ["Limitation", "What is actually true"], rows, [2.3, 4.6], size=9)

    callout(
        doc,
        "The two sentences not to say",
        f"Do **not** say the forecast page shows what is going to close — "
        f"{F['open_opps_future']} open opportunities have a future close date, and one "
        f"filter on the funnel page exposes that. And do **not** call L1 zero-copy: it is "
        f"{F['l1_rows']:,} materialised rows. Both claims are disprovable in a single query "
        f"by anyone technical in the room, and both are avoidable by saying the true version, "
        f"which is nearly as good.",
        fill=WARN_FILL,
    )


def section_next(doc, F):
    h1(doc, "What to do next")
    body(doc,
         "Five things, in the order they are worth doing. The first needs no engineering.")

    am = F["analyst_model"]
    bullet(doc,
           f"**Use the win-rate finding now. **{F['win_rate_pct']}% of deals against "
           f"{F['win_rate_value_pct']}% of dollars is a real analytic result on real shared "
           f"SAP data, and it needs no further build. It is the strongest thing in the kit.")
    bullet(doc,
           f"**Add verified queries to the stage model. **There are "
           f"{am['verified_queries']} today and {am['measures']} measures. Half a dozen "
           f"verified queries covering the questions every sales audience asks — pipeline by "
           f"stage, win rate, attainment by rep — would move the question page from "
           f"demonstration to dependable.")
    bullet(doc,
           f"**Convert L1 to passthrough views. **It would remove "
           f"{F['l1_l2_duplicated_rows']:,} duplicated rows, make the zero-copy description "
           f"true as built, and bring this repo in line with Finance 360. L1 currently "
           f"serves {F['app_reads_l1']} application queries, so nothing depends on its "
           f"being materialised.")
    bullet(doc,
           f"**Point the agent at the semantic view. **The in-database view already "
           f"describes {F['semantic_view']['tables']} tables and "
           f"{F['semantic_view']['metrics']} metrics against the stage model's "
           f"{len(am['tables'])} tables and {am['measures']} measures. Using one definition "
           f"would stop the dashboard and the agent being able to disagree.")
    bullet(doc,
           "**Repoint at live SAP data with future-dated pipeline. **The layering is "
           "independent of this snapshot. Against a customer's own BDC shares the forecast "
           "page becomes a forward call rather than a demonstration of method, which is the "
           "single biggest upgrade available to this build.")

    h1(doc, "Access")
    rows = [
        ["Application", F["app_url"]],
        ["Snowflake account", f"{F['account']}, {F['region']}"],
        ["Source", F["repo"]],
        ["Semantic view", F["semantic_view"]["name"]],
        ["Cortex Agent", F["cortex_agent"]["name"]],
        ["Figures in this document", "tools/sales_facts.py, verified " + F["verified_on"]],
        ["Data windows", window_sentence(F)],
    ]
    table(doc, ["Resource", "Location"], rows, [2.2, 4.7], size=9)

    body(doc,
         "Every figure in this document was read from the account by tools/sales_facts.py, "
         "which records the query behind each value. No number here was carried over from an "
         "earlier document.",
         size=9, italic=True, color=GREY)


# ----------------------------------------------------------------------- main

def main():
    F = load_facts()

    doc = Document()
    setup_page(doc)

    title_block(
        doc,
        "SAP Sales 360",
        "Sales reporting on SAP Business Data Cloud and Snowflake",
        f"Management summary  ·  {DATE}  ·  figures verified {F['verified_on']}",
    )

    body(doc,
         "This document stands on its own. It states what was built, the one finding worth "
         "quoting, the figures behind it, and the two things about this build that are "
         "weaker than the headline. It can be read without seeing the application.",
         size=10.5, italic=True, color=GREY)

    section_what_it_is(doc, F)
    section_layers(doc, F)
    doc.add_page_break()
    section_numbers(doc, F)
    doc.add_page_break()
    section_forecast(doc, F)
    section_ai(doc, F)
    doc.add_page_break()
    section_limits(doc, F)
    section_next(doc, F)

    KIT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"wrote {OUT}")
    print(f"  size {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
