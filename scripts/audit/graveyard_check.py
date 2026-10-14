#!/usr/bin/env python3
"""Offline graveyard integrity check. Never executes a remote action or reads secrets."""
import argparse
import json
import pathlib
import re
import sys

DISPOSITIONS = {'ACTIVE', 'ACTIVE_ANCESTOR', 'DONOR', 'GRAVEYARD',
                'OPS_RECEIPT', 'QUARANTINE', 'MERGED_REDUNDANT'}
FIELDS = {'prNumber', 'branch', 'headSHA', 'baseRef', 'baseSHA', 'lastActivity',
          'classification', 'reason', 'successorOrPreservedAuthority',
          'openPRsDependingOnBranch', 'uniqueCodeAssetsEvidence',
          'productionSecurityLicenseConsiderations', 'safeToClosePR',
          'safeToDeleteBranch', 'requiresOwnerGrant', 'verificationEvidence'}
SHA = re.compile(r'^[0-9a-f]{40}$')


def read(directory, name):
    return json.loads((directory / name).read_text())


def validate(snapshot, inventory, protected, wave, deletion, evidence, root=None):
    errors = []
    def need(ok, message):
        if not ok:
            errors.append(message)
    prs = {p['number']: p for p in snapshot['prs']}
    branches = {b['name']: b['sha'] for b in snapshot['branches']}
    opened = {n: p for n, p in prs.items() if p['state'] == 'open'}
    records = inventory['records']
    pr_records = [r for r in records if r['kind'] == 'pr']
    branch_records = [r for r in records if r['kind'] == 'branch']
    need(len(prs) == len(snapshot['prs']), 'duplicate snapshot PR')
    need(len(branches) == len(snapshot['branches']), 'duplicate snapshot branch')
    need(len(pr_records) == len(prs) and {r['prNumber'] for r in pr_records} == set(prs),
         'PR coverage/uniqueness mismatch')
    need(len(branch_records) == len(branches) and {r['branch'] for r in branch_records} == set(branches),
         'branch coverage/uniqueness mismatch')
    need(snapshot['inventory']['openPRs'] == len(opened), 'open count mismatch')
    need(snapshot['inventory']['remoteBranches'] == len(branches), 'branch count mismatch')
    protected_heads = {r['branch']: r['headSHA'] for r in protected['remoteRefs']}
    need(protected_heads == branches, 'protected refs differ from snapshot')
    need(all(r['mayDelete'] is False for r in protected['remoteRefs']), 'protected deletion allowed')
    local = inventory['localBranchRecords']
    local_identity = {(r['successorOrPreservedAuthority']['commonDir'], r['branch'], r['headSHA']) for r in local}
    expected_local = {(r['commonDir'], r['ref'].removeprefix('refs/heads/'), r['sha']) for r in protected['localRefs']}
    need(len(local_identity) == len(local) and local_identity == expected_local, 'local ref coverage/identity mismatch')
    for r in local:
        need(FIELDS <= r.keys() and r['classification'] in DISPOSITIONS, 'local ref incomplete classification')
        need(r['safeToDeleteBranch'] is False and r['requiresOwnerGrant'] is True, 'local ref unsafe gate')
    cohort = {r['prNumber']: r for r in wave['records']}
    order = wave['leafFirstOrder']
    need(len(order) == len(cohort) and set(order) == set(cohort), 'closure order coverage mismatch')
    positions = {n: i for i, n in enumerate(order)}
    need(set(wave['scope']['closePRs']) == set(cohort), 'closure scope mismatch')
    need(set(wave['scope']['commentPRs']) == set(cohort), 'comment scope mismatch')
    need(wave['ownerGrant'] is None and wave['executedRemoteWrites'] == 0, 'unexpected grant/execution')
    need(wave['status'] == 'AWAITING_OWNER_GRANT', 'closure status must remain gated')
    for action in ('deleteBranches', 'deleteTags', 'pushRefs', 'merges', 'deploymentActions'):
        need(wave['scope'][action] == [], 'unexpected action: ' + action)
    for n, r in cohort.items():
        p = prs.get(n)
        need(p is not None and p['state'] == 'open' and p['merged_at'] is None, f'PR {n} state drift')
        if p is None:
            continue
        need((r['branch'], r['headSHA'], r['baseRef'], r['baseSHA']) ==
             (p['head']['ref'], p['head']['sha'], p['base']['ref'], p['base']['sha']), f'PR {n} identity drift')
        need(branches.get(r['branch']) == r['headSHA'], f'PR {n} branch drift')
        children = sorted(m for m, child in opened.items() if child['base']['ref'] == r['branch'])
        need(children == r['openPRsDependingOnBranch'], f'PR {n} dependency mismatch')
        need(set(children) <= set(cohort), f'PR {n} outside-family dependent')
        for child in children:
            need(child in positions and positions[child] < positions[n], f'PR {n} order is not leaf-first')
        need(r['safeToDeleteBranch'] is False and r['requiresOwnerGrant'] is True, f'PR {n} safety gate missing')
        if root is not None:
            path = (root / r['proposedCommentPath']).resolve()
            need(path.is_relative_to(root.resolve()) and path.is_file(), f'PR {n} missing/unsafe comment path')
    for r in records:
        label = f"{r['kind']} {r.get('prNumber') or r['branch']}"
        need(FIELDS <= r.keys(), label + ' incomplete schema')
        need(r['classification'] in DISPOSITIONS, label + ' unknown disposition')
        need(bool(SHA.fullmatch(r['headSHA'])), label + ' invalid SHA')
        need(bool(SHA.fullmatch(r['baseSHA'])), label + ' invalid comparison base')
        need(r['safeToDeleteBranch'] is False and r['requiresOwnerGrant'] is True, label + ' unsafe gate')
        expected = prs[r['prNumber']]['head']['sha'] if r['kind'] == 'pr' else branches[r['branch']]
        need(r['headSHA'] == expected, label + ' head mismatch')
        children = sorted(n for n, p in opened.items() if p['base']['ref'] == r['branch'])
        need(children == r['openPRsDependingOnBranch'], label + ' dependency mismatch')
        if r['classification'] == 'QUARANTINE':
            need(bool(r.get('unresolvedBlocker')) and not r['safeToClosePR'], label + ' quarantine must block')
        if r['safeToClosePR']:
            need(r['kind'] == 'pr' and r['prNumber'] in cohort, label + ' closure lacks exact manifest')
        key = r['uniqueCodeAssetsEvidence']['evidenceKey']
        comparison = evidence['comparisons'].get(key)
        need(comparison is not None and comparison['headSHA'] == r['headSHA'], label + ' missing evidence')
        if r['classification'] == 'MERGED_REDUNDANT':
            need(bool(comparison and comparison['containedBySelectedHeads']), label + ' unproven containment')
    need(deletion['deleteBranches'] == [] and deletion['deleteTags'] == [], 'deletion set must remain empty')
    need(deletion['ownerGrant'] is None and deletion['executedRemoteWrites'] == 0, 'unexpected deletion grant/write')
    need({r['branch']: r['headSHA'] for r in deletion['records']} == branches
         and len(deletion['records']) == len(branches), 'deletion manifest coverage mismatch')
    return errors


def compare_fresh(snapshot, fresh):
    """Detect head, state, base and dependency drift before a separate approved executor."""
    def identity(s):
        return ({p['number']: (p['state'], p['merged_at'], p['head']['ref'], p['head']['sha'],
                               p['base']['ref'], p['base']['sha']) for p in s['prs']},
                {b['name']: b['sha'] for b in s['branches']})
    return [] if identity(snapshot) == identity(fresh) else ['fresh GitHub snapshot drift; refresh manifest and review affected scope']


def validate_pr_body(body, base_ref=None):
    fields = {}
    for line in body.splitlines():
        match = re.fullmatch(r'(ACTIVE_TARGET|SOURCE_BASE_REF|SOURCE_BASE_SHA|STATUS):\s*(.+)', line.strip())
        if match:
            fields[match[1]] = match[2]
    errors = []
    for key in ('ACTIVE_TARGET', 'SOURCE_BASE_REF', 'SOURCE_BASE_SHA', 'STATUS'):
        if key not in fields or fields[key].startswith('<'):
            errors.append('PR missing ' + key)
    if 'SOURCE_BASE_SHA' in fields and not SHA.fullmatch(fields['SOURCE_BASE_SHA']):
        errors.append('PR source base must be an exact 40-character SHA')
    if fields.get('STATUS') not in DISPOSITIONS:
        errors.append('PR needs a primary disposition')
    if base_ref is not None and fields.get('ACTIVE_TARGET') != base_ref:
        errors.append('PR active target does not match actual base ref')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[2])
    parser.add_argument('--fresh-snapshot', type=pathlib.Path)
    parser.add_argument('--pr-body', type=pathlib.Path)
    parser.add_argument('--event-file', type=pathlib.Path)
    args = parser.parse_args()
    d = args.root / 'docs/ops'
    try:
        snapshot = read(d, 'GRAVEYARD_SNAPSHOT_V1.json')
        errors = validate(snapshot, read(d, 'GRAVEYARD_INVENTORY_V1.json'),
                          read(d, 'GRAVEYARD_PROTECTED_REFS_V1.json'),
                          read(d, 'GRAVEYARD_WAVE3_CLOSURE_V1.json'),
                          read(d, 'GRAVEYARD_BRANCH_DELETION_V1.json'),
                          read(d, 'GRAVEYARD_GIT_EVIDENCE_V1.json'), args.root)
        if args.fresh_snapshot:
            errors += compare_fresh(snapshot, json.loads(args.fresh_snapshot.read_text()))
        if args.pr_body:
            errors += validate_pr_body(args.pr_body.read_text())
        if args.event_file:
            pr = json.loads(args.event_file.read_text()).get('pull_request')
            # Apply the template to newly created PRs; preserve historical records.
            if pr and pr['created_at'] >= '2026-10-14T00:00:00Z':
                errors += validate_pr_body(pr.get('body') or '', pr['base']['ref'])
        if errors:
            print('\n'.join('FAIL: ' + e for e in errors), file=sys.stderr)
            return 1
        print(f"PASS: {len(snapshot['prs'])} PRs, {len(snapshot['branches'])} branches; exact closure/deletion/protection gates intact")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f'FAIL: invalid or missing inventory: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
