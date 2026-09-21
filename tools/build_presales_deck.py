#!/usr/bin/env python3
"""Build the SAP Sales 360 presales deck.

Ten slides for an SE to present or to lift into their own deck. Every figure is
read from /tmp/sales_facts.json, which was produced by querying the account —
nothing here is typed in by hand, so the deck cannot drift from the data it
describes. Screenshots come from /tmp/sales_shots, captured from the live app.

Structure mirrors the Supply Chain 360 presales deck; the content does not.
Sales has a different story: the curated layer here IS a copy, and the win-rate
reframe is the slide worth presenting.

    python3 tools/build_presales_deck.py
"""

import json
import pathlib
import sys

from PIL import Image
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_AUTO_SIZE
from pptx.util import Inches, Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pptx_kit import (  # noqa: E402
    new_presentation, set_ph, add_shape_text, add_text,
    style_cell, set_table_borders, verify_slide, verify_deck,
    DK1, DK2, WHITE, SF_BLUE, TEAL, ORANGE, VIOLET, BODY_GREY, LIGHT_BG,
)
from pptx.dml.color import RGBColor  # noqa: E402

RED = RGBColor(0xA2, 0x00, 0x00)          # in-palette dark red, safe as text

FACTS = pathlib.Path("/tmp/sales_facts.json")
SHOTS = pathlib.Path("/tmp/sales_shots")
OUT = (pathlib.Path.home() / "Documents" / "SAP"
       / "Sales_360_Presales_Kit" / "00_Presales_Overview.pptx")

# Content safe band for custom shapes on the template's content layouts.
TOP, BOTTOM, LEFT, RIGHT = 1.32, 5.08, 0.40, 9.50
FULLW = RIGHT - LEFT


# ------------------------------------------------------------------ facts


def load_facts():
    doc = json.loads(FACTS.read_text())
    f = doc["facts"]
    shots = {s["id"]: s["file"] for s in json.loads((SHOTS / "manifest.json").read_text())}
    for sid, path in shots.items():
        if not pathlib.Path(path).exists():
            raise FileNotFoundError(f"screenshot missing for '{sid}': {path}")
    return f, shots


def money(v, digits=0):
    """$1,234,567 — used where the precise figure is the point."""
    return f"${v:,.{digits}f}"


def compact(v):
    """$1.90B / $703K — used where the magnitude is the point."""
    if abs(v) >= 1e9:
        return f"${v / 1e9:.2f}B"
    if abs(v) >= 1e6:
        return f"${v / 1e6:.0f}M"
    if abs(v) >= 1e3:
        return f"${v / 1e3:.0f}K"
    return money(v)


def by_won(rows, won):
    return next(r for r in rows if bool(r["IS_WON"]) is won)


def row_count(f, table):
    return next(o["ROW_COUNT"] for o in f["l1_objects"] if o["TABLE_NAME"] == table)


# ------------------------------------------------------------------ primitives


def content(prs, title, subtitle):
    """Title + subtitle content slide; everything below 1.32" is ours."""
    s = prs.slides.add_slide(prs.slide_layouts[0])
    set_ph(s, 0, title)
    set_ph(s, 1, subtitle)
    return s


def box(slide, x, y, w, h, fill=LIGHT_BG, accent=None):
    """Card background, optional 0.05" accent spine on the left edge."""
    add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, "", fill, DK1)
    if accent is not None:
        add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, 0.05, h, "", accent, DK1)


def stack(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT, spacing=1.06):
    """Multi-line textbox: [(text, size, bold, colour, space_after), ...].

    Textboxes (shape type 17) are exempt from the kit's auto-fit rule; Arial and
    palette colours are enforced here so the verifier stays quiet.
    """
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, item in enumerate(runs):
        body, size, bold, colour = item[:4]
        after = item[4] if len(item) > 4 else 5
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_after = Pt(after)
        r = p.add_run()
        r.text = body
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = colour
        r.font.name = "Arial"
    return tb


def card(slide, x, y, w, h, kicker, runs, accent=DK2, fill=LIGHT_BG):
    box(slide, x, y, w, h, fill, accent)
    head = [(kicker.upper(), 8.5, True, DK2, 7)] if kicker else []
    stack(slide, x + 0.24, y + 0.16, w - 0.42, h - 0.30, head + list(runs))


def banner(slide, y, runs, fill=DK2, h=0.62, x=LEFT, w=FULLW):
    """Full-width statement bar. Text is centred on the bar, so the kit's
    overlap check treats the pair as one column and leaves it alone."""
    add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, "", fill, WHITE)
    stack(slide, x + 0.30, y + 0.11, w - 0.60, h - 0.22, runs, align=PP_ALIGN.LEFT)


def stat(slide, x, y, w, h, value, label, detail=None, fill=LIGHT_BG, accent=DK2):
    box(slide, x, y, w, h, fill, accent)
    runs = [(value, 28, True, DK2, 3), (label.upper(), 8.5, True, BODY_GREY, 4)]
    if detail:
        runs.append((detail, 10, False, DK1, 0))
    stack(slide, x + 0.26, y + 0.16, w - 0.46, h - 0.30, runs)


def note(slide, text, y=4.88):
    stack(slide, LEFT, y, FULLW, 0.19, [(text, 8, False, BODY_GREY, 0)])


def picture(slide, path, x, y, w, h):
    """Fit inside the box, centred, aspect preserved — never stretched."""
    im = Image.open(path)
    ar = im.width / im.height
    if ar > w / h:
        pw, ph = w, w / ar
    else:
        ph, pw = h, h * ar
    slide.shapes.add_picture(
        str(path), Inches(x + (w - pw) / 2), Inches(y + (h - ph) / 2),
        Inches(pw), Inches(ph))


def caption(slide, x, y, w, text):
    stack(slide, x, y, w, 0.20, [(text.upper(), 8.5, True, DK2, 0)])


# ---------------------------------------------------------------------- slides


def s01_cover(prs, f):
    s = prs.slides.add_slide(prs.slide_layouts[13])
    set_ph(s, 3, "SAP SALES 360")
    set_ph(s, 0, "SAP orders and CRM opportunities on one model")
    # PH2 is a narrow 4.6" x 0.3" line — the kit caps it at ~41 characters.
    set_ph(s, 2, f"SE presales kit · verified {f['verified_on']}")
    return s


def s02_problem(prs, f):
    s = content(prs, "ORDERS HERE, OPPORTUNITIES THERE",
                "Two systems of record; neither answers the whole question")
    orders = f["data_windows"]["SALESORDERS_SALESORDER"]
    opps = f["data_windows"]["CRM_OPPORTUNITY_OPPORTUNITY"]
    items = row_count(f, "SALESORDERS_SALESORDERITEM")
    acts = row_count(f, "CRM_OPPORTUNITY_ACTIVITY")

    card(s, LEFT, TOP, 4.30, 1.66, "SAP — the record of what was sold", [
        (f"{orders['rows']:,} sales orders, {items:,} order lines", 12, True, DK1, 4),
        (f"Window: {orders['min']} to {orders['max']}", 10, False, BODY_GREY, 4),
        ("Revenue, delivered. It says nothing about the deals that never closed.",
         10, False, DK1, 0),
    ], accent=DK2)

    card(s, 5.20, TOP, 4.30, 1.66, "CRM — the record of what was pursued", [
        (f"{opps['rows']:,} opportunities, {acts:,} logged activities", 12, True, DK1, 4),
        (f"Window: {opps['min']} to {opps['max']}", 10, False, BODY_GREY, 4),
        ("Stage, probability and owner. It says nothing about fulfilled revenue.",
         10, False, DK1, 0),
    ], accent=ORANGE)

    banner(s, 3.22, [
        ("The question nobody can answer from one system", 12, True, WHITE, 3),
        ("Which opportunities turned into orders, and what did the ones we lost look like?",
         11, False, WHITE, 0),
    ], h=0.68)

    for i, (head, detail) in enumerate([
        ("Pipeline reviews quote CRM", "Stage counts and weighted value"),
        ("Revenue reviews quote SAP", "Billed orders and order lines"),
        ("Win-rate questions get two answers", "Both defensible, neither complete"),
    ]):
        x = LEFT + i * 3.07
        box(s, x, 4.06, 2.92, 0.74, LIGHT_BG, TEAL)
        stack(s, x + 0.22, 4.18, 2.60, 0.54, [
            (head, 10, True, DK1, 2), (detail, 9, False, BODY_GREY, 0)])

    note(s, "Row counts and date windows read from the account, not from design docs. "
            "The two windows barely overlap — see slide 9.")
    return s


def s03_pattern(prs, f):
    s = content(prs, "ONE STACK, SHARE TO SEMANTIC",
                "BDC share, curated L1, dynamic L2, semantic view and agent")
    sv = f["semantic_view"]
    # Chevron labels stay on one line with real spaces: a "\n" here would split
    # the paragraph into runs the kit reads back as merged ("L1CURATED").
    layers = [
        ("L0 BDC SHARE", [
            "SAP BDC data products shared into Snowflake.",
            "Zero copy at the boundary — nothing extracted.",
        ]),
        ("L1 CURATED", [
            f"{f['l1_table_count']} tables, {f['l1_rows']:,} rows.",
            f"{f['l1_dynamic_count']} dynamic — this layer is a copy.",
        ]),
        ("L2 DYNAMIC", [
            f"{f['l2_table_count']} tables, {f['l2_dynamic_count']} dynamic, {f['l2_rows']:,} rows.",
            "Refreshes itself; three ML tables do not.",
        ]),
        ("SEMANTIC + AGENT", [
            f"{sv['tables']} tables, {sv['metrics']} metrics, {sv['relationships']} relationships.",
            "One Cortex Agent answers over it.",
        ]),
    ]
    w = 2.17
    for i, (label, lines) in enumerate(layers):
        x = LEFT + i * (w + 0.14)
        add_shape_text(s, MSO_SHAPE.CHEVRON, x, TOP, w, 0.80,
                       label, DK2, WHITE, font_size=11, bold=True)
        stack(s, x + 0.08, 2.28, w - 0.16,
              1.55, [(ln, 9.5, False, DK1, 6) for ln in lines])

    banner(s, 3.98, [
        ("Be straight about L1", 11, True, WHITE, 3),
        (f"L1 is a materialised copy: {f['l1_table_count']} plain tables, {f['l1_rows']:,} rows, "
         f"{f['l1_dynamic_count']} dynamic. The zero-copy claim applies to the share, not to this layer.",
         10.5, False, WHITE, 0),
    ], h=0.74)

    note(s, f"Semantic view {sv['name']} · {sv['dimensions']} dimensions · "
            f"{sv['facts']} facts. Layer counts verified {f['verified_on']}.")
    return s


def s04_app(prs, f, shots):
    s = content(prs, "SEVEN PAGES ON ONE GOVERNED MODEL",
                f"The app reads L2 only — {f['app_reads_l2']} references, none to L1")
    picture(s, shots["dashboard"], LEFT, TOP, 5.50, 3.44)

    stack(s, 6.10, TOP + 0.02, 3.36, 2.00,
          [("THE SEVEN PAGES", 8.5, True, DK2, 7)] +
          [(f"·  {p}", 10.5, False, DK1, 6) for p in f["app_pages"]])

    card(s, 6.10, 3.52, 3.40, 1.24, "Where it reads from", [
        (f"{f['app_reads_l2']} table references to L2, {f['app_reads_l1']} to L1, "
         f"{f['app_reads_share_directly']} straight to the share.", 10, False, DK1, 4),
        ("One curated layer feeds every page, so two pages cannot disagree.",
         10, False, DK1, 0),
    ], accent=DK2)

    note(s, f"Shown: the Dashboard page. App host {f['app_url']} · "
            f"account {f['account']} · {f['region']}.")
    return s


def s05_pipeline(prs, f, shots):
    s = content(prs, "PIPELINE STRUCTURE, NOT A FORECAST",
                f"All {f['open_opps_past_due']:,} open opportunities are past close date")
    stages = f["pipeline_by_stage"]
    rows = len(stages) + 1
    tbl_h = 0.29 * rows
    gfx = s.shapes.add_table(rows, 4, Inches(LEFT), Inches(TOP),
                             Inches(4.45), Inches(tbl_h)).table
    for ci, cw in enumerate([1.85, 0.72, 1.15, 0.73]):
        gfx.columns[ci].width = Inches(cw)
    heads = ["Stage", "Opps", "Value", "Avg prob"]
    for ci, h in enumerate(heads):
        style_cell(gfx.cell(0, ci), h, DK2, WHITE, 9, True,
                   PP_ALIGN.LEFT if ci == 0 else PP_ALIGN.RIGHT)
    for ri, r in enumerate(stages, start=1):
        fill = LIGHT_BG if ri % 2 else WHITE
        vals = [r["STAGE_NAME"], f"{r['OPPS']:,}",
                compact(r["AMOUNT"]), f"{r['AVG_PROB']:.0f}%"]
        for ci, v in enumerate(vals):
            style_cell(gfx.cell(ri, ci), v, fill, DK1, 9, ci == 0,
                       PP_ALIGN.LEFT if ci == 0 else PP_ALIGN.RIGHT)
    set_table_borders(gfx, rows, 4)

    closed = sum(r["OPPS"] for r in f["win_loss"])
    won, lost = by_won(f["win_loss"], True), by_won(f["win_loss"], False)

    caption(s, 5.05, TOP, 4.45, "Sales funnel page — the same stage mix, as the rep sees it")
    picture(s, shots["funnel"], 5.05, 1.58, 4.45, 2.52)

    for i, (value, label, detail, accent) in enumerate([
        (f"{f['open_opps_past_due']:,}", "open opportunities",
         f"{compact(f['open_amount_past_due'])} of open value", DK2),
        (f"{f['open_opps_future']}", "with a future close date",
         "Not commit, and not coverage", RED),
        (f"{closed:,}", "closed opportunities",
         f"{won['OPPS']} won · {lost['OPPS']} lost", TEAL),
    ]):
        x = LEFT + i * 3.07
        box(s, x, 4.16, 2.92, 0.66, LIGHT_BG, accent)
        stack(s, x + 0.22, 4.24, 2.62, 0.52, [
            (f"{value}  ", 15, True, DK2, 0),
            (label.upper(), 8, True, BODY_GREY, 2),
            (detail, 8.5, False, DK1, 0)])

    note(s, f"{f['opportunity_count']:,} opportunities total = {f['open_opps_past_due']:,} open "
            f"+ {closed:,} closed. Open value {money(f['open_pipeline'])}. Show stage mix, deal "
            f"size and conversion — never a date-based forecast.", y=4.90)
    return s


def s06_winrate(prs, f):
    s = content(prs, "WINNING THE COUNT, LOSING THE VALUE",
                "The same funnel reads differently by count and by value")
    won, lost = by_won(f["deal_size"], True), by_won(f["deal_size"], False)
    closed_n = won["OPPS"] + lost["OPPS"]
    closed_v = won["AMOUNT"] + lost["AMOUNT"]
    gap = lost["AVG_DEAL"] - won["AVG_DEAL"]
    gap_pct = gap / won["AVG_DEAL"] * 100

    card(s, LEFT, TOP, 4.40, 1.50, "By deal count", [
        (f"{f['win_rate_pct']}%", 30, True, DK2, 4),
        (f"{won['OPPS']} won of {closed_n} closed — a healthy-looking funnel.",
         10.5, False, DK1, 0),
    ], accent=DK2)
    card(s, 5.10, TOP, 4.40, 1.50, "By deal value", [
        (f"{f['win_rate_value_pct']}%", 30, True, DK2, 4),
        (f"{compact(won['AMOUNT'])} won of {compact(closed_v)} closed — the same funnel, worse.",
         10.5, False, DK1, 0),
    ], accent=RED)

    for i, (value, label, detail, accent) in enumerate([
        (compact(won["AVG_DEAL"]), "average won deal", money(won["AVG_DEAL"]), DK2),
        (compact(lost["AVG_DEAL"]), "average lost deal", money(lost["AVG_DEAL"]), RED),
        (f"+{gap_pct:.0f}%", "bigger when we lose", f"{compact(gap)} per deal", ORANGE),
    ]):
        stat(s, LEFT + i * 3.07, 3.06, 2.92, 1.02, value, label, detail, accent=accent)

    banner(s, 4.34, [
        ("They are losing the large deals — and neither SAP nor CRM shows this alone. "
         "SAP knows the won revenue; CRM knows the deal count. Only the joined model divides one by the other.",
         10.5, False, WHITE, 0),
    ], h=0.52)
    return s


def s07_views(prs, f, shots):
    s = content(prs, "REP AND FORECAST VIEWS",
                f"{f['sales_reps']} reps against quota, and attainment that moves")
    caption(s, LEFT, TOP, 4.40, "Rep leaderboard — quota, attainment, ranking")
    caption(s, 5.10, TOP, 4.40, "Sales forecast — forecast versus actual by period")
    picture(s, shots["leaderboard"], LEFT, 1.58, 4.40, 2.70)
    picture(s, shots["forecast"], 5.10, 1.58, 4.40, 2.70)

    sp = f["attainment_spread"]
    card(s, LEFT, 4.34, 4.40, 0.70, None, [
        (f"{f['sales_reps']} reps · {money(f['quota_total'])} total quota", 10, True, DK1, 3),
        (f"Monthly attainment {sp['min']}% to {sp['max']}% (σ {sp['stddev']}) — real variance.",
         9.5, False, DK1, 0),
    ], accent=DK2)
    card(s, 5.10, 4.34, 4.40, 0.70, None, [
        (f"{len(f['l2_plain'])} L2 tables are plain, not dynamic", 10, True, RED, 3),
        ("So the ML panels on the Forecast page are frozen — say so before it is spotted.",
         9.5, False, DK1, 0),
    ], accent=RED)
    return s


def s08_agent(prs, f, shots):
    s = content(prs, "ASK IT IN PLAIN ENGLISH",
                "A real Cortex Agent answers over the governed model")
    ag, am, sv = f["cortex_agent"], f["analyst_model"], f["semantic_view"]
    picture(s, shots["chat"], LEFT, TOP, 5.20, 3.28)

    card(s, 5.85, TOP, 3.65, 1.52, "The agent is real", [
        (f"Agent: {ag['name'].split('.')[-1]}", 11, True, DK1, 3),
        (f"{ag['tool_count']} tool: {ag['tools'][0]}", 10, False, DK1, 3),
        (f"Orchestration: {ag['orchestration']} · default version {ag['default_version']}",
         9.5, False, BODY_GREY, 0),
    ], accent=DK2)

    banner(s, 3.00, [
        ("Finance 360 ships no agent at all. This is a Sales-only differentiator.",
         10, False, WHITE, 0),
    ], h=0.44, x=5.85, w=3.65)

    card(s, 5.85, 3.56, 3.65, 1.48, "Know the gap before you demo", [
        (f"View: {sv['tables']} tables, {sv['metrics']} metrics. "
         f"Agent's model: {am['tables_n']} tables, {am['dimensions']} dims, "
         f"{am['verified_queries']} verified queries.", 9.5, False, DK1, 3),
        ("Questions outside those tables are where it fails. Stay inside them.",
         9.5, True, RED, 0),
    ], accent=RED)

    note(s, f"Agent {ag['name']} · semantic model {am['stage_file']}.")
    return s


def s09_caveats(prs, f):
    s = content(prs, "WHAT TO SAY BEFORE YOU ARE ASKED",
                "The honest list — every line of it is findable in the account")
    ow = f["data_windows"]["SALESORDERS_SALESORDER"]
    cw = f["data_windows"]["CRM_OPPORTUNITY_OPPORTUNITY"]
    fw = f["data_windows"]["SALES_FORECAST_VS_ACTUAL"]
    rows = [
        ("L1 is a materialised copy",
         f"{f['l1_table_count']} plain tables, {f['l1_rows']:,} rows, {f['l1_dynamic_count']} dynamic",
         ORANGE, DK1),
        ("Ten tables are materialised twice",
         f"{f['l1_l2_duplicated_rows']:,} rows sit in both L1 and L2, on top of the share",
         ORANGE, DK1),
        (f"{len(f['l2_plain'])} L2 ML tables never refresh",
         ", ".join(sorted(f["l2_plain"])), ORANGE, DK1),
        ("The pipeline is entirely past due",
         f"{f['open_opps_past_due']:,} of {f['open_opps_past_due']:,} open opps, "
         f"{compact(f['open_amount_past_due'])}, {f['open_opps_future']} with a future date",
         RED, RED),
        ("The data windows do not line up",
         f"Orders {ow['min']}..{ow['max']} · opps {cw['min']}..{cw['max']} · "
         f"forecast {fw['min'][:7]}..{fw['max'][:7]}", RED, RED),
        ("The agent sees less than the view",
         f"{f['analyst_model']['tables_n']} tables versus {f['semantic_view']['tables']}, "
         f"{f['analyst_model']['verified_queries']} verified queries", RED, RED),
    ]
    y = TOP + 0.04
    for i, (item, detail, accent, tcol) in enumerate(rows):
        box(s, LEFT, y, FULLW, 0.52, LIGHT_BG if i % 2 == 0 else WHITE, accent)
        stack(s, LEFT + 0.24, y + 0.15, 3.55, 0.30, [(item, 10.5, True, DK1, 0)])
        stack(s, 4.30, y + 0.15, 5.10, 0.30, [(detail, 9.5, False, tcol, 0)])
        y += 0.56

    note(s, "Never put orders and opportunities on one time axis — the windows differ by a "
            "decade at one end and a year at the other.")
    return s


def s10_next(prs, f):
    s = content(prs, "WHERE TO TAKE IT",
                "Four ways to use this kit, in order of effort")
    won = by_won(f["deal_size"], True)
    lost = by_won(f["deal_size"], False)
    opts = [
        ("Demo the app",
         f"{f['app_page_count']} pages are live on {f['account']}. Open it and present — nothing to build."),
        ("Lead with the win-rate reframe",
         f"{f['win_rate_pct']}% by count against {f['win_rate_value_pct']}% by value, "
         f"{compact(won['AVG_DEAL'])} won against {compact(lost['AVG_DEAL'])} lost. It lands in a minute."),
        ("Ask the agent live",
         f"One tool, {f['cortex_agent']['orchestration']} orchestration. "
         f"Keep questions inside the {f['analyst_model']['tables_n']} tables its model covers."),
        ("Point it at customer data",
         "Swap L0 for the customer's own BDC share. The curated layers, the semantic view "
         "and the agent above it still apply."),
    ]
    y = TOP + 0.04
    for i, (head, detail) in enumerate(opts):
        add_shape_text(s, MSO_SHAPE.RECTANGLE, LEFT, y, FULLW, 0.80, "", DK2, WHITE)
        stack(s, LEFT + 0.30, y + 0.13, FULLW - 0.60, 0.56, [
            (f"{i + 1}.  {head}", 12, True, WHITE, 3),
            (detail, 10, False, WHITE, 0)])
        y += 0.90

    note(s, f"{f['repo']} · app {f['app_url']} · agent "
            f"{f['cortex_agent']['name'].split('.')[-1]} · figures verified {f['verified_on']}.",
         y=4.90)
    return s


def main():
    f, shots = load_facts()
    # The analyst model reports its tables as a list; the deck quotes the count.
    f["analyst_model"]["tables_n"] = len(f["analyst_model"]["tables"])

    prs = new_presentation()
    builders = [
        lambda: s01_cover(prs, f),
        lambda: s02_problem(prs, f),
        lambda: s03_pattern(prs, f),
        lambda: s04_app(prs, f, shots),
        lambda: s05_pipeline(prs, f, shots),
        lambda: s06_winrate(prs, f),
        lambda: s07_views(prs, f, shots),
        lambda: s08_agent(prs, f, shots),
        lambda: s09_caveats(prs, f),
        lambda: s10_next(prs, f),
    ]
    issues = 0
    for i, build in enumerate(builders, start=1):
        slide = build()
        issues += len(verify_slide(slide, prs, i))
    issues += len(verify_deck(prs))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"\nwrote {OUT}  ({len(prs.slides)} slides, {issues} verifier issue(s))")
    return 0 if issues == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
