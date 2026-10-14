#!/usr/bin/env python3
"""Bounded BINRAT Cloudflare stop switch. No data deletion or deployment."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

WORKER = "binrat-edge-v0"
QUEUE = "binrat-sync-v0"
D1_ID = "46814564-1a41-449a-88e5-c1349eed3a27"
D1_NAME = "binrat-v0"
CONFIRM = "PAUSE_BINRAT_2026_10_11"
BASE = "https://api.cloudflare.com/client/v4/accounts"


def api(account, token, method, path, data=None):
    url = f"{BASE}/{account}{path}"
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        # Do not leak provider response bodies into public Actions logs.
        raise RuntimeError(f"Cloudflare {method} {path} returned HTTP {exc.code}") from None
    except Exception as exc:
        raise RuntimeError(f"Cloudflare {method} {path} failed: {type(exc).__name__}") from None
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise RuntimeError(f"Cloudflare {method} {path} did not report success")
    return payload.get("result")


def probe(account, token):
    db = api(account, token, "GET", f"/d1/database/{D1_ID}")
    if not isinstance(db, dict) or db.get("name") != D1_NAME:
        raise RuntimeError("D1 identity mismatch; refusing to proceed")
    listing = api(account, token, "GET", "/queues?per_page=100")
    if not isinstance(listing, list):
        raise RuntimeError("Queue listing shape unexpected; refusing to proceed")
    matches = [entry for entry in listing if entry.get("queue_name") == QUEUE]
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one queue named {QUEUE}; found {len(matches)}")
    qid = matches[0].get("queue_id")
    if not isinstance(qid, str) or not qid or "/" in qid:
        raise RuntimeError("Queue id invalid; refusing to proceed")
    queue = api(account, token, "GET", f"/queues/{qid}")
    if not isinstance(queue, dict) or queue.get("queue_name") != QUEUE:
        raise RuntimeError("Queue identity mismatch; refusing to proceed")
    producers = queue.get("producers") or matches[0].get("producers") or []
    consumers = queue.get("consumers") or matches[0].get("consumers") or []
    if not any(p.get("script") == WORKER for p in producers if isinstance(p, dict)):
        raise RuntimeError("Expected Worker is not a confirmed queue producer; refusing to proceed")
    if not any(c.get("script_name") == WORKER for c in consumers if isinstance(c, dict)):
        raise RuntimeError("Expected Worker is not a confirmed queue consumer; refusing to proceed")
    schedules = api(account, token, "GET", f"/workers/scripts/{WORKER}/schedules")
    if not isinstance(schedules, dict) or not isinstance(schedules.get("schedules"), list):
        raise RuntimeError("Unexpected Worker schedule response; refusing to proceed")
    settings = queue.get("settings") or {}
    if not isinstance(settings, dict):
        raise RuntimeError("Unexpected queue settings; refusing to proceed")
    return {"queue_id": qid, "queue_settings": settings,
            "delivery_paused": settings.get("delivery_paused") is True,
            "crons": [x.get("cron") for x in schedules["schedules"]]}


def run(mode, confirmation, account, token):
    if mode not in {"inspect", "pause"}:
        raise RuntimeError("Only inspect and pause are supported")
    if not account or not token:
        raise RuntimeError("Cloudflare account id and API token secrets are required")
    if mode == "pause" and confirmation != CONFIRM:
        raise RuntimeError("Exact confirmation required for production pause")
    before = probe(account, token)
    print(json.dumps({"phase": "before", "worker": WORKER, "queue": QUEUE,
                      "delivery_paused": before["delivery_paused"], "crons": before["crons"]}))
    if mode == "inspect":
        print("INSPECT_ONLY_NO_MUTATION")
        return
    if not before["delivery_paused"]:
        settings = {k: v for k, v in before["queue_settings"].items()
                    if k in {"delivery_delay", "message_retention_period", "delivery_paused"}}
        settings["delivery_paused"] = True
        api(account, token, "PUT", f"/queues/{before['queue_id']}", {"settings": settings})
    # Never clear schedules unless the queue's pause has been confirmed by the provider.
    intermediate = probe(account, token)
    if not intermediate["delivery_paused"]:
        raise RuntimeError("Queue pause was not verified. Cron left untouched")
    if intermediate["crons"]:
        api(account, token, "PUT", f"/workers/scripts/{WORKER}/schedules", [])
    after = probe(account, token)
    if not after["delivery_paused"] or after["crons"]:
        raise RuntimeError("STOP_NOT_VERIFIED; inspect account manually")
    print(json.dumps({"phase": "after", "worker": WORKER, "queue": QUEUE,
                      "delivery_paused": True, "crons": [], "verdict": "PAUSED_VERIFIED"}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["inspect", "pause"], default="inspect")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()
    try:
        run(args.mode, args.confirm, os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""),
            os.environ.get("CLOUDFLARE_API_TOKEN", ""))
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
