#!/usr/bin/env python3
"""
Bundle the 14 Sales 360 tables into the application package's SHARED_DATA
schema so the Native App is self-contained (no consumer references).

Modes:
  * local  — CTAS from SAP_SALES_360.SALES_360_L2 into SALES_360_PKG.SHARED_DATA.
  * remote — extract from a SOURCE account, load into a TARGET (EMEA/APAC).
             ~1.4M rows; uses adaptive batch sizes for the large order tables.

Auth uses key-pair connections in ~/.snowflake/connections.toml (names only).

Usage:
  python migrate_data.py --target dfreriksdemo --mode local
  python migrate_data.py --source dfreriksdemo --target dfreriks_eu_demo --mode remote
"""
import argparse
import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

TABLES = [
    "CRM_OPPORTUNITY_ACTIVITY", "CRM_OPPORTUNITY_OPPORTUNITY", "CRM_OPPORTUNITY_SALES_REP",
    "CUSTOMER_CUSTOMER", "PRODUCT_PRODUCT", "PRODUCT_PRODUCTDESCRIPTION", "PRODUCT_PRODUCTGROUP",
    "PRODUCT_PRODUCTGROUPTEXT", "SALESORDERS_SALESORDER", "SALESORDERS_SALESORDERITEM",
    "SALES_FORECAST_VS_ACTUAL", "SALES_REVENUE_PREDICTIONS", "SALES_REVENUE_FORECAST_METRICS",
    "ATTAINMENT_PREDICTIONS",
]
SRC_SCHEMA = "SAP_SALES_360.SALES_360_L2"
PKG = "SALES_360_PKG"


def connect(conn_name, **kw):
    import tomllib, os
    with open(os.path.expanduser("~/.snowflake/connections.toml"), "rb") as f:
        cfg = tomllib.load(f)[conn_name]
    with open(cfg["private_key_path"], "rb") as f:
        pk = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
    der = pk.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8,
                           serialization.NoEncryption())
    return snowflake.connector.connect(account=cfg["account"], user=cfg["user"], private_key=der,
                                       role=cfg.get("role", "ACCOUNTADMIN"), paramstyle="qmark", **kw)


def ensure_pkg(cur):
    cur.execute(f"CREATE APPLICATION PACKAGE IF NOT EXISTS {PKG}")
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {PKG}.SHARED_DATA")
    cur.execute(f"GRANT USAGE ON SCHEMA {PKG}.SHARED_DATA TO SHARE IN APPLICATION PACKAGE {PKG}")


def local_bundle(target, wh):
    conn = connect(target, warehouse=wh) if wh else connect(target)
    cur = conn.cursor()
    if wh:
        cur.execute(f"USE WAREHOUSE {wh}")
    ensure_pkg(cur)
    for name in TABLES:
        cur.execute(f"CREATE OR REPLACE TABLE {PKG}.SHARED_DATA.{name} AS SELECT * FROM {SRC_SCHEMA}.{name}")
        cur.execute(f"GRANT SELECT ON TABLE {PKG}.SHARED_DATA.{name} TO SHARE IN APPLICATION PACKAGE {PKG}")
        cur.execute(f"SELECT COUNT(*) FROM {PKG}.SHARED_DATA.{name}")
        print(f"  {target}/{name}: {cur.fetchone()[0]} rows")
    cur.close(); conn.close()


def remote_bundle(source, target, wh):
    s = connect(source); sc = s.cursor()
    extract = {}
    for name in TABLES:
        fqn = f"{SRC_SCHEMA}.{name}"
        sc.execute(f"DESCRIBE TABLE {fqn}")
        desc = sc.fetchall(); coldefs = [(r[0], r[1]) for r in desc]; cols = [r[0] for r in desc]
        sc.execute(f'SELECT {", ".join(chr(34)+c+chr(34) for c in cols)} FROM {fqn}')
        extract[name] = (coldefs, cols, sc.fetchall())
        print(f"  extracted {name}: {len(extract[name][2])} rows")
    sc.close(); s.close()
    t = connect(target, warehouse=wh); tc = t.cursor(); tc.execute(f"USE WAREHOUSE {wh}")
    ensure_pkg(tc)
    for name, (coldefs, cols, rows) in extract.items():
        col_sql = ", ".join(f'"{c}" {ty}' for c, ty in coldefs)
        tc.execute(f"CREATE OR REPLACE TABLE {PKG}.SHARED_DATA.{name} ({col_sql})")
        ncol = len(cols)
        ch = max(2000, min(8000, 500000 // ncol))   # adaptive batch: fewer round-trips for narrow tables
        ph = "(" + ",".join(["?"] * ncol) + ")"; collist = ", ".join('"'+c+'"' for c in cols)
        ins = f'INSERT INTO {PKG}.SHARED_DATA.{name} ({collist}) VALUES {ph}'
        for i in range(0, len(rows), ch):
            tc.executemany(ins, rows[i:i+ch])
        tc.execute(f"GRANT SELECT ON TABLE {PKG}.SHARED_DATA.{name} TO SHARE IN APPLICATION PACKAGE {PKG}")
        tc.execute(f"SELECT COUNT(*) FROM {PKG}.SHARED_DATA.{name}")
        print(f"  {target}/{name}: {tc.fetchone()[0]} rows")
    tc.close(); t.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source"); ap.add_argument("--target", required=True)
    ap.add_argument("--mode", choices=["local", "remote"], default="local")
    ap.add_argument("--warehouse", default="COMPUTE_WH")
    a = ap.parse_args()
    if a.mode == "local":
        local_bundle(a.target, a.warehouse)
    else:
        assert a.source, "--source required for remote mode"
        remote_bundle(a.source, a.target, a.warehouse)
    print("DONE")
