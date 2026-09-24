#!/usr/bin/env python3
"""Build the Sales 360 per-persona demo scripts.

    ~/Documents/SAP/Sales_360_Presales_Kit/02_Demo_Scripts_by_Persona.docx

Six self-contained scripts, one per persona, each a page or two, so a single
script can be handed to whoever is presenting to that audience.

They are deliberately NOT one template with the role name swapped. Each persona
opens on a different one of the application's seven pages, drives different
figures and closes on a different point, because that is the only way the demo
lands as being about the listener's own job. A sales audience notices a generic
walkthrough faster than most, having sat through several.

Two facts about this dataset constrain every script and are repeated wherever
they bite rather than stated once on the cover:

  * the open pipeline is entirely past due, so nothing here is a forward call;
  * L1 is a materialised copy, not passthrough views, so "zero-copy" needs
    qualifying in front of anyone technical.

Every figure comes from /tmp/sales_facts.json, produced by tools/sales_facts.py
from the account. Spoken figures are rounded, because nobody says "one billion
nine hundred and three million" out loud; the exact value stays in the reference
tables.

Run the extractor first:

    python3 tools/sales_facts.py
    python3 tools/build_demo_scripts.py
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
OUT = KIT / "02_Demo_Scripts_by_Persona.docx"
FACTS_FILE = pathlib.Path("/tmp/sales_facts.json")
DATE = date.today().strftime("%d %B %Y")

WARN_FILL = "FBEEEE"
SAY_FILL = "EEF4F8"


# ------------------------------------------------------------------ utilities

def load_facts() -> dict:
    if not FACTS_FILE.exists():
        sys.exit(
            f"missing input: {FACTS_FILE}\n"
            "The demo scripts quote verified figures and will not be built without "
            "them. Produce the file first:\n"
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
    return f"${float(n):,.0f}"


def spoken(n) -> str:
    """The figure as a presenter says it."""
    n = float(n)
    if abs(n) >= 1e9:
        return f"${n / 1e9:.2f} billion"
    if abs(n) >= 1e6:
        return f"${n / 1e6:.0f} million"
    if abs(n) >= 1e3:
        return f"${n / 1e3:.0f} thousand"
    return usd(n)


def won(F) -> dict:
    return next(r for r in F["deal_size"] if r["IS_WON"])


def lost(F) -> dict:
    return next(r for r in F["deal_size"] if not r["IS_WON"])


def stage(F, name) -> dict:
    return next(s for s in F["pipeline_by_stage"] if s["STAGE_NAME"] == name)


def l2_rows(F, name) -> int:
    return next(t["ROW_COUNT"] for t in F["l2_objects"] if t["TABLE_NAME"] == name)


def open_opps(F) -> int:
    return F["open_opps_past_due"] + F["open_opps_future"]


# ---------------------------------------------------------- script scaffolding

def persona_header(doc, n, role, minutes, audience, question, opens_on):
    h1(doc, f"Script {n} · {role}", size=17, before=0, after=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run(f"{minutes} minutes   ·   Audience: {audience}   ·   Opens on: {opens_on}")
    r.font.size = Pt(9.5)
    r.font.color.rgb = GREY
    callout(doc, "The question they walk in with:", question, fill=SAY_FILL, size=10)


def who(doc, text):
    h2(doc, "Who they are, and what they care about")
    body(doc, text, size=9.5)


def open_on(doc, page, why):
    h2(doc, f"Open on: {page}")
    body(doc, why, size=9.5)


def say(doc, lines):
    """The say-this beats. Presenter reads down the right-hand column."""
    h2(doc, "Say this")
    table(doc, ["#", "Point", "Say it like this"],
          [[str(i), pt, line] for i, (pt, line) in enumerate(lines, start=1)],
          [0.3, 1.7, 4.9], size=8.5, zebra=True)


def ask(doc, question, why):
    h2(doc, "Ask them this")
    callout(doc, "Ask:", f"**{question}**  {why}", fill=SAY_FILL, size=9.5)


def close(doc, line):
    h2(doc, "Close on")
    body(doc, line, size=10.5, italic=True, color=SAP_NAVY)


def avoid(doc, items):
    h2(doc, "What not to show them, and what not to claim")
    for item in items:
        bullet(doc, item, size=9.5)


def red_flag(doc, label, text):
    """The callout that exists to stop a specific false claim being made."""
    callout(doc, label, text, fill=WARN_FILL, size=9.5)


# ------------------------------------------------------------------ the cover

def cover(doc, F):
    for text_, size, bold, color, after in (
        ("SAP Sales 360", 22, True, SAP_NAVY, 2),
        ("Demo scripts by persona", 12, False, SNOW_BLUE, 2),
        (f"{DATE}  ·  figures verified {F['verified_on']}  ·  {F['app_url']}",
         9, False, GREY, 14),
    ):
        p = doc.add_paragraph()
        r = p.add_run(text_)
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        p.paragraph_format.space_after = Pt(after)

    body(doc,
         f"Six scripts, each written for one audience. They are not variants of one "
         f"walkthrough. Every script opens on a different one of the application's "
         f"{F['app_page_count']} pages, drives different figures and closes on a different "
         f"point, because a demo only lands when it is visibly about the listener's own job.",
         size=10.5)
    body(doc,
         "Pick the one script that matches the room. Scripts 1 and 2 pair well back to "
         "back. Script 6 should not follow script 1 in the same session, for a reason set "
         "out in both.")

    table(doc, ["#", "Persona", "Opens on", "Closes on", "Mins"], [
        ["1", "**CRO / VP Sales**", "Dashboard",
         "they win half the deals and well under half the dollars", "6"],
        ["2", "Sales Ops / Deal Desk", "Sales Funnel",
         "the funnel is evidence, and its date integrity is the first thing to fix", "8"],
        ["3", "Customer Success Lead", "Customer Health",
         "order history is the retention signal already sitting in SAP", "7"],
        ["4", "Product / Portfolio Manager", "Products",
         "product mix is visible at line-item grain without an extract", "7"],
        ["5", "First-line Sales Manager", "Rep Leaderboard",
         "the mechanic is right and the sample is too small to rank anybody", "6"],
        ["6", "IT / Data Platform Owner", "Ask the Agent",
         "what still needs building, stated before they find it", "9"],
    ], [0.3, 1.75, 1.45, 2.8, 0.55], size=9)

    h2(doc, "Before any demo, whoever the audience is")
    w = F["data_windows"]
    bullet(doc,
           f"Open the application at **{F['app_url']}** and confirm the Dashboard loads "
           f"before the room does.", size=9.5)
    bullet(doc,
           f"Say once, early, that this is a fixed reference snapshot rather than a live "
           f"SAP feed, verified **{F['verified_on']}**. Volunteering it costs nothing. Being "
           f"caught on it costs the meeting.", size=9.5)
    bullet(doc,
           f"Know the windows. Opportunity close dates run "
           f"**{w['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
           f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['max']}**, sales orders "
           f"**{w['SALESORDERS_SALESORDER']['min']} to "
           f"{w['SALESORDERS_SALESORDER']['max']}**, forecast periods "
           f"**{w['SALES_FORECAST_VS_ACTUAL']['min']} to "
           f"{w['SALES_FORECAST_VS_ACTUAL']['max']}**. Orders span eleven years and "
           f"opportunities eighteen months. Never put them on one axis.", size=9.5)
    bullet(doc,
           f"Know the one finding worth the meeting: **{F['win_rate_pct']}% win rate by "
           f"count, {F['win_rate_value_pct']}% by value**. Average won deal "
           f"{usd(won(F)['AVG_DEAL'])}, average lost deal {usd(lost(F)['AVG_DEAL'])}. Every "
           f"script can fall back to this.", size=9.5)
    bullet(doc,
           f"The forecast table is a different population from the opportunity table. "
           f"SALES_FORECAST_VS_ACTUAL carries "
           f"{w['SALES_FORECAST_VS_ACTUAL']['rows']:,} rows with annual totals in the "
           f"billions; the opportunity set is {F['opportunity_count']:,} rows. Do not add "
           f"them or ratio them.", size=9.5)

    red_flag(
        doc,
        "The two things never to claim, in any script",
        f"**One. The pipeline is not forward-looking.** All {F['open_opps_past_due']:,} open "
        f"opportunities have a close date in the past and {F['open_opps_future']:,} have a "
        f"future one. The entire {usd(F['open_pipeline'])} of open pipeline is past due. So "
        f"never say \u201cthis is what's going to close\u201d — one sort on the funnel page "
        f"disproves it.  "
        f"**Two. L1 is not zero-copy.** It is {F['l1_table_count']} materialised plain "
        f"tables holding {F['l1_rows']:,} rows, of which "
        f"{F['l1_l2_duplicated_rows']:,} are duplicated in L2. The zero-copy pattern is real "
        f"from the SAP share into the account; this deployment then makes a physical staging "
        f"copy. Say \u201cstaging layer\u201d and you are safe.",
    )

    am = F["analyst_model"]
    red_flag(
        doc,
        "The agent's coverage, before you promise anything",
        f"The Cortex Agent ({F['cortex_agent']['name'].split('.')[-1]}) has "
        f"{F['cortex_agent']['tool_count']} tool, {', '.join(F['cortex_agent']['tools'])}, on "
        f"{F['cortex_agent']['orchestration']} orchestration. It reads a stage model "
        f"covering {len(am['tables'])} tables and {am['dimensions']} dimensions with "
        f"{am['measures']} measures and **{am['verified_queries']} verified queries**. The "
        f"richer in-database semantic view — {F['semantic_view']['tables']} tables, "
        f"{F['semantic_view']['metrics']} metrics — is **not** what the agent reads. With no "
        f"verified queries, every answer is generated fresh. Rehearse the exact wording of "
        f"every question you intend to type, and do not improvise one in the room.",
    )


# -------------------------------------------------------------------- script 1

def script_cro(doc, F):
    persona_header(
        doc, 1, "CRO / VP Sales", 6, "CRO, VP Sales, sales leadership",
        "Is my pipeline telling me the truth about what I'm going to close?",
        "Dashboard")

    who(doc,
        "A CRO is not buying a dashboard. They have several, and they distrust all of them "
        "by about the same amount. What they do not have is a number that explains why "
        "attainment keeps missing while the pipeline looks healthy. Their instinct on seeing "
        "a pipeline total is to discount it, because they have been shown inflated pipeline "
        "before. So do not lead with the total. Lead with the finding that explains their "
        "quarter, and let them discount the total on their own time.")

    open_on(doc, "Dashboard",
            "Because it carries the pipeline, bookings and quota headline in one view, which "
            "is the frame they already think in. Opening on the funnel looks like process; "
            "opening here looks like their P&L.")

    w, l = won(F), lost(F)
    gap = l["AVG_DEAL"] - w["AVG_DEAL"]
    closed = w["OPPS"] + l["OPPS"]

    say(doc, [
        ("Establish the scale, briefly",
         f"\u201c{F['opportunity_count']:,} opportunities, {F['sales_reps']} reps carrying "
         f"{spoken(F['quota_total'])} of quota, and {spoken(F['open_pipeline'])} of open "
         f"pipeline. That's the set. I'm going to spend the rest of the time on one number "
         f"in it.\u201d"),
        ("Give them the win rate they expect",
         f"\u201cOf the {closed:,} deals that closed, they won {w['OPPS']:,} and lost "
         f"{l['OPPS']:,}. That's a {F['win_rate_pct']}% win rate. On most dashboards that is "
         f"where the story stops, and it reads fine.\u201d"),
        ("Then give them the one that matters",
         f"\u201cNow weight it by dollars. {spoken(w['AMOUNT'])} won against "
         f"{spoken(l['AMOUNT'])} lost. That's a {F['win_rate_value_pct']}% win rate by "
         f"value. They win half the deals and well under half the money.\u201d"),
        ("Land why",
         f"\u201cAverage won deal, {usd(w['AVG_DEAL'])}. Average lost deal, "
         f"{usd(l['AVG_DEAL'])}. That's {usd(gap)} more on every loss than every win. "
         f"They aren't losing randomly. They're losing the big ones.\u201d"),
        ("Make it their problem, not the data's",
         "\u201cThat gap is the difference between a coverage conversation and a "
         "deal-qualification conversation. If you only ever see the count-based win rate, "
         "you run the wrong one.\u201d"),
        ("Say the snapshot line before they ask",
         f"\u201cOne caveat I'd rather give you than have you find. This is a fixed "
         f"reference dataset, and every open deal in it is already past its close date. So "
         f"treat the {spoken(F['open_pipeline'])} as a worked example, not a forecast. The "
         f"win-rate finding is unaffected — it's computed on closed deals.\u201d"),
    ])

    ask(doc, "When your team reports win rate to you, is it by deal count or by value?",
        "Almost always by count. The moment they say so, the six-and-a-half-point gap you "
        "just showed becomes their number rather than your demo, and they will go and check "
        "it on their own data.")

    close(doc,
          f"\u201c{F['win_rate_pct']}% of deals, {F['win_rate_value_pct']}% of dollars, and "
          f"{usd(gap)} more on the average loss than the average win. That came off SAP data "
          f"that was never extracted anywhere. If that gap is real in your numbers too, it's "
          f"the most expensive thing on this screen.\u201d")

    red_flag(
        doc,
        "What not to claim to a CRO",
        f"Do not say the {usd(F['open_pipeline'])} is what is going to close, or call it "
        f"\u201ccurrent pipeline\u201d without qualification. Every one of those "
        f"{F['open_opps_past_due']:,} deals is past due and {F['open_opps_future']:,} are "
        f"future-dated. A CRO who later discovers that discounts everything else you said, "
        f"including the win-rate finding, which deserves better.",
    )

    avoid(doc, [
        "**The Sales Forecast page. **It is the page a CRO will ask for and the one that "
        "cannot survive the question \u201cso what closes next quarter\u201d. Send script 6's "
        "audience there instead.",
        f"**The Rep Leaderboard. **{F['sales_reps']} reps is too small a sample to rank, and "
        f"a CRO will read names off it and ask about individuals you know nothing about.",
        "**Ask the Agent. **No verified queries, and a CRO improvises questions. The first "
        "generated answer they cannot verify undoes the meeting.",
        "**Anything about layers, dynamic tables or the semantic view. **Not their question. "
        "If they ask how it works, answer in one sentence and get back to the gap.",
    ])


# -------------------------------------------------------------------- script 2

def script_ops(doc, F):
    persona_header(
        doc, 2, "Sales Ops / Deal Desk", 8,
        "Sales operations, deal desk, revenue operations",
        "Can I see stage-by-stage movement without waiting on a data team?",
        "Sales Funnel")

    who(doc,
        "Sales ops owns the hygiene nobody thanks them for: stage definitions, close-date "
        "discipline, probability weighting, and the weekly argument about whether a deal "
        "should have been pushed. They are the most data-literate person in the sales "
        "organisation and the most likely to spot a broken field. They will find the "
        "close-date problem in this dataset without your help, so give it to them first and "
        "spend the credibility.")

    open_on(doc, "Sales Funnel",
            "Because stage-by-stage is the instrument they actually work in, and because it "
            "is the page where the date integrity issue is visible. Showing them the "
            "Dashboard first would look like you were steering around it.")

    st = F["pipeline_by_stage"]
    neg = stage(F, "Negotiation/Review")
    pro = stage(F, "Prospecting")
    biggest = max(st, key=lambda s: s["AMOUNT"])
    smallest = min(st, key=lambda s: s["AMOUNT"])

    say(doc, [
        ("Start with the grain, not the total",
         f"\u201cEight stages, {open_opps(F):,} open opportunities, "
         f"{spoken(F['open_pipeline'])}. Stage name, count, value and stage probability, all "
         f"at opportunity grain. This is not a summarised extract — it's the opportunity "
         f"table.\u201d"),
        ("Show the probability spine",
         f"\u201cProbability runs with stage: {pro['STAGE_NAME']} at "
         f"{pro['AVG_PROB']:.0f}%, {neg['STAGE_NAME']} at {neg['AVG_PROB']:.0f}%. So you can "
         f"weight the pipeline properly rather than taking the raw number.\u201d"),
        ("Give them the honest shape",
         f"\u201cNotice what this funnel doesn't do. It doesn't narrow. "
         f"{biggest['STAGE_NAME']} is the largest at {spoken(biggest['AMOUNT'])} and "
         f"{smallest['STAGE_NAME']} the smallest at {spoken(smallest['AMOUNT'])} — every "
         f"stage sits within about a third of every other. A real funnel narrows. That "
         f"flatness is a property of this dataset, and you'd spot it in thirty "
         f"seconds.\u201d"),
        ("Hand them the date problem yourself",
         f"\u201cSecond thing you'd find. Sort by close date. Every one of these "
         f"{F['open_opps_past_due']:,} open deals is already past its close date. "
         f"{F['open_opps_future']:,} are future-dated. In your world that's a hygiene alarm; "
         f"here it's an artefact of a fixed dataset. I'd rather say it than have you find "
         f"it.\u201d"),
        ("Turn the artefact into their use case",
         f"\u201cBut hold on to that. \u2018Every open deal is past its close date\u2019 is "
         f"exactly the query you'd want running weekly against real data. On this data it's "
         f"a demo artefact. On yours it's a push-rate report and a stalled-deal "
         f"worklist.\u201d"),
        ("Close on the finding they can action",
         f"\u201cAnd the reason to care about stage discipline: win rate is "
         f"{F['win_rate_pct']}% by count and {F['win_rate_value_pct']}% by value. The large "
         f"deals are the ones being lost. Whatever qualification rule catches that is worth "
         f"more than anything else in your stage model.\u201d"),
    ])

    ask(doc, "How much of your week goes on close-date and stage hygiene rather than "
             "analysis?",
        "Sales ops always has a number and it is always too high. It converts the "
        "past-due-pipeline artefact from an apology into the thing they would build first.")

    close(doc,
          f"\u201cThe funnel is at opportunity grain, straight off SAP data, with no extract "
          f"in between. The first report you'd build on it is the one that catches "
          f"{F['open_opps_past_due']:,} deals sitting past their close date — which on this "
          f"dataset is an artefact, and on yours is a Monday morning.\u201d")

    red_flag(
        doc,
        "What not to claim to sales ops",
        f"Do not present the stage probabilities as a weighted forecast. With "
        f"{F['open_opps_future']:,} future-dated opportunities there is no period to weight "
        f"into, so a probability-weighted total here is arithmetic without meaning. And do "
        f"not call the flat stage distribution a finding about the business — it is a "
        f"property of generated data, and sales ops is the persona most likely to know the "
        f"difference.",
    )

    avoid(doc, [
        "**The Sales Forecast page. **They will immediately try to reconcile it to the "
        "funnel, and it cannot be reconciled: different table, different grain, annual "
        "totals in the billions against a funnel in the low billions.",
        "**Ask the Agent, for anything numeric. **Sales ops will check the generated SQL "
        "against the funnel figure, and with no verified queries there is no guarantee they "
        "match.",
        f"**Customer Health and Products. **Both are interesting and neither is their job. "
        f"They dilute the eight minutes.",
    ])


# -------------------------------------------------------------------- script 3

def script_cs(doc, F):
    persona_header(
        doc, 3, "Customer Success Lead", 7,
        "Customer success, account management, renewals",
        "Which of my accounts is quietly disengaging?",
        "Customer Health")

    who(doc,
        "Customer success is judged on renewal and expansion, and their standing problem is "
        "that the earliest signal of a customer going quiet lives in order behaviour rather "
        "than in anything a CS tool records. They usually cannot see order history without "
        "asking someone. They are also the persona least interested in architecture and most "
        "interested in whether a list of at-risk accounts can come out of this by Friday.")

    open_on(doc, "Customer Health",
            "Because account-level buying behaviour is the whole job, and this page is the "
            "only one that joins the customer record to eleven years of order history. "
            "Opening on the Dashboard would show them a sales number they are not measured "
            "on.")

    w = F["data_windows"]
    cust = l2_rows(F, "CUSTOMER_CUSTOMER")
    orders = l2_rows(F, "SALESORDERS_SALESORDER")
    items = l2_rows(F, "SALESORDERS_SALESORDERITEM")
    acts = l2_rows(F, "CRM_OPPORTUNITY_ACTIVITY")

    say(doc, [
        ("Establish what they can see",
         f"\u201c{cust:,} customers, {orders:,} sales orders and {items:,} order line items. "
         f"Order history runs {w['SALESORDERS_SALESORDER']['min']} to "
         f"{w['SALESORDERS_SALESORDER']['max']} — eleven years. That's the depth you need to "
         f"say whether a customer's behaviour changed.\u201d"),
        ("Name the signal",
         "\u201cDisengagement almost never shows up as a complaint. It shows up as smaller "
         "orders, then longer gaps between them, then nothing. All three of those are "
         "computable off this table today.\u201d"),
        ("Add the engagement layer",
         f"\u201cAnd {acts:,} opportunity activities sit alongside it. So you can put "
         f"'when did we last touch them' next to 'when did they last buy', which is the "
         f"comparison that tells you whether the silence is theirs or ours.\u201d"),
        ("Show the eleven-year depth matters",
         f"\u201cThe reason the eleven years count: a customer who orders twice a year needs "
         f"three years of history before a gap means anything. Most CS tooling holds "
         f"eighteen months. This holds "
         f"{int(w['SALESORDERS_SALESORDER']['max'][:4]) - int(w['SALESORDERS_SALESORDER']['min'][:4])} "
         f"years, because it's SAP's own order history rather than a copy someone started "
         f"keeping later.\u201d"),
        ("Be straight about the join",
         f"\u201cOne thing to know. Order history goes to "
         f"{w['SALESORDERS_SALESORDER']['max']}, opportunities only cover "
         f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
         f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['max']}. So you can't line up an eleven-year "
         f"order trend against an opportunity trend — different windows. Order behaviour on "
         f"its own is the reliable signal here.\u201d"),
    ])

    ask(doc, "How do you currently find out that a steady account has gone quiet?",
        "The answer is almost always \u201cwhen the renewal comes up\u201d or \u201cwhen the "
        "AE mentions it\u201d. Both are too late, and both are the gap this page fills "
        "without any new data being collected.")

    close(doc,
          f"\u201cEleven years of order behaviour for {cust:,} customers, joined to "
          f"{acts:,} activities, already in SAP and never extracted. The at-risk list you "
          f"want is a query over data you already own.\u201d")

    red_flag(
        doc,
        "What not to claim to customer success",
        f"There is **no churn model, no health score and no renewal data** in this build. "
        f"The page shows buying behaviour; turning that into a health score is work that has "
        f"not been done. Do not imply a score exists. And do not offer the opportunity data "
        f"as a retention signal — it covers "
        f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
        f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['max']} only, and every open deal in it is past "
        f"due, so it says nothing about the future of an account.",
    )

    avoid(doc, [
        "**The win-rate finding. **It is the strongest thing in the kit and it is about new "
        "business, not retention. It will pull the conversation to the CRO's agenda.",
        "**The Sales Forecast page. **No forward pipeline, and CS will ask about renewal "
        "timing, which is not in this data at all.",
        f"**The Rep Leaderboard. **{F['sales_reps']} reps, quota attainment, nothing to do "
        f"with account health.",
        "**Ask the Agent, for account-specific questions. **With no verified queries it may "
        "answer a named-account question from the wrong table, and a CS lead will take the "
        "answer at face value.",
    ])


# -------------------------------------------------------------------- script 4

def script_product(doc, F):
    persona_header(
        doc, 4, "Product / Portfolio Manager", 7,
        "Product management, portfolio and pricing",
        "What is actually selling, and at what grain can I see it?",
        "Products")

    who(doc,
        "A product manager wants mix, not totals. They need to know which products carry the "
        "volume, which product groups are growing, and whether they can get to line-item "
        "grain without commissioning a report. Their scepticism is specific: they have been "
        "shown product dashboards built on an order header, which hides everything that "
        "matters. Show them the line item early.")

    open_on(doc, "Products",
            "Because the product and product-group breakdown is the answer to their "
            "question, and because it is where the line-item grain becomes visible. Any "
            "other opening page makes them wait for their own data.")

    prod = l2_rows(F, "PRODUCT_PRODUCT")
    desc = l2_rows(F, "PRODUCT_PRODUCTDESCRIPTION")
    grp = l2_rows(F, "PRODUCT_PRODUCTGROUP")
    grptxt = l2_rows(F, "PRODUCT_PRODUCTGROUPTEXT")
    items = l2_rows(F, "SALESORDERS_SALESORDERITEM")
    orders = l2_rows(F, "SALESORDERS_SALESORDER")
    w = F["data_windows"]

    say(doc, [
        ("Lead with the grain",
         f"\u201c{items:,} order line items under {orders:,} orders. That's roughly "
         f"{items / orders:.1f} lines per order. Everything on this page is computed at line "
         f"grain, not header — so a mixed order doesn't get attributed to one product.\u201d"),
        ("Show the product master depth",
         f"\u201c{prod:,} products, {desc:,} product descriptions, {grp:,} product groups "
         f"with {grptxt:,} group texts. The descriptions and group texts are the "
         f"language-keyed SAP text tables, which is why the labels on this page are the ones "
         f"your business already uses rather than codes.\u201d"),
        ("Make the mix point",
         f"\u201cSo you can ask which product groups carry the volume, and which carry the "
         f"value, and get different answers. Across "
         f"{int(w['SALESORDERS_SALESORDER']['max'][:4]) - int(w['SALESORDERS_SALESORDER']['min'][:4])} "
         f"years of orders, that divergence is the portfolio conversation.\u201d"),
        ("Connect it to the sales finding",
         f"\u201cAnd there's a bridge to the sales side worth knowing. Win rate is "
         f"{F['win_rate_pct']}% by count and {F['win_rate_value_pct']}% by value — the large "
         f"deals lose. If large deals skew to particular product groups, that's a product "
         f"problem wearing a sales costume. This data can test that.\u201d"),
        ("State the boundary plainly",
         f"\u201cWhat this can't tell you: there's no cost or margin in this layer, so "
         f"everything here is revenue mix, not profit mix. And opportunity data covers "
         f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['min']} to "
         f"{w['CRM_OPPORTUNITY_OPPORTUNITY']['max']} while orders go back to "
         f"{w['SALESORDERS_SALESORDER']['min']}, so don't line those two up.\u201d"),
    ])

    ask(doc, "When you ask for product mix at line-item level today, how long does it take "
             "to come back?",
        "Product managers almost always have a story about being given header-level data and "
        "having to explain why it is useless. That story is the value case and it is better "
        "in their words.")

    close(doc,
          f"\u201c{items:,} line items across {prod:,} products and {grp:,} product groups, "
          f"with SAP's own description and group-text tables supplying the labels. Line "
          f"grain, SAP's language, no extract, and available the moment you want to ask a "
          f"mix question.\u201d")

    red_flag(
        doc,
        "What not to claim to a product manager",
        f"There is **no cost, margin or price-list data** in this layer, so nothing here "
        f"supports a profitability or pricing claim — it is revenue mix only. The product "
        f"plant and valuation tables exist in L1 but are not in the "
        f"{F['l2_table_count']}-table analytics layer the application reads, so do not "
        f"promise costing without scoping the work. And do not describe product trend against "
        f"opportunity trend on one chart: "
        f"{int(w['SALESORDERS_SALESORDER']['max'][:4]) - int(w['SALESORDERS_SALESORDER']['min'][:4])} "
        f"years against eighteen months.",
    )

    avoid(doc, [
        "**The Rep Leaderboard and Sales Forecast. **Neither is about the portfolio, and the "
        "forecast page invites a demand-planning question this data cannot answer.",
        "**Any claim about demand forecasting by product. **The three ML tables forecast "
        "revenue and attainment, not product demand.",
        "**Ask the Agent for a product-group aggregation. **With no verified queries, a "
        "group-level roll-up is exactly the kind of query that can silently pick the wrong "
        "join and return a plausible wrong number.",
    ])


# -------------------------------------------------------------------- script 5

def script_manager(doc, F):
    persona_header(
        doc, 5, "First-line Sales Manager", 6,
        "First-line sales managers, regional managers",
        "Where is my team actually against quota, without me rebuilding the spreadsheet?",
        "Rep Leaderboard")

    who(doc,
        "A first-line manager runs a handful of reps and rebuilds the same attainment "
        "spreadsheet every week from a CRM export. They do not want analytics; they want the "
        "spreadsheet to already exist and be right. They are also the persona most likely to "
        "take a ranking literally, so the small-sample caveat here is not a formality — it "
        "protects them from managing off noise.")

    open_on(doc, "Rep Leaderboard",
            "Because per-rep attainment against quota is the artefact they maintain by hand. "
            "Opening anywhere else shows them someone else's job.")

    sp = F["attainment_spread"]
    reps = F["sales_reps"]
    per_rep = F["quota_total"] / reps

    say(doc, [
        ("Show them their spreadsheet, already built",
         f"\u201c{reps} reps, {spoken(F['quota_total'])} of total quota, attainment per rep "
         f"against it. This is the view you rebuild every week, and it's reading SAP data "
         f"directly, so there's no export step and nothing to paste.\u201d"),
        ("Give the per-rep frame",
         f"\u201cThat's about {spoken(per_rep)} of quota per rep on average. Useful as a "
         f"frame — the individual numbers are what you'd manage on.\u201d"),
        ("Show the variance is real",
         f"\u201cAnd attainment genuinely moves. Across the periods in this data it ranges "
         f"from {sp['min']}% to {sp['max']}%, standard deviation {sp['stddev']}. That's real "
         f"spread, not a flat line — which matters, because a flat attainment series usually "
         f"means the data's been averaged somewhere it shouldn't have been.\u201d"),
        ("Give them the coaching angle",
         f"\u201cHere's the number I'd put in front of a team. Win rate is "
         f"{F['win_rate_pct']}% by count but {F['win_rate_value_pct']}% by value. Average "
         f"won deal {usd(won(F)['AVG_DEAL'])}, average lost deal "
         f"{usd(lost(F)['AVG_DEAL'])}. The big deals are the ones slipping away. That's a "
         f"coaching conversation with a number attached.\u201d"),
        ("Draw the sample-size line yourself",
         f"\u201cAnd the honest bit. {reps} reps is too small to rank anybody. The mechanic "
         f"is right and it'll work on your full team, but I'm not going to stand here and "
         f"tell you rep four is underperforming on a sample of {reps}. Neither should "
         f"anything else you buy.\u201d"),
    ])

    ask(doc, "How long does the weekly attainment spreadsheet take you, and how often is it "
             "wrong by the time you present it?",
        "Managers reliably answer in hours, and the second half of the question is the one "
        "that stings. Both numbers are the value case and neither came from you.")

    close(doc,
          f"\u201cPer-rep attainment against {spoken(F['quota_total'])} of quota, live off "
          f"SAP data, no export. And the number worth taking to your team: "
          f"{F['win_rate_pct']}% of deals but {F['win_rate_value_pct']}% of dollars. You're "
          f"losing the big ones.\u201d")

    red_flag(
        doc,
        "What not to claim to a sales manager",
        f"Do **not** rank or compare individual reps off this data. {reps} reps is a "
        f"demonstration of the mechanic, not a sample that supports a statement about a "
        f"person, and a manager will remember a name. Do not present the attainment series "
        f"as a forecast of the next period either — every open opportunity is past due, so "
        f"there is no forward pipeline behind it. The variance figures "
        f"({sp['min']}% to {sp['max']}%) describe history.",
    )

    avoid(doc, [
        f"**The open pipeline total. **A manager reads {usd(F['open_pipeline'])} as coverage "
        f"for their next quarter. It is entirely past due, so that reading is wrong and "
        f"correcting it mid-meeting costs more than never showing it.",
        "**The Sales Forecast page. **Same reason, more acutely: it is the page they will "
        "want to believe.",
        "**Customer Health and Products. **Not what they are measured on.",
        "**Ask the Agent. **Managers ask about named reps, and with no verified queries a "
        "name-filtered answer on a sample this small can be confidently wrong.",
    ])


# -------------------------------------------------------------------- script 6

def script_platform(doc, F):
    persona_header(
        doc, 6, "IT / Data Platform Owner", 9,
        "Data platform, architecture, enterprise IT",
        "What did you actually build, and what is still missing?",
        "Ask the Agent")

    who(doc,
        "The platform owner is the only persona who will read the object list. They are not "
        "hostile; they are protecting themselves from inheriting something undocumented. "
        "Their trust is won entirely by volunteering the weaknesses before they are asked, "
        "because they will find all of them. If you present this build as finished they will "
        "discount everything; if you present the gaps with fixes attached, they will help.")

    open_on(doc, "Ask the Agent",
            "Because it is the component with the most interesting architecture and the "
            "largest gap, and opening on the gap is what buys credibility with this "
            "audience. Every other persona is steered away from this page; this one starts "
            "here.")

    sv, am, ag = F["semantic_view"], F["analyst_model"], F["cortex_agent"]

    say(doc, [
        ("Show the agent, then immediately show its limit",
         f"\u201cThis is a Cortex Agent, {ag['tool_count']} tool — "
         f"{', '.join(ag['tools'])} — on {ag['orchestration']} orchestration. It reads a "
         f"semantic model from a stage: {len(am['tables'])} tables, {am['dimensions']} "
         f"dimensions, {am['facts']} facts, {am['measures']} measures, and "
         f"{am['verified_queries']} verified queries. That last number is the one to look "
         f"at.\u201d"),
        ("Name the two-artefact problem",
         f"\u201cThere's also an in-database semantic view, {sv['name'].split('.')[-1]}: "
         f"{sv['tables']} tables, {sv['dimensions']} dimensions, {sv['facts']} facts, "
         f"{sv['metrics']} metrics, {sv['relationships']} relationships. The agent doesn't "
         f"read it. So there are two semantic descriptions of this business and the AI uses "
         f"the smaller one. That's a real inconsistency and it's on the fix list.\u201d"),
        ("Walk the layers honestly",
         f"\u201cThree schemas. L1 is {F['l1_table_count']} tables, {F['l1_rows']:,} rows, "
         f"and — this is the part I want to be precise about — they're **plain materialised "
         f"tables**, not passthrough views. L2 is {F['l2_table_count']} tables, "
         f"{F['l2_rows']:,} rows, {F['l2_dynamic_count']} dynamic and "
         f"{len(F['l2_plain'])} plain.\u201d"),
        ("Give them the duplication figure before they compute it",
         f"\u201c{len(F['l1_l2_identical_counts'])} table names appear in both L1 and L2 with "
         f"identical row counts. That's {F['l1_l2_duplicated_rows']:,} rows stored twice. So "
         f"this deployment is not zero-copy past the share boundary. The Finance 360 build "
         f"does it properly — six passthrough views — and converting L1 here is a small "
         f"change, because the application makes {F['app_reads_l1']} reads of L1 "
         f"anyway.\u201d"),
        ("Show the clean part",
         f"\u201cWhat is clean: all {F['app_reads_l2']} application queries read L2 and "
         f"nothing else. {F['app_reads_share_directly']} direct reads of the share, "
         f"{F['app_reads_l1']} of L1. Every screen sits on one set of tables, so the pages "
         f"can't disagree with each other.\u201d"),
        ("Flag the three plain tables",
         f"\u201cThree L2 tables are plain, not dynamic: {', '.join(F['l2_plain'])}. They're "
         f"the ML outputs behind the forecast page, and they will not tell you when they've "
         f"gone stale. The other {F['l2_dynamic_count']} refresh themselves.\u201d"),
        ("Hand over the data-integrity problem",
         f"\u201cAnd the dataset issue that matters most. All {F['open_opps_past_due']:,} "
         f"open opportunities have a close date in the past. "
         f"{F['open_opps_future']:,} are future-dated. So the forecast page demonstrates "
         f"method against history; it is not a forward call, and it can't be until this is "
         f"pointed at data with live pipeline.\u201d"),
    ])

    red_flag(
        doc,
        "The Sales Forecast page — what not to claim, before you open it",
        f"This is the one page in the application that cannot be presented at face value, "
        f"and the platform owner is the right person to hear why. All "
        f"{F['open_opps_past_due']:,} open opportunities have a close date in the past and "
        f"**{F['open_opps_future']:,} have a future one**, so there is no forward pipeline "
        f"behind it. It therefore demonstrates forecasting **method** — a forecast-versus-"
        f"actual series over "
        f"{F['data_windows']['SALES_FORECAST_VS_ACTUAL']['min']} to "
        f"{F['data_windows']['SALES_FORECAST_VS_ACTUAL']['max']}, plus three ML prediction "
        f"tables — and **not** a forward call. Never say \u201cthis is next quarter\u201d. "
        f"Two further traps on the same page: the three prediction tables "
        f"({', '.join(F['l2_plain'])}) are plain tables that can go stale without signalling "
        f"it, and SALES_FORECAST_VS_ACTUAL is a different population from the opportunity "
        f"set — {F['data_windows']['SALES_FORECAST_VS_ACTUAL']['rows']:,} rows with annual "
        f"totals in the billions against {F['opportunity_count']:,} opportunities — so it "
        f"must never be reconciled to the funnel. What the page does support: attainment "
        f"genuinely varies, {F['attainment_spread']['min']}% to "
        f"{F['attainment_spread']['max']}% with standard deviation "
        f"{F['attainment_spread']['stddev']}, so it is not a flat series.",
    )

    ask(doc, "If you inherited this on Monday, which of those four would you want closed "
             "first?",
        "They will usually pick the L1 conversion or the verified queries. Either answer "
        "makes them a participant in the build rather than an auditor of it, and their "
        "priority order is better information than yours.")

    close(doc,
          f"\u201cFour known gaps: L1 is materialised rather than passthrough, "
          f"{F['l1_l2_duplicated_rows']:,} duplicated rows; "
          f"{am['verified_queries']} verified queries on the agent; two semantic artefacts "
          f"where there should be one; and a dataset with no forward-dated pipeline. None of "
          f"them is hidden and all four have a known fix. That's the state of it.\u201d")

    red_flag(
        doc,
        "What not to claim to a platform owner",
        f"Do **not** use the words \u201czero-copy\u201d unqualified. L1 is "
        f"{F['l1_rows']:,} materialised rows and this audience will run "
        f"INFORMATION_SCHEMA.TABLES. Do **not** say one governed semantic definition sits "
        f"behind the dashboard and the agent — the agent reads a "
        f"{len(am['tables'])}-table stage model and the semantic view covers "
        f"{sv['tables']}. And do **not** claim the forecast is forward-looking. Each of "
        f"these is one query from being disproved, and this is the persona who runs the "
        f"query.",
    )

    avoid(doc, [
        f"**Improvised questions to the agent. **{am['verified_queries']} verified queries "
        f"means every answer is generated. Use only questions you have rehearsed, and say "
        f"out loud that you rehearsed them — with this audience that reads as rigour, not "
        f"weakness.",
        "**The win-rate finding as the headline. **It is the best thing in the kit but it is "
        "an analytics result, and this persona is assessing engineering. Mention it once as "
        "evidence the layer produces something useful, then go back to the object list.",
        "**Presenting the build as finished. **It is deployed and it works; it also has four "
        "named gaps. Claiming completeness with this audience is the one unrecoverable "
        "move.",
    ])


# --------------------------------------------------------------- the assembly

SCRIPTS = (
    script_cro,
    script_ops,
    script_cs,
    script_product,
    script_manager,
    script_platform,
)


def main():
    F = load_facts()

    doc = Document()
    setup_page(doc)
    cover(doc, F)

    for build in SCRIPTS:
        doc.add_page_break()
        build(doc, F)

    KIT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"wrote {OUT}")
    print(f"  size {OUT.stat().st_size / 1024:.0f} KB")
    print(f"  {len(SCRIPTS)} persona scripts")


if __name__ == "__main__":
    main()
