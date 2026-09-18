#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "wrangler.jsonc"
BACKUP = Path("/tmp/binrat-wrangler-before-web-assets.jsonc")
WORKER_URL = "https://binrat-edge-v0.pettevik.workers.dev"
WRANGLER = ["pnpm", "dlx", "wrangler@4.135.0"]


def fail(message: str) -> None:
    print(f"WEB_EDGE_DEPLOY_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def get(path: str) -> tuple[int | None, str]:
    request = urllib.request.Request(
        f"{WORKER_URL}{path}",
        headers={
            "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "user-agent": "Mozilla/5.0 BINRAT-Web-Edge-Verify/0.1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception:
        return None, ""


def parse_json(text: str) -> dict:
    import json
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        fail("live endpoint returned invalid JSON")
    if not isinstance(value, dict):
        fail("live endpoint returned non-object JSON")
    return value


def patch_config() -> None:
    if not CONFIG.exists():
        fail("wrangler.jsonc is missing")

    text = CONFIG.read_text()
    if '"name": "binrat-edge-v0"' not in text:
        fail("unexpected Worker name")
    if '"TELEGRAM_REPLIES_ENABLED": "true"' not in text:
        fail("Telegram replies are not enabled; refusing to alter deployment topology")

    shutil.copy2(CONFIG, BACKUP)

    if '"assets"' not in text:
        anchor = '  "compatibility_flags": ["nodejs_compat"],\n'
        if anchor not in text:
            fail("could not find compatibility_flags insertion point")
        text = text.replace(
            anchor,
            anchor + '  "assets": {\n    "directory": "./web"\n  },\n',
            1,
        )
    elif '"directory": "./web"' not in text:
        fail("wrangler.jsonc already has a different assets configuration")

    pattern = re.compile(r'("BINRAT_PUBLIC_SITE_URL"\s*:\s*)"[^"]*"')
    if not pattern.search(text):
        fail("BINRAT_PUBLIC_SITE_URL is missing")
    text = pattern.sub(
        lambda match: match.group(1) + f'"{WORKER_URL}"',
        text,
        count=1,
    )

    CONFIG.write_text(text)
    print(f"CONFIG_BACKUP: {BACKUP}")
    print('ASSETS_DIRECTORY: ./web')
    print(f"BINRAT_PUBLIC_SITE_URL: {WORKER_URL}")


def deploy() -> None:
    result = subprocess.run(
        WRANGLER + ["deploy", "--config", "wrangler.jsonc"],
        cwd=ROOT,
        check=False,
    )
    if result.returncode != 0:
        fail("Wrangler deploy failed")


def verify() -> None:
    for attempt in range(30):
        home_status, home = get("/")
        api_status, api_raw = get("/api/health")
        control_status, control_raw = get("/health")
        cap_status, cap_raw = get("/api/capabilities")

        if all(status == 200 for status in (home_status, api_status, control_status, cap_status)):
            api = parse_json(api_raw)
            control = parse_json(control_raw)
            capabilities = parse_json(cap_raw)
            rat = capabilities.get("capabilities", {}).get("telegramRatV0", {})
            launch = capabilities.get("launchAuthorization", {})

            if (
                "<title>BINRAT — The Dumpster</title>" in home
                and api.get("ok") is True
                and api.get("indexReady") is True
                and api.get("observationReady") is True
                and api.get("lastSyncError") is None
                and api.get("lastObservationError") is None
                and control.get("repliesEnabled") is True
                and control.get("capabilityStatus") == "ENGINEERING_PASS"
                and control.get("launchAuthorization") == "BLOCKED"
                and rat.get("deploymentStatus") == "CLOUDFLARE_LIVE_VERIFIED"
                and rat.get("publicStatus") == "PUBLIC_LIVE_BETA"
                and launch.get("status") == "BLOCKED"
                and launch.get("marketingAuthorized") is False
                and launch.get("launchAuthorized") is False
            ):
                print("CLOUDFLARE_WEB_LIVE: PASS")
                print(f"site: {WORKER_URL}/")
                print("indexReady: true")
                print("observationReady: true")
                print("repliesEnabled: true")
                print("launchAuthorization: BLOCKED")
                return

        if attempt == 0:
            print("Waiting for Cloudflare web/assets deployment to propagate...")
        time.sleep(2)

    fail("live Worker did not converge to web + API acceptance state")


def main() -> None:
    patch_config()
    deploy()
    verify()


if __name__ == "__main__":
    main()
