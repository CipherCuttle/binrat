#!/usr/bin/env python3
from __future__ import annotations

import getpass
import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
WORKER_URL = "https://binrat-edge-v0.pettevik.workers.dev"
WEBHOOK_URL = f"{WORKER_URL}/telegram/webhook"
WRANGLER = ["pnpm", "dlx", "wrangler@4.135.0"]


def fail(message: str) -> None:
    print(f"CUTOVER_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(args: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
        check=False,
    )
    if result.returncode != 0:
        if capture and result.stdout:
            print(result.stdout)
        fail(f"command failed: {' '.join(args[:4])} ...")
    return result.stdout or ""


def request_json(
    url: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    merged = {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0 BINRAT-Cutover/0.1",
    }
    if body is not None:
        merged["content-type"] = "application/json"
    if headers:
        merged.update(headers)
    request = urllib.request.Request(url, data=data, headers=merged, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                fail("unexpected non-object JSON response")
            return parsed
    except urllib.error.HTTPError as exc:
        fail(f"HTTP {exc.code} from {urllib.parse.urlsplit(url).netloc}")
    except Exception:
        fail(f"request failed for {urllib.parse.urlsplit(url).netloc}")


def try_request_json(url: str) -> dict[str, Any] | None:
    request = urllib.request.Request(
        url,
        headers={
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 BINRAT-Cutover/0.1",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def try_webhook_post(
    url: str,
    *,
    body: dict[str, Any],
    webhook_secret: str,
) -> tuple[int | None, dict[str, Any] | None]:
    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 BINRAT-Cutover/0.1",
            "X-Telegram-Bot-Api-Secret-Token": webhook_secret,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            return response.status, parsed if isinstance(parsed, dict) else None
    except urllib.error.HTTPError as exc:
        try:
            parsed = json.loads(exc.read().decode("utf-8"))
        except Exception:
            parsed = None
        return exc.code, parsed if isinstance(parsed, dict) else None
    except Exception:
        return None, None


def telegram(token: str, method: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    result = request_json(
        f"https://api.telegram.org/bot{token}/{method}",
        method="POST" if body is not None else "GET",
        body=body,
    )
    if result.get("ok") is not True:
        fail(f"Telegram rejected {method}")
    return result


def find_receipt(value: Any, update_id: int | None = None) -> dict[str, Any] | None:
    if isinstance(value, dict):
        if "update_id" in value and "state" in value:
            if update_id is None or int(value["update_id"]) == update_id:
                return value
        for item in value.values():
            hit = find_receipt(item, update_id)
            if hit:
                return hit
    elif isinstance(value, list):
        for item in value:
            hit = find_receipt(item, update_id)
            if hit:
                return hit
    return None


def d1_query(sql: str) -> Any:
    output = run(
        WRANGLER
        + [
            "d1",
            "execute",
            "DB",
            "--remote",
            "--yes",
            "--json",
            "--command",
            sql,
            "--config",
            "wrangler.jsonc",
        ],
        capture=True,
    )
    start = output.find("[")
    if start < 0:
        start = output.find("{")
    if start < 0:
        fail("Wrangler D1 returned no JSON")
    try:
        return json.loads(output[start:])
    except json.JSONDecodeError:
        fail("could not parse Wrangler D1 JSON")


def main() -> None:
    os.chdir(ROOT)
    if not (ROOT / "wrangler.jsonc").exists():
        fail("wrangler.jsonc is missing; run from the configured BINRAT checkout")

    manifest_path = ROOT / "docs" / "CAPABILITY_MANIFEST_V0.json"
    manifest = json.loads(manifest_path.read_text())
    launch = manifest.get("launchAuthorization", {})
    if not (
        launch.get("status") == "BLOCKED"
        and launch.get("marketingAuthorized") is False
        and launch.get("launchAuthorized") is False
        and launch.get("tokenState") == "NOT_LAUNCHED"
    ):
        fail("capability manifest is not fail-closed for launch/marketing authority")

    token = getpass.getpass("Paste @BinratBot BotFather token (hidden): ").strip()
    if ":" not in token or len(token) < 20:
        fail("bot token format looks invalid")

    identity = telegram(token, "getMe").get("result", {})
    username = identity.get("username")
    if not username:
        fail("Telegram getMe returned no bot username")
    print(f"BOT_OK: @{username}")

    current_info = telegram(token, "getWebhookInfo").get("result", {})
    pending_before = int(current_info.get("pending_update_count") or 0)
    old_url = str(current_info.get("url") or "")
    print(f"CURRENT_WEBHOOK: {old_url or 'NONE'}")
    print(f"PENDING_UPDATES: {pending_before}")
    if pending_before != 0:
        fail("Telegram has pending updates; refusing cutover without inspecting them")

    webhook_secret = secrets.token_urlsafe(32)
    compact_manifest = json.dumps(manifest, separators=(",", ":"))
    secret_payload = {
        "TELEGRAM_BOT_TOKEN": token,
        "TELEGRAM_WEBHOOK_SECRET": webhook_secret,
        "CAPABILITY_MANIFEST_JSON": compact_manifest,
    }

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix="binrat-cf-telegram-",
            suffix=".json",
            dir="/tmp",
            delete=False,
        ) as handle:
            temp_path = handle.name
            json.dump(secret_payload, handle)
            handle.flush()
        os.chmod(temp_path, 0o600)
        print("Installing Cloudflare Telegram secrets...")
        run(WRANGLER + ["secret", "bulk", temp_path, "--config", "wrangler.jsonc"])
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass

    health = None
    capabilities = None
    for _ in range(15):
        candidate_health = try_request_json(f"{WORKER_URL}/health")
        candidate_capabilities = try_request_json(f"{WORKER_URL}/api/capabilities")
        candidate_launch = (candidate_capabilities or {}).get("launchAuthorization", {})
        if (
            candidate_health is not None
            and candidate_capabilities is not None
            and candidate_health.get("repliesEnabled") is False
            and candidate_health.get("launchAuthorization") == "BLOCKED"
            and candidate_launch.get("status") == "BLOCKED"
            and candidate_launch.get("marketingAuthorized") is False
            and candidate_launch.get("launchAuthorized") is False
        ):
            health = candidate_health
            capabilities = candidate_capabilities
            break
        time.sleep(2)

    if health is None or capabilities is None:
        fail("Cloudflare secret version did not become healthy and fail-closed")
    print("CLOUDFLARE_CONTROL_PLANE_OK: replies=false / launch=BLOCKED")
    print("CAPABILITY_MANIFEST_OK")

    synthetic_id = 8_000_000_000_000_000 + (int(time.time()) % 1_000_000_000)
    synthetic_body = {
        "update_id": synthetic_id,
        "message": {
            "message_id": 1,
            "chat": {"id": -1, "type": "private"},
            "text": "/status",
        },
    }

    synthetic = None
    last_status = None
    for attempt in range(30):
        status, candidate = try_webhook_post(
            WEBHOOK_URL,
            body=synthetic_body,
            webhook_secret=webhook_secret,
        )
        last_status = status
        if (
            status == 200
            and candidate is not None
            and candidate.get("ok") is True
            and (
                candidate.get("ignored") is True
                or candidate.get("duplicate") is True
            )
        ):
            synthetic = candidate
            break
        if status not in (None, 401, 503):
            fail(f"synthetic webhook returned unexpected HTTP {status}")
        if attempt == 0:
            print("Waiting for fresh Cloudflare secret version to reach webhook edge...")
        time.sleep(2)

    if synthetic is None:
        fail(f"fresh webhook secret never became active (last HTTP {last_status})")

    # Prove the same secret is stable across multiple edge requests before
    # handing it to Telegram.
    for _ in range(2):
        status, candidate = try_webhook_post(
            WEBHOOK_URL,
            body=synthetic_body,
            webhook_secret=webhook_secret,
        )
        if status != 200 or candidate is None or candidate.get("ok") is not True:
            fail("fresh webhook secret was not stable across repeated probes")

    receipt = find_receipt(
        d1_query(
            "SELECT update_id,state,created_at_ms,updated_at_ms "
            f"FROM telegram_update_receipts WHERE update_id = {synthetic_id} LIMIT 1"
        ),
        synthetic_id,
    )
    if not receipt or receipt.get("state") != "IGNORED":
        fail("synthetic webhook did not persist an IGNORED D1 receipt")
    print("D1_INGRESS_OK: synthetic update persisted as IGNORED")

    cutover_started_ms = int(time.time() * 1000)
    telegram(
        token,
        "setWebhook",
        {
            "url": WEBHOOK_URL,
            "secret_token": webhook_secret,
            "allowed_updates": ["message"],
            "drop_pending_updates": False,
        },
    )
    info = telegram(token, "getWebhookInfo").get("result", {})
    if info.get("url") != WEBHOOK_URL:
        fail("Telegram webhook URL mismatch after setWebhook")
    print(f"WEBHOOK_CUTOVER_OK: {WEBHOOK_URL}")
    print(f"PENDING_AFTER_CUTOVER: {int(info.get('pending_update_count') or 0)}")

    input(f"Send /status to @{username} now. It should NOT reply. Then press Enter here: ")

    deadline = time.time() + 20
    live_receipt = None
    while time.time() < deadline:
        data = d1_query(
            "SELECT update_id,state,created_at_ms,updated_at_ms "
            "FROM telegram_update_receipts "
            f"WHERE created_at_ms >= {cutover_started_ms} "
            f"AND update_id != {synthetic_id} "
            "ORDER BY created_at_ms DESC LIMIT 1"
        )
        live_receipt = find_receipt(data)
        if live_receipt:
            break
        time.sleep(2)

    if not live_receipt:
        fail("no real Telegram delivery appeared in D1 after cutover")
    if live_receipt.get("state") != "IGNORED":
        fail(f"real Telegram delivery has unexpected state {live_receipt.get('state')}")

    final_info = telegram(token, "getWebhookInfo").get("result", {})
    print("REAL_TELEGRAM_INGRESS_OK: D1 state=IGNORED")
    print(f"TELEGRAM_PENDING: {int(final_info.get('pending_update_count') or 0)}")
    if final_info.get("last_error_message"):
        print("TELEGRAM_LAST_ERROR_PRESENT: yes")
    else:
        print("TELEGRAM_LAST_ERROR_PRESENT: no")
    print("REPLIES_ENABLED: false")
    print("LAUNCH_AUTHORIZATION: BLOCKED")
    print("CUTOVER_PASS")
    print("Rollback remains available by redeploying/restarting the unchanged Render Telegram service.")


if __name__ == "__main__":
    main()
