#!/usr/bin/env python3
"""Extract every figure the Sales 360 deliverables quote, with its provenance.

Same contract as the Finance 360 extractor: nothing in the kit or deck is typed in
by hand, each figure is pulled live and stamped with the query that produced it.

Sales 360 is NOT shaped like Finance 360, and the differences are the interesting
part rather than an inconvenience:

  - SAP_BDC_L1 here is 31 plain tables holding ~2.55M rows. It is a materialised
    copy of the share, not a passthrough view layer. The "no copy anywhere" line
    that fits Finance is false here and must not be used.
  - Ten L2 dynamic tables carry row counts identical to their L1 counterparts, so
    those rows are materialised twice inside Snowflake, on top of the share.
  - There is a real Cortex Agent object, which Finance does not have.
  - Three L2 tables are plain ML outputs, so they do not refresh with the rest.

Writes /tmp/sales_facts.json.

Usage:
    python3 tools/sales_facts.py [--print]
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import gzip
import json
import pathlib
import re
import sys
import tempfile
import tomllib

import snowflake.connector
import yaml

CONN = "dfreriksdemo"
DB = "SAP_SALES_360"
APP_DB = "SALES_360_APP"
L1 = "SAP_BDC_L1"
L2 = "SALES_360_L2"
OUT = pathlib.Path("/tmp/sales_facts.json")
REPO = "https://github.com/dfreriks-snow/sap-bdc-sales-360"
APP = pathlib.Path.home() / "Documents" / "SAP" / "SAP Skills" / "sales_360_react"
SIDEBAR = APP / "client" / "src" / "components" / "Sidebar.tsx"
API_ROUTES = APP / "server" / "src" / "routes" / "api.ts"
SEMANTIC_VIEW = f"{DB}.SEMANTIC.SAP_SALES_360_ANALYTICS"
AGENT = f"{DB}.SEMANTIC.SAP_SALES_360_AGENT"
ANALYST_STAGE = f"{DB}.SEMANTIC.SEMANTIC_STAGE"
ANALYST_MODEL = "sap_sales_360_semantic.yaml"


def conn_params(name: str) -> dict:
    path = pathlib.Path.home() / ".snowflake" / "connections.toml"
    cfg = tomllib.loads(path.read_text())
    if name not in cfg:
        sys.exit(f"connection {name!r} not in {path}")
    c = dict(cfg[name])
    if "private_key_path" in c:
        c["private_key_file"] = str(pathlib.Path(c.pop("private_key_path")).expanduser())
    c.pop("database", None)
    c.pop("schema", None)
    return c


class Facts:
    def __init__(self, cur):
        self.cur = cur
        self.data: dict = {}
        self.provenance: dict = {}

    def sql_one(self, key, sql, source):
        self.cur.execute(sql)
        row = self.cur.fetchone()
        val = row[0] if row and len(row) == 1 else (list(row) if row else None)
        return self.put(key, val, source)

    def sql_rows(self, key, sql, source):
        self.cur.execute(sql)
        cols = [d[0] for d in self.cur.description]
        return self.put(key, [{c: v for c, v in zip(cols, r)}
                              for r in self.cur.fetchall()], source)

    def put(self, key, value, source):
        self.data[key] = self._clean(value)
        self.provenance[key] = source
        return self.data[key]

    @staticmethod
    def _clean(v):
        if isinstance(v, (dt.date, dt.datetime)):
            return v.isoformat()[:10]
        if isinstance(v, list):
            return [Facts._clean(x) for x in v]
        if isinstance(v, dict):
            return {k: Facts._clean(x) for k, x in v.items()}
        if hasattr(v, "normalize"):
            return float(v)
        return v


def collect(cur) -> Facts:
    f = Facts(cur)
    IS = f"{DB}.INFORMATION_SCHEMA"

    # ---- layer shape --------------------------------------------------------
    f.sql_one("schemas", f"""
        SELECT COUNT(*) FROM {IS}.SCHEMATA
        WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA','PUBLIC')""",
        "INFORMATION_SCHEMA.SCHEMATA")

    for label, schema in (("l1", L1), ("l2", L2)):
        cur.execute(f"SHOW DYNAMIC TABLES IN SCHEMA {DB}.{schema}")
        dyn = sorted(r[1] for r in cur.fetchall())
        objs = f.sql_rows(f"{label}_objects", f"""
            SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT FROM {IS}.TABLES
            WHERE TABLE_SCHEMA='{schema}' ORDER BY ROW_COUNT DESC NULLS LAST""",
            f"INFORMATION_SCHEMA.TABLES, {schema}")
        f.put(f"{label}_table_count", len(objs), f"INFORMATION_SCHEMA.TABLES, {schema}")
        f.put(f"{label}_rows", sum(o["ROW_COUNT"] or 0 for o in objs),
              f"sum of ROW_COUNT, {schema}")
        f.put(f"{label}_dynamic", dyn, f"SHOW DYNAMIC TABLES IN {schema}")
        f.put(f"{label}_dynamic_count", len(dyn), f"SHOW DYNAMIC TABLES IN {schema}")
        f.put(f"{label}_plain", sorted({o["TABLE_NAME"] for o in objs} - set(dyn)),
              f"{schema} tables minus SHOW DYNAMIC TABLES")

    # L1 is materialised, so the zero-copy claim does not survive here.
    f.put("l1_is_materialised", f.data["l1_dynamic_count"] == 0 and f.data["l1_rows"] > 0,
          "L1 has 0 dynamic tables and a non-zero row count")

    # ---- the duplication between L1 and L2 ----------------------------------
    l1r = {o["TABLE_NAME"]: o["ROW_COUNT"] for o in f.data["l1_objects"]}
    l2r = {o["TABLE_NAME"]: o["ROW_COUNT"] for o in f.data["l2_objects"]}
    shared = sorted(set(l1r) & set(l2r))
    same = [n for n in shared if l1r[n] == l2r[n]]
    f.put("l1_l2_shared_names", shared, "name intersection of L1 and L2")
    f.put("l1_l2_identical_counts", same, "shared names with equal ROW_COUNT")
    f.put("l1_l2_duplicated_rows", sum(l2r[n] or 0 for n in same),
          "sum of L2 rows for tables whose count equals L1")

    # ---- semantic view ------------------------------------------------------
    cur.execute(f"DESCRIBE SEMANTIC VIEW {SEMANTIC_VIEW}")
    cols = [d[0] for d in cur.description]
    rws = cur.fetchall()
    kinds = collections.Counter(str(r[cols.index("object_kind")]) for r in rws)
    f.put("semantic_view", {
        "name": SEMANTIC_VIEW,
        "tables": kinds.get("TABLE", 0), "dimensions": kinds.get("DIMENSION", 0),
        "facts": kinds.get("FACT", 0), "metrics": kinds.get("METRIC", 0),
        "relationships": kinds.get("RELATIONSHIP", 0),
    }, "DESCRIBE SEMANTIC VIEW")

    # ---- what Cortex Analyst reads -----------------------------------------
    model = {"stage_file": f"{ANALYST_STAGE}/{ANALYST_MODEL}"}
    try:
        tmp = tempfile.mkdtemp()
        cur.execute(f"GET @{ANALYST_STAGE}/{ANALYST_MODEL} file://{tmp}")
        p = pathlib.Path(tmp) / ANALYST_MODEL
        text = (p.read_text() if p.exists()
                else gzip.decompress(next(pathlib.Path(tmp).glob("*.gz")).read_bytes()).decode())
        y = yaml.safe_load(text) or {}
        tabs = y.get("tables") or []
        model.update(
            name=y.get("name"), tables=[t.get("name") for t in tabs],
            dimensions=sum(len(t.get("dimensions") or []) for t in tabs),
            facts=sum(len(t.get("facts") or []) for t in tabs),
            measures=sum(len(t.get("measures") or []) for t in tabs),
            verified_queries=len(y.get("verified_queries") or []),
        )
    except Exception as e:  # noqa: BLE001
        model["error"] = str(e)[:120]
    f.put("analyst_model", model, f"GET @{ANALYST_STAGE} + parse YAML")

    # ---- the Cortex Agent (Sales has one, Finance does not) -----------------
    agent = {"name": AGENT}
    try:
        cur.execute(f"DESCRIBE AGENT {AGENT}")
        cc = [d[0] for d in cur.description]
        row = dict(zip(cc, cur.fetchone()))
        spec = row.get("agent_spec") or "{}"
        agent.update(comment=row.get("comment"),
                     versions=row.get("versions"),
                     default_version=row.get("default_version_name"))
        try:
            parsed = json.loads(spec)
            agent["orchestration"] = (parsed.get("models") or {}).get("orchestration")
            tools = parsed.get("tools") or []
            agent["tools"] = [t.get("tool_spec", {}).get("type") or t.get("type")
                              for t in tools] if isinstance(tools, list) else []
            agent["tool_count"] = len(agent["tools"])
        except json.JSONDecodeError:
            agent["spec_parse"] = "agent_spec truncated by DESCRIBE"
    except Exception as e:  # noqa: BLE001
        agent["error"] = str(e)[:120]
    f.put("cortex_agent", agent, f"DESCRIBE AGENT {AGENT}")

    # ---- app surface --------------------------------------------------------
    pages = []
    if SIDEBAR.exists():
        pages = [m.group(2) for m in re.finditer(
            r"""id:\s*['"]([\w-]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]""",
            SIDEBAR.read_text())]
    f.put("app_pages", pages, "Sidebar.tsx nav array (id/label pairs)")
    f.put("app_page_count", len(pages), "Sidebar.tsx nav array")

    sources: dict = {}
    if API_ROUTES.exists():
        for m in re.finditer(r"FROM\s+([A-Z_0-9]+)\.([A-Za-z_0-9]+)\.([A-Za-z_0-9]+)",
                             API_ROUTES.read_text()):
            key = ".".join(m.groups())
            sources[key] = sources.get(key, 0) + 1
    f.put("app_data_sources", dict(sorted(sources.items(), key=lambda kv: -kv[1])),
          "api.ts FROM clauses")
    f.put("app_reads_l2", sum(n for k, n in sources.items() if f".{L2}." in k),
          f"api.ts FROM clauses on {L2}")
    f.put("app_reads_l1", sum(n for k, n in sources.items() if f".{L1}." in k),
          f"api.ts FROM clauses on {L1}")
    f.put("app_reads_share_directly",
          sum(n for k, n in sources.items() if k.startswith("SAP_BDC_DEMO_")),
          "api.ts FROM clauses on SAP_BDC_DEMO_*")

    # ---- data windows -------------------------------------------------------
    windows = {}
    for tbl, col in (("CRM_OPPORTUNITY_OPPORTUNITY", "CLOSE_DATE"),
                     ("SALESORDERS_SALESORDER", "SALESORDERDATE"),
                     ("SALES_FORECAST_VS_ACTUAL", "PERIOD_DATE")):
        cur.execute(f"SELECT MIN({col}), MAX({col}), COUNT(*) FROM {DB}.{L2}.{tbl}")
        lo, hi, n = cur.fetchone()
        windows[tbl] = {"column": col, "min": Facts._clean(lo),
                        "max": Facts._clean(hi), "rows": n}
    f.put("data_windows", windows, f"MIN/MAX over {L2} fact tables")

    # ---- business figures ---------------------------------------------------
    f.sql_rows("pipeline_by_stage", f"""
        SELECT STAGE_NAME, COUNT(*) AS OPPS, SUM(AMOUNT) AS AMOUNT,
               AVG(PROBABILITY) AS AVG_PROB
        FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE NOT IS_CLOSED GROUP BY 1 ORDER BY 3 DESC NULLS LAST""",
        "GROUP BY STAGE_NAME where NOT IS_CLOSED")
    f.sql_one("open_pipeline", f"""
        SELECT SUM(AMOUNT) FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE NOT IS_CLOSED""", "SUM(AMOUNT) where NOT IS_CLOSED")
    f.sql_rows("win_loss", f"""
        SELECT IS_WON, COUNT(*) AS OPPS, SUM(AMOUNT) AS AMOUNT
        FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE IS_CLOSED GROUP BY 1 ORDER BY 1""",
        "GROUP BY IS_WON where IS_CLOSED")
    f.sql_one("opportunity_count",
              f"SELECT COUNT(*) FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY",
              "COUNT(*), CRM_OPPORTUNITY_OPPORTUNITY")
    f.sql_one("sales_reps",
              f"SELECT COUNT(*) FROM {DB}.{L2}.CRM_OPPORTUNITY_SALES_REP",
              "COUNT(*), CRM_OPPORTUNITY_SALES_REP")
    f.sql_one("quota_total",
              f"SELECT SUM(QUOTA_AMOUNT) FROM {DB}.{L2}.CRM_OPPORTUNITY_SALES_REP",
              "SUM(QUOTA_AMOUNT), CRM_OPPORTUNITY_SALES_REP")
    f.sql_one("order_value_total",
              f"SELECT COUNT(*) FROM {DB}.{L2}.SALESORDERS_SALESORDER",
              "COUNT(*), SALESORDERS_SALESORDER")
    f.sql_rows("forecast_attainment", f"""
        SELECT FISCAL_YEAR,
               SUM(FORECAST_AMOUNT) AS FORECAST, SUM(ACTUAL_AMOUNT) AS ACTUAL,
               SUM(VARIANCE_AMOUNT) AS VARIANCE, AVG(ATTAINMENT_PCT) AS AVG_ATTAINMENT
        FROM {DB}.{L2}.SALES_FORECAST_VS_ACTUAL GROUP BY 1 ORDER BY 1""",
        "GROUP BY FISCAL_YEAR, SALES_FORECAST_VS_ACTUAL")

    # win rate, computed rather than quoted from a doc
    wl = {bool(r["IS_WON"]): r for r in f.data["win_loss"]}
    won, lost = wl.get(True, {}).get("OPPS", 0) or 0, wl.get(False, {}).get("OPPS", 0) or 0
    won_amt = wl.get(True, {}).get("AMOUNT", 0) or 0
    lost_amt = wl.get(False, {}).get("AMOUNT", 0) or 0
    f.put("win_rate_pct", round(100 * won / (won + lost), 1) if (won + lost) else None,
          "won / (won + lost) over closed opportunities")
    # Win rate by count flatters the picture: more deals are won than lost, but more
    # value is lost than won. Both numbers are needed or the story is misleading.
    f.put("win_rate_value_pct",
          round(100 * won_amt / (won_amt + lost_amt), 1) if (won_amt + lost_amt) else None,
          "won amount / (won + lost amount)")
    f.sql_rows("deal_size", f"""
        SELECT IS_WON, COUNT(*) AS OPPS, SUM(AMOUNT) AS AMOUNT, AVG(AMOUNT) AS AVG_DEAL
        FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY WHERE IS_CLOSED
        GROUP BY 1 ORDER BY 1 DESC""",
        "AVG(AMOUNT) by IS_WON over closed opportunities")

    # ---- is the pipeline actually forward-looking? --------------------------
    # It is not. Every open opportunity sits behind its own close date, so any
    # forward pipeline or commit story is invalid as shipped.
    cur.execute(f"""
        SELECT COUNT(*), COALESCE(SUM(AMOUNT),0) FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE NOT IS_CLOSED AND CLOSE_DATE < CURRENT_DATE()""")
    n_past, amt_past = cur.fetchone()
    cur.execute(f"""
        SELECT COUNT(*), COALESCE(SUM(AMOUNT),0) FROM {DB}.{L2}.CRM_OPPORTUNITY_OPPORTUNITY
        WHERE NOT IS_CLOSED AND CLOSE_DATE >= CURRENT_DATE()""")
    n_future, amt_future = cur.fetchone()
    f.put("open_opps_past_due", n_past, "NOT IS_CLOSED AND CLOSE_DATE < CURRENT_DATE()")
    f.put("open_amount_past_due", amt_past, "NOT IS_CLOSED AND CLOSE_DATE < CURRENT_DATE()")
    f.put("open_opps_future", n_future, "NOT IS_CLOSED AND CLOSE_DATE >= CURRENT_DATE()")
    f.put("pipeline_is_entirely_past_due", n_future == 0 and n_past > 0,
          "no open opportunity has a future close date")

    # ---- forecast attainment spread -----------------------------------------
    # The annual averages all land near 95%, which looks synthetic until you look
    # at the monthly spread — it is genuinely variable, so the flatness is an
    # artefact of averaging, not of the data being constant.
    cur.execute(f"""
        SELECT ROUND(MIN(ATTAINMENT_PCT),2), ROUND(MAX(ATTAINMENT_PCT),2),
               ROUND(STDDEV(ATTAINMENT_PCT),2)
        FROM {DB}.{L2}.SALES_FORECAST_VS_ACTUAL""")
    lo, hi, sd = cur.fetchone()
    f.put("attainment_spread", {"min": float(lo), "max": float(hi), "stddev": float(sd)},
          "MIN/MAX/STDDEV of ATTAINMENT_PCT")

    # ---- environment --------------------------------------------------------
    try:
        cur.execute(f"CALL {APP_DB}.CORE.APP_URL()")
        f.put("app_url", cur.fetchone()[0], f"CALL {APP_DB}.CORE.APP_URL()")
    except Exception as e:  # noqa: BLE001
        f.put("app_url", None, f"unavailable: {str(e)[:60]}")
    cur.execute("SELECT CURRENT_ACCOUNT(), CURRENT_REGION()")
    acct, region = cur.fetchone()
    f.put("account", acct, "CURRENT_ACCOUNT()")
    f.put("region", region, "CURRENT_REGION()")
    f.put("repo", REPO, "constant")
    f.put("verified_on", dt.date.today().isoformat(), "extraction date")
    return f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true", dest="show")
    args = ap.parse_args()

    cn = snowflake.connector.connect(**conn_params(CONN))
    try:
        f = collect(cn.cursor())
    finally:
        cn.close()

    OUT.write_text(json.dumps({"facts": f.data, "provenance": f.provenance}, indent=2))
    print(f"wrote {OUT}  ({len(f.data)} facts)")

    if args.show:
        print(f"\n{'figure':30s} {'value':<42s} source")
        print("-" * 112)
        for k, v in f.data.items():
            s = json.dumps(v) if not isinstance(v, (str, int, float, bool, type(None))) else str(v)
            if len(s) > 40:
                s = s[:37] + "..."
            print(f"{k:30s} {s:<42s} {f.provenance[k][:38]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
