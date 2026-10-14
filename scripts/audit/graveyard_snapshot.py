#!/usr/bin/env python3
"""Bounded GitHub metadata GETs; write a new local snapshot, never overwrite one."""
import argparse
import datetime
import json
import pathlib
import subprocess


def pages(resource, max_pages=5):
    if not 1 <= max_pages <= 5:
        raise ValueError('page ceiling must be between 1 and 5')
    result = []
    for page in range(1, max_pages + 1):
        response = subprocess.run(
            ['gh', 'api', f'repos/CipherCuttle/binrat/{resource}&per_page=100&page={page}'],
            check=True, capture_output=True, text=True, timeout=30)
        rows = json.loads(response.stdout)
        if not isinstance(rows, list):
            raise ValueError('expected a metadata page')
        result.extend(rows)
        if len(rows) < 100:
            return result, page
    raise ValueError('page ceiling reached; inventory incomplete, do not use partial data')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('output already exists; preserve the original receipt')
    try:
        prs, pp = pages('pulls?state=all&sort=created&direction=asc')
        branches, bp = pages('branches?')
        prs = [{k: p.get(k) for k in ('number', 'title', 'state', 'draft', 'created_at',
                'updated_at', 'closed_at', 'merged_at', 'merge_commit_sha', 'html_url')} |
               {side: {k: p[side][k] for k in ('ref', 'sha', 'label')} for side in ('head', 'base')}
               for p in prs]
        branches = [{'name': b['name'], 'sha': b['commit']['sha'], 'protected': b['protected']} for b in branches]
        meta = {'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'repository': 'CipherCuttle/binrat', 'allPRs': len(prs),
                'openPRs': sum(p['state'] == 'open' for p in prs), 'remoteBranches': len(branches),
                'pages': {'prs': pp, 'branches': bp}, 'paginationCeilingEach': 5}
        with args.output.open('x') as stream:
            json.dump({'inventory': meta, 'prs': prs, 'branches': branches}, stream, indent=2)
            stream.write('\n')
        print(json.dumps(meta))
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        parser.exit(1, f'FAIL: no complete snapshot: {type(exc).__name__}\n')


if __name__ == '__main__':
    main()
