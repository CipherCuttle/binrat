#!/usr/bin/env python3
"""Validate new PR-body provenance fields; not an ancestry or merge-safety gate."""

import argparse
import datetime as dt
import json
from pathlib import Path
import re
import sys

FIELDS = ('ACTIVE_TARGET', 'SOURCE_BASE_REF', 'SOURCE_BASE_SHA', 'STATUS')
STATUSES = frozenset({
    'ACTIVE', 'ACTIVE_ANCESTOR', 'DONOR', 'GRAVEYARD',
    'OPS_RECEIPT', 'QUARANTINE', 'MERGED_REDUNDANT',
})
CUTOFF = dt.datetime(2026, 10, 14, tzinfo=dt.timezone.utc)
SHA = re.compile(r'[0-9a-f]{40}\Z')


def validate_body(body: str, target: str) -> list[str]:
    errors = []
    if not isinstance(body, str) or not isinstance(target, str) or not target:
        return ['missing PR body or target']
    lines = body.splitlines()
    fields = {}
    for index, field in enumerate(FIELDS):
        line = lines[index].strip() if index < len(lines) else ''
        match = re.fullmatch(re.escape(field) + r':\s*(.*)', line)
        if not match:
            errors.append(f'missing or out-of-order header: {field}')
            continue
        fields[field] = match.group(1).strip()
        if not fields[field] or '<' in fields[field] or '>' in fields[field]:
            errors.append(f'invalid placeholder/empty field: {field}')
    for line in lines[len(FIELDS):]:
        if re.match(r'^\s*(?:' + '|'.join(FIELDS) + r')\s*:', line):
            errors.append('duplicate provenance header')
            break
    if fields.get('ACTIVE_TARGET') != target:
        errors.append('ACTIVE_TARGET differs from GitHub PR base')
    if fields.get('SOURCE_BASE_REF') and re.search(r'\s', fields['SOURCE_BASE_REF']):
        errors.append('SOURCE_BASE_REF contains whitespace')
    if not SHA.fullmatch(fields.get('SOURCE_BASE_SHA', '')):
        errors.append('SOURCE_BASE_SHA must be a lowercase 40-character SHA')
    if fields.get('STATUS') not in STATUSES:
        errors.append('STATUS is not a known disposition')
    return errors


def validate_event(event: object) -> tuple[str, list[str]]:
    if not isinstance(event, dict) or not isinstance(event.get('pull_request'), dict):
        return 'BLOCKED', ['missing GitHub pull_request payload']
    pr = event['pull_request']
    try:
        created = dt.datetime.fromisoformat(pr['created_at'].replace('Z', '+00:00'))
        if created.tzinfo is None:
            raise ValueError('naive timestamp')
        target = pr['base']['ref']
    except (KeyError, AttributeError, TypeError, ValueError):
        return 'BLOCKED', ['invalid GitHub PR identity/timestamp']
    if created < CUTOFF:
        return 'HISTORICAL_SKIP', []
    errors = validate_body(pr.get('body'), target)
    return ('BLOCKED' if errors else 'PASS'), errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event-file', type=Path, required=True)
    args = parser.parse_args()
    try:
        status, errors = validate_event(json.loads(args.event_file.read_text()))
    except (OSError, json.JSONDecodeError) as exc:
        print(f'BLOCKED: event unreadable ({type(exc).__name__})', file=sys.stderr)
        return 1
    for error in errors:
        print('BLOCKED: ' + error, file=sys.stderr)
    if not errors:
        print(status + ': PR metadata only; ancestry and merge-safety remain unverified')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
