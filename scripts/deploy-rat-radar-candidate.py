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
WRANGLER = ["npx", "-y", "wrangler@4.135.0"]


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

    last_service_health: dict = {}
    last_api_health: dict = {}
    last_caps: dict = {}
    deployment_ready = False

    for attempt in range(45):
        try:
            service_health = get_json("/health")
            api_health = get_json("/api/health")
            caps = get_json("/api/capabilities")
            last_service_health = service_health
            last_api_health = api_health
            last_caps = caps
            remote_radar = caps.get("capabilities", {}).get("ratRadarV0", {})
            remote_launch = caps.get("launchAuthorization", {})
            deployment_ready = (
                service_health.get("ok") is True
                and service_health.get("service") == "binrat-cloudflare-edge"
                and remote_launch.get("status") == "BLOCKED"
                and remote_launch.get("marketingAuthorized") is False
                and remote_launch.get("launchAuthorized") is False
                and remote_radar.get("engineeringStatus") == "BUILDING"
                and remote_radar.get("publicStatus") == "NOT_PUBLIC_LIVE_AUTHORIZED"
            )
            if deployment_ready:
                break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass
        if attempt == 0:
            print("Waiting for candidate deployment to propagate...")
        time.sleep(2)

    if not deployment_ready:
        print("LAST_SERVICE_HEALTH:", json.dumps(last_service_health, sort_keys=True))
        print("LAST_API_HEALTH:", json.dumps(last_api_health, sort_keys=True))
        print(
            "LAST_RAT_RADAR_CAPABILITY:",
            json.dumps(last_caps.get("capabilities", {}).get("ratRadarV0", {}), sort_keys=True),
        )
        fail("candidate Worker/capability state did not converge")

    print("RAT_RADAR_CANDIDATE_DEPLOY: PASS")
    print("launchAuthorization: BLOCKED")
    print("RAT_RADAR_API_HEALTH:", json.dumps(last_api_health, sort_keys=True))

    if (
        last_api_health.get("ok") is True
        and last_api_health.get("indexReady") is True
        and last_api_health.get("lastSyncError") is None
    ):
        try:
            radar_api = get_json("/api/rat-radar/watchlist")
            if (
                radar_api.get("schemaVersion") == "binrat.rat-radar-watchlist/0.1"
                and radar_api.get("method", {}).get("evidencedRole") == "V3_SWAP_RECIPIENT"
            ):
                print("RAT_RADAR_RUNTIME: READY")
                print("Rat Radar API: PASS")
                print(
                    "Rat Radar coverage:",
                    json.dumps(radar_api.get("coverage", {}), sort_keys=True),
                )
            else:
                print("RAT_RADAR_RUNTIME: API_MISMATCH")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            print("RAT_RADAR_RUNTIME: READY_BUT_PUBLIC_SMOKE_UNAVAILABLE")
    else:
        print("RAT_RADAR_RUNTIME: PENDING_SYNC_CATCHUP")

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
                "SELECT COUNT(*) AS swap_receipt_count FROM rat_radar_swap_receipts; "
                "SELECT chain_id,source_verified,live_caught_up,last_sync_error,updated_at_ms "
                "FROM binrat_runtime_state WHERE chain_id = 5042;"
            ),
            "--config",
            "wrangler.jsonc",
        ]
    )
    print("NEXT: public smoke until runtime becomes READY, then inspect real address distribution")


if __name__ == "__main__":
    main()
