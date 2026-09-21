#!/usr/bin/env python3
"""Shim onto the shared video builder, which lives in the Finance 360 repo.

The pipeline is identical for every 360 application — only the DOMAINS entry and
the segment script differ — so it is owned in one place and both repos point at
it. Keeping a second copy here guaranteed the two would drift, and a timing fix
landing in only one of them is worse than no fix.

Usage:
    python3 tools/video/build.py            # defaults to --domain sales
    python3 tools/video/build.py --phase assemble
"""

import pathlib
import runpy
import sys

SHARED = (pathlib.Path.home() / "Documents" / "SAP" / "SAP Skills" /
          "sap-bdc-finance-360" / "tools" / "video")

if not (SHARED / "build.py").exists():
    raise ImportError(
        f"Shared video builder not found at {SHARED / 'build.py'}.\n"
        "It is owned by the sap-bdc-finance-360 repo. Clone it alongside this "
        "one:\n"
        "  git clone https://github.com/dfreriks-snow/sap-bdc-finance-360 "
        f"{SHARED.parents[1]}"
    )

if __name__ == "__main__":
    # Default this repo to its own domain, while still allowing an override.
    if not any(a.startswith("--domain") for a in sys.argv[1:]):
        sys.argv += ["--domain", "sales"]
    sys.path.insert(0, str(SHARED))
    runpy.run_path(str(SHARED / "build.py"), run_name="__main__")
