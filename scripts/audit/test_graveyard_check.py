"""Adversarial integrity tests: stale state must never become cleanup permission."""
import copy
import importlib.util
import pathlib
import unittest
from unittest import mock
from types import SimpleNamespace

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('graveyard_check', HERE / 'graveyard_check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
snapshot_spec = importlib.util.spec_from_file_location('graveyard_snapshot', HERE / 'graveyard_snapshot.py')
snapshot = importlib.util.module_from_spec(snapshot_spec)
snapshot_spec.loader.exec_module(snapshot)
ROOT = HERE.parents[1]


class GraveyardSafetyTest(unittest.TestCase):
    def setUp(self):
        d = ROOT / 'docs/ops'
        self.inputs = [check.read(d, name) for name in (
            'GRAVEYARD_SNAPSHOT_V1.json', 'GRAVEYARD_INVENTORY_V1.json',
            'GRAVEYARD_PROTECTED_REFS_V1.json', 'GRAVEYARD_WAVE3_CLOSURE_V1.json',
            'GRAVEYARD_BRANCH_DELETION_V1.json', 'GRAVEYARD_GIT_EVIDENCE_V1.json')]

    def test_frozen_inventory_accepts(self):
        self.assertEqual([], check.validate(*self.inputs, ROOT))

    def test_deletion_cannot_be_smuggled_into_manifest(self):
        self.inputs[4]['deleteBranches'] = ['main']
        self.assertTrue(check.validate(*self.inputs, ROOT))

    def test_unpublished_local_ref_cannot_be_omitted(self):
        self.inputs[1]['localBranchRecords'].pop()
        self.assertTrue(any('local ref coverage' in e for e in check.validate(*self.inputs, ROOT)))

    def test_new_outside_family_stack_blocks_closure(self):
        child = copy.deepcopy(self.inputs[0]['prs'][0])
        child.update(number=999, state='open', merged_at=None)
        child['base']['ref'] = self.inputs[3]['records'][0]['branch']
        self.inputs[0]['prs'].append(child)
        self.assertTrue(any('outside-family' in e for e in check.validate(*self.inputs, ROOT)))

    def test_parent_first_order_rejected(self):
        self.inputs[3]['leafFirstOrder'].reverse()
        self.assertTrue(any('leaf-first' in e for e in check.validate(*self.inputs, ROOT)))

    def test_merged_pr_cannot_be_closed_as_unmerged(self):
        n = self.inputs[3]['leafFirstOrder'][0]
        p = next(p for p in self.inputs[0]['prs'] if p['number'] == n)
        p['merged_at'] = '2026-10-14T02:00:00Z'
        self.assertTrue(any('state drift' in e for e in check.validate(*self.inputs, ROOT)))

    def test_dangling_comment_and_false_containment_rejected(self):
        self.inputs[3]['records'][0]['proposedCommentPath'] = '../../outside.md'
        r = self.inputs[1]['records'][0]
        r['classification'] = 'MERGED_REDUNDANT'
        self.inputs[5]['comparisons'][r['uniqueCodeAssetsEvidence']['evidenceKey']]['containedBySelectedHeads'] = []
        errors = check.validate(*self.inputs, ROOT)
        self.assertTrue(any('comment path' in e for e in errors))
        self.assertTrue(any('unproven containment' in e for e in errors))

    def test_fresh_snapshot_detects_head_and_base_drift(self):
        fresh = copy.deepcopy(self.inputs[0])
        fresh['prs'][0]['base']['sha'] = 'f' * 40
        self.assertTrue(check.compare_fresh(self.inputs[0], fresh))
        self.assertEqual([], check.compare_fresh(self.inputs[0], self.inputs[0]))

    def test_pr_template_requires_real_source_and_actual_target(self):
        body = 'ACTIVE_TARGET: integration/binrat-a1-3-visual-gate\nSOURCE_BASE_REF: main\nSOURCE_BASE_SHA: ' + 'a'*40 + '\nSTATUS: DONOR'
        self.assertEqual([], check.validate_pr_body(body, 'integration/binrat-a1-3-visual-gate'))
        self.assertTrue(check.validate_pr_body(body, 'main'))
        self.assertTrue(check.validate_pr_body(body.replace('a'*40, '<sha>')))

    def test_snapshot_stops_on_pagination_ceiling_without_claiming_completeness(self):
        response = SimpleNamespace(stdout='[' + ','.join('{}' for _ in range(100)) + ']')
        with mock.patch.object(snapshot.subprocess, 'run', return_value=response) as run:
            with self.assertRaisesRegex(ValueError, 'inventory incomplete'):
                snapshot.pages('branches?', max_pages=2)
            self.assertEqual(2, run.call_count)
            self.assertTrue(all(c.args[0][:2] == ['gh', 'api'] for c in run.call_args_list))

    def test_snapshot_rejects_unbounded_request_before_any_network_call(self):
        with mock.patch.object(snapshot.subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                snapshot.pages('branches?', max_pages=1000000)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
