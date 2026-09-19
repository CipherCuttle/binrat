#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKER_URL = "https://binrat-edge-v0.pettevik.workers.dev"
WRANGLER = ["pnpm", "dlx", "wrangler@4.135.0"]


def fail(message: str) -> None:
    print(f"RAT_WATCH_DEPLOY_FAIL: {message}", file=sys.stderr)
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
            "user-agent": "Mozilla/5.0 BINRAT-Rat-Watch-Deploy/0.1",
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
    manifest = ROOT / "docs" / "CAPABILITY_MANIFEST_V0.json"

    if not config.exists():
        fail("wrangler.jsonc is missing")
    if not schema.exists():
        fail("cloudflare/schema.sql is missing")

    parsed = json.loads(manifest.read_text())
    rat_watch = parsed.get("capabilities", {}).get("ratWatchV0", {})
    launch = parsed.get("launchAuthorization", {})
    if not (
        rat_watch.get("engineeringStatus") == "BUILDING"
        and rat_watch.get("candidatePr") == 18
        and rat_watch.get("publicStatus") == "NOT_PUBLIC_LIVE_AUTHORIZED"
    ):
        fail("Rat Watch manifest is not in BUILDING / non-public-live candidate state")
    if not (
        launch.get("status") == "BLOCKED"
        and launch.get("marketingAuthorized") is False
        and launch.get("launchAuthorized") is False
        and launch.get("tokenState") == "NOT_LAUNCHED"
    ):
        fail("launch authority is not fail-closed")

    print("Applying idempotent Rat Watch D1 schema...")
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
                "('rat_watch_subscriptions','rat_watch_alerts') "
                "ORDER BY name;"
            ),
            "--config",
            "wrangler.jsonc",
        ],
        capture=True,
    )
    if "rat_watch_subscriptions" not in table_check or "rat_watch_alerts" not in table_check:
        fail("Rat Watch D1 tables were not verified")
    print("RAT_WATCH_D1_SCHEMA: PASS")

    print("Deploying Rat Watch candidate...")
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
    print("RAT_WATCH_CAPABILITY_MANIFEST: PUBLISHED")

    last_health: dict = {}
    last_control: dict = {}
    last_caps: dict = {}
    for attempt in range(30):
        try:
            health = get_json("/api/health")
            control = get_json("/health")
            caps = get_json("/api/capabilities")
            last_health = health
            last_control = control
            last_caps = caps
            remote_watch = caps.get("capabilities", {}).get("ratWatchV0", {})
            remote_launch = caps.get("launchAuthorization", {})
            if (
                health.get("ok") is True
                and health.get("indexReady") is True
                and health.get("observationReady") is True
                and health.get("lastSyncError") is None
                and health.get("lastObservationError") is None
                and control.get("repliesEnabled") is True
                and control.get("launchAuthorization") == "BLOCKED"
                and remote_launch.get("status") == "BLOCKED"
                and remote_launch.get("marketingAuthorized") is False
                and remote_launch.get("launchAuthorized") is False
                and remote_watch.get("engineeringStatus") == "BUILDING"
                and remote_watch.get("publicStatus") == "NOT_PUBLIC_LIVE_AUTHORIZED"
            ):
                print("RAT_WATCH_CANDIDATE_DEPLOY: PASS")
                print("indexReady: true")
                print("observationReady: true")
                print("Telegram replies: true")
                print("Rat Watch: BUILDING / NOT_PUBLIC_LIVE_AUTHORIZED")
                print("launchAuthorization: BLOCKED")
                print("NEXT: private /watches and /watch smoke in @BinratBot")
                return
        except Exception:
            pass
        if attempt == 0:
            print("Waiting for candidate deployment to propagate...")
        time.sleep(2)

    print("LAST_API_HEALTH:", json.dumps(last_health, sort_keys=True))
    print("LAST_CONTROL_HEALTH:", json.dumps(last_control, sort_keys=True))
    print(
        "LAST_RAT_WATCH_CAPABILITY:",
        json.dumps(last_caps.get("capabilities", {}).get("ratWatchV0", {}), sort_keys=True),
    )
    fail("candidate did not converge to the expected fail-closed live state")


if __name__ == "__main__":
    main()
