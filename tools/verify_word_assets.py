#!/usr/bin/env python3
"""Verify the two Sales 360 Word deliverables against the verified fact set.

    python3 tools/verify_word_assets.py

This exists because the failure mode that matters on these documents is not a
crash — both builders run fine — it is a figure that reads plausibly and is not
in the data. A presenter cannot tell the difference and neither can a reviewer
skimming a table, so the check is mechanical.

Five classes of check:

  1. structural  — both files open, carry tables, and are non-trivial
  2. personas    — six scripts, six DISTINCT opening pages, every one of them a
                   real page in facts["app_pages"]
  3. rendering   — no literal '**' survived rich(), no markdown headings, no
                   Python container repr leaked into prose
  4. honesty     — the two mandatory beats appear in BOTH documents
  5. figures     — every grouped dollar amount in either document is derivable
                   from /tmp/sales_facts.json

Check 5 is the one with teeth. The whitelist is built from the fact set itself
rather than typed out, so a figure only passes if some value in sales_facts.json
formats to it. Anything computed across facts (a difference, a subtotal, a
per-head average) has to be declared in DERIVED with the arithmetic shown —
which forces the derivation to be stated somewhere reviewable instead of living
only in an f-string.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

from docx import Document

KIT = pathlib.Path.home() / "Documents" / "SAP" / "Sales_360_Presales_Kit"
SUMMARY = KIT / "01_Management_Summary.docx"
SCRIPTS = KIT / "02_Demo_Scripts_by_Persona.docx"
FACTS_FILE = pathlib.Path("/tmp/sales_facts.json")

MONEY = re.compile(r"\$\d{1,3}(?:,\d{3})+")

checks = 0
failures: list[str] = []


def check(ok: bool, label: str) -> None:
    global checks
    checks += 1
    if not ok:
        failures.append(label)


# ----------------------------------------------------------------- extraction

def cell_paragraphs(table):
    """Every paragraph in a table, including in nested tables."""
    for row in table.rows:
        for cell in row.cells:
            yield from cell.paragraphs
            for inner in cell.tables:
                yield from cell_paragraphs(inner)


def all_paragraphs(doc):
    yield from doc.paragraphs
    for t in doc.tables:
        yield from cell_paragraphs(t)


def text_of(doc) -> list[str]:
    return [p.text for p in all_paragraphs(doc) if p.text.strip()]


def table_count(doc) -> int:
    """Top-level tables only; callout boxes are single-cell tables and count."""
    return len(doc.tables)


# ------------------------------------------------------------ figure whitelist

def numeric_leaves(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from numeric_leaves(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from numeric_leaves(v)
    elif isinstance(obj, bool):
        return
    elif isinstance(obj, (int, float)):
        yield float(obj)


def derived(F) -> dict[str, float]:
    """Figures the documents compute across facts. Arithmetic stated, not implied.

    Every entry here is a number that appears in a document but not in the fact
    file, so each one has to be justified by the expression next to it.
    """
    w = next(r for r in F["deal_size"] if r["IS_WON"])
    l = next(r for r in F["deal_size"] if not r["IS_WON"])
    return {
        "avg lost deal minus avg won deal": l["AVG_DEAL"] - w["AVG_DEAL"],
        "closed value = won + lost": w["AMOUNT"] + l["AMOUNT"],
        "quota per rep = quota_total / sales_reps": F["quota_total"] / F["sales_reps"],
        "smallest open stage by value": min(s["AMOUNT"] for s in F["pipeline_by_stage"]),
        "largest open stage by value": max(s["AMOUNT"] for s in F["pipeline_by_stage"]),
    }


def whitelist(F) -> set[str]:
    """Every grouped-dollar string any fact or declared derivation can produce."""
    allowed: set[str] = set()
    values = list(numeric_leaves(F)) + list(derived(F).values())
    for n in values:
        # the documents round with :,.0f; admit the neighbours so a figure that
        # was rounded a different way upstream still resolves rather than
        # producing a false positive.
        for candidate in (n, n - 1, n + 1):
            allowed.add(f"${candidate:,.0f}")
    return allowed


# --------------------------------------------------------------------- checks

def check_structure(doc, name, min_paras, min_tables):
    t = text_of(doc)
    check(len(t) >= min_paras, f"{name}: only {len(t)} non-empty paragraphs")
    check(table_count(doc) >= min_tables, f"{name}: only {table_count(doc)} tables")
    return t


def check_rendering(lines, name):
    for i, line in enumerate(lines):
        check("**" not in line, f"{name}: literal '**' in line {i}: {line[:70]!r}")
        check(not re.match(r"^#{1,6}\s", line.strip()),
              f"{name}: markdown heading in line {i}: {line[:70]!r}")
        for bad in ("{'", "['", "'}", "}]", "OrderedDict", "dict_keys", "RGBColor("):
            check(bad not in line,
                  f"{name}: container repr {bad!r} in line {i}: {line[:70]!r}")


def check_personas(lines, F):
    opens = [m.group(1).strip()
             for line in lines
             for m in [re.search(r"Opens on:\s*(.+?)\s*$", line)]
             if m]
    # the cover table also carries an "Opens on" column, so filter to the six
    # persona header lines, which are the ones carrying the minutes prefix.
    header_opens = [m.group(1).strip()
                    for line in lines
                    for m in [re.search(r"minutes\s+·.*Opens on:\s*(.+?)\s*$", line)]
                    if m]
    check(len(header_opens) == 6,
          f"scripts: expected 6 persona headers, found {len(header_opens)}: {header_opens}")
    check(len(set(header_opens)) == 6,
          f"scripts: opening pages are not distinct: {header_opens}")
    for page in header_opens:
        check(page in F["app_pages"],
              f"scripts: '{page}' is not a page in facts['app_pages']")
    check(len(opens) >= 6, f"scripts: only {len(opens)} 'Opens on' references")
    return header_opens


def check_honesty(lines, name, F):
    blob = " ".join(lines)
    check(str(F["open_opps_past_due"]) in blob.replace(",", "")
          or f"{F['open_opps_past_due']:,}" in blob,
          f"{name}: past-due open opportunity count ({F['open_opps_past_due']:,}) absent")
    check("past due" in blob.lower() or "past its close date" in blob.lower()
          or "past their close date" in blob.lower(),
          f"{name}: no statement that the pipeline is past due")
    check("zero-copy" in blob.lower() or "zero copy" in blob.lower(),
          f"{name}: the L1 zero-copy caveat is not raised")
    check(f"{F['l1_l2_duplicated_rows']:,}" in blob,
          f"{name}: duplicated-row figure ({F['l1_l2_duplicated_rows']:,}) absent")
    check(f"{F['l1_rows']:,}" in blob,
          f"{name}: L1 row count ({F['l1_rows']:,}) absent")
    check("verified quer" in blob.lower(),
          f"{name}: the zero-verified-queries gap is not mentioned")
    check(str(F["win_rate_pct"]) in blob and str(F["win_rate_value_pct"]) in blob,
          f"{name}: both win-rate figures are not present")


def check_figures(lines, name, allowed):
    seen = set()
    for line in lines:
        for hit in MONEY.findall(line):
            seen.add(hit)
            check(hit in allowed,
                  f"{name}: {hit} is not derivable from sales_facts.json — {line[:90]!r}")
    return seen


# ----------------------------------------------------------------------- main

def main():
    if not FACTS_FILE.exists():
        sys.exit(f"missing {FACTS_FILE}; run tools/sales_facts.py first")
    F = json.loads(FACTS_FILE.read_text())["facts"]
    allowed = whitelist(F)

    for path in (SUMMARY, SCRIPTS):
        if not path.exists():
            sys.exit(f"missing {path}; run the builders first")

    summary = Document(str(SUMMARY))
    scripts = Document(str(SCRIPTS))

    s_lines = check_structure(summary, "summary", 60, 10)
    # cover contributes 3 (mapping table + 2 warning callouts) and each script
    # contributes 4 (walk-in question, say-this table, ask, red flag). Script 6
    # carries a fifth: the dedicated Sales Forecast warning, since no persona
    # opens on that page and the caveat must land somewhere unmissable.
    d_lines = check_structure(scripts, "scripts", 120, 28)

    check_rendering(s_lines, "summary")
    check_rendering(d_lines, "scripts")

    pages = check_personas(d_lines, F)

    check_honesty(s_lines, "summary", F)
    check_honesty(d_lines, "scripts", F)

    s_money = check_figures(s_lines, "summary", allowed)
    d_money = check_figures(d_lines, "scripts", allowed)

    print(f"summary : {SUMMARY.stat().st_size / 1024:.0f} KB, "
          f"{len(s_lines)} paragraphs, {table_count(summary)} tables, "
          f"{len(s_money)} distinct dollar figures")
    print(f"scripts : {SCRIPTS.stat().st_size / 1024:.0f} KB, "
          f"{len(d_lines)} paragraphs, {table_count(scripts)} tables, "
          f"{len(d_money)} distinct dollar figures")
    print("personas:")
    for n, page in enumerate(pages, start=1):
        print(f"  {n}. opens on {page}")
    print(f"\n{checks} assertions")

    if failures:
        print(f"\n{len(failures)} FAILED:")
        for f in failures:
            print(f"  · {f}")
        sys.exit(1)
    print("all passed")


if __name__ == "__main__":
    main()
