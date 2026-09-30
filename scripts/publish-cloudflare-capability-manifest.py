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
    print(f"MANIFEST_PUBLISH_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def get_json(path: str) -> dict:
    request = urllib.request.Request(
        f"{WORKER_URL}{path}",
        headers={
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 BINRAT-Manifest-Publish/0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        value = json.loads(response.read().decode("utf-8"))
    if not isinstance(value, dict):
        fail(f"{path} returned non-object JSON")
    return value


def main() -> None:
    manifest_path = ROOT / "docs" / "CAPABILITY_MANIFEST_V0.json"
    manifest = json.loads(manifest_path.read_text())
    launch = manifest.get("launchAuthorization", {})
    telegram = manifest.get("capabilities", {}).get("telegramRatV0", {})

    if not (
        launch.get("status") == "BLOCKED"
        and launch.get("marketingAuthorized") is False
        and launch.get("launchAuthorized") is False
        and launch.get("tokenState") == "NOT_LAUNCHED"
    ):
        fail("canonical launch authority is not fail-closed")

    expected = {
        "engineeringStatus": "ENGINEERING_PASS",
        "deploymentStatus": "CLOUDFLARE_LIVE_VERIFIED",
        "publicStatus": "PUBLIC_LIVE_BETA",
    }
    for key, value in expected.items():
        if telegram.get(key) != value:
            fail(f"telegramRatV0 {key} is not {value}")

    compact = json.dumps(manifest, separators=(",", ":")) + "\n"
    result = subprocess.run(
        WRANGLER
        + [
            "secret",
            "put",
            "CAPABILITY_MANIFEST_JSON",
            "--config",
            "wrangler.jsonc",
        ],
        cwd=ROOT,
        input=compact,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        fail("Wrangler secret put failed")

    for _ in range(30):
        try:
            health = get_json("/health")
            capabilities = get_json("/api/capabilities")
            remote_telegram = capabilities.get("capabilities", {}).get("telegramRatV0", {})
            remote_launch = capabilities.get("launchAuthorization", {})
            if (
                health.get("capabilityStatus") == "ENGINEERING_PASS"
                and health.get("launchAuthorization") == "BLOCKED"
                and health.get("repliesEnabled") is True
                and remote_telegram.get("deploymentStatus") == "CLOUDFLARE_LIVE_VERIFIED"
                and remote_telegram.get("publicStatus") == "PUBLIC_LIVE_BETA"
                and remote_launch.get("status") == "BLOCKED"
                and remote_launch.get("marketingAuthorized") is False
                and remote_launch.get("launchAuthorized") is False
            ):
                print("CAPABILITY_MANIFEST_LIVE: PASS")
                print("telegramRatV0: ENGINEERING_PASS / CLOUDFLARE_LIVE_VERIFIED / PUBLIC_LIVE_BETA")
                print("repliesEnabled: true")
                print("launchAuthorization: BLOCKED")
                return
        except Exception:
            pass
        time.sleep(2)

    fail("live Worker did not converge to the canonical capability manifest")


if __name__ == "__main__":
    main()
