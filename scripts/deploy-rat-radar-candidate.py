#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKER_URL = "https://binrat-edge-v0.pettevik.workers.dev"
WRANGLER = ["pnpm", "dlx", "wrangler@4.135.0"]


def fail(message: str) -> None:
    print(f"RAT_RADAR_DEPLOY_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(
    args: list[str],
    *,
    capture: bool = False,
    input_text: str | None = None,
) -> str:
    result = subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        input=input_text,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
        check=False,
    )
    if result.returncode != 0:
        if capture and result.stdout:
            print(result.stdout)
        fail(f"command failed: {' '.join(args[:5])} ...")
    return result.stdout or ""


def get_json(path: str) -> dict:
    request = urllib.request.Request(
        f"{WORKER_URL}{path}",
        headers={
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 BINRAT-Rat-Radar-Deploy/0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        value = json.loads(response.read().decode("utf-8"))
    if not isinstance(value, dict):
        fail(f"{path} returned non-object JSON")
    return value


def main() -> None:
    config = ROOT / "wrangler.jsonc"
    schema = ROOT / "cloudflare" / "schema.sql"
    manifest_path = ROOT / "docs" / "CAPABILITY_MANIFEST_V0.json"

    if not config.exists():
        fail("wrangler.jsonc is missing")
    if not schema.exists():
        fail("cloudflare/schema.sql is missing")
    if not manifest_path.exists():
        fail("capability manifest is missing")

    parsed = json.loads(manifest_path.read_text())
    radar = parsed.get("capabilities", {}).get("ratRadarV0", {})
    launch = parsed.get("launchAuthorization", {})
    if not (
        radar.get("engineeringStatus") == "BUILDING"
        and radar.get("publicStatus") == "NOT_PUBLIC_LIVE_AUTHORIZED"
        and radar.get("launchUtilityPriority") is True
    ):
        fail("Rat Radar manifest is not in BUILDING / non-public-live candidate state")
    if not (
        launch.get("status") == "BLOCKED"
        and launch.get("marketingAuthorized") is False
        and launch.get("launchAuthorized") is False
        and launch.get("tokenState") == "NOT_LAUNCHED"
    ):
        fail("launch authority is not fail-closed")

    print("Applying idempotent Rat Radar D1 schema...")
    run(
        WRANGLER
        + [
            "d1",
            "execute",
            "DB",
            "--remote",
            "--yes",
            "--file",
            "cloudflare/schema.sql",
            "--config",
            "wrangler.jsonc",
        ]
    )

    table_check = run(
        WRANGLER
        + [
            "d1",
            "execute",
            "DB",
            "--remote",
            "--yes",
            "--json",
            "--command",
            (
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name IN "
                "('rat_radar_swap_receipts','rat_radar_pool_cursors') "
                "ORDER BY name;"
            ),
            "--config",
            "wrangler.jsonc",
        ],
        capture=True,
    )
    if "rat_radar_swap_receipts" not in table_check or "rat_radar_pool_cursors" not in table_check:
        fail("Rat Radar D1 tables were not verified")
    print("RAT_RADAR_D1_SCHEMA: PASS")

    print("Deploying Rat Radar candidate...")
    run(WRANGLER + ["deploy", "--config", "wrangler.jsonc"])

    print("Publishing candidate capability manifest...")
    compact_manifest = json.dumps(parsed, separators=(",", ":")) + "\n"
    run(
        WRANGLER
        + [
            "secret",
            "put",
            "CAPABILITY_MANIFEST_JSON",
            "--config",
            "wrangler.jsonc",
        ],
        input_text=compact_manifest,
    )
    print("RAT_RADAR_CAPABILITY_MANIFEST: PUBLISHED")

    last_health: dict = {}
    last_caps: dict = {}
    last_radar: dict = {}
    for attempt in range(30):
        try:
            health = get_json("/api/health")
            caps = get_json("/api/capabilities")
            radar_api = get_json("/api/rat-radar/watchlist")
            last_health = health
            last_caps = caps
            last_radar = radar_api
            remote_radar = caps.get("capabilities", {}).get("ratRadarV0", {})
            remote_launch = caps.get("launchAuthorization", {})
            if (
                health.get("ok") is True
                and health.get("indexReady") is True
                and health.get("lastSyncError") is None
                and remote_launch.get("status") == "BLOCKED"
                and remote_launch.get("marketingAuthorized") is False
                and remote_launch.get("launchAuthorized") is False
                and remote_radar.get("engineeringStatus") == "BUILDING"
                and remote_radar.get("publicStatus") == "NOT_PUBLIC_LIVE_AUTHORIZED"
                and radar_api.get("schemaVersion") == "binrat.rat-radar-watchlist/0.1"
                and radar_api.get("method", {}).get("evidencedRole") == "V3_SWAP_RECIPIENT"
            ):
                print("RAT_RADAR_CANDIDATE_DEPLOY: PASS")
                print("indexReady: true")
                print("Rat Radar API: PASS")
                print(
                    "Rat Radar coverage:",
                    json.dumps(radar_api.get("coverage", {}), sort_keys=True),
                )
                print("launchAuthorization: BLOCKED")
                print("D1 Rat Radar snapshot:")
                run(
                    WRANGLER
                    + [
                        "d1",
                        "execute",
                        "DB",
                        "--remote",
                        "--yes",
                        "--command",
                        (
                            "SELECT COUNT(*) AS cursor_count, "
                            "SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) AS cursor_errors "
                            "FROM rat_radar_pool_cursors; "
                            "SELECT COUNT(*) AS swap_receipt_count FROM rat_radar_swap_receipts;"
                        ),
                        "--config",
                        "wrangler.jsonc",
                    ]
                )
                print("NEXT: verify cursor advancement and inspect /api/rat-radar/watchlist after queue cycles")
                return
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass
        if attempt == 0:
            print("Waiting for candidate deployment to propagate...")
        time.sleep(2)

    print("LAST_API_HEALTH:", json.dumps(last_health, sort_keys=True))
    print(
        "LAST_RAT_RADAR_CAPABILITY:",
        json.dumps(last_caps.get("capabilities", {}).get("ratRadarV0", {}), sort_keys=True),
    )
    print("LAST_RAT_RADAR_API:", json.dumps(last_radar, sort_keys=True))
    fail("candidate did not converge to the expected fail-closed live state")


if __name__ == "__main__":
    main()
