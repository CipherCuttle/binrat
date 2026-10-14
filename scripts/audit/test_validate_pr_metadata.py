"""Offline fixture coverage for the PR provenance metadata check."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('validate_pr_metadata', HERE / 'validate_pr_metadata.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

BASE_SHA = 'a' * 40
BODY = '\n'.join((
    'ACTIVE_TARGET: main',
    'SOURCE_BASE_REF: main',
    'SOURCE_BASE_SHA: ' + BASE_SHA,
    'STATUS: QUARANTINE',
    '',
    'Draft review; no merge or deployment authority.',
))


def event(created='2026-10-14T04:00:00Z', body=BODY, base='main'):
    return {'pull_request': {'created_at': created, 'body': body, 'base': {'ref': base}}}


class PrMetadataTest(unittest.TestCase):
    def test_valid_new_pr(self):
        self.assertEqual(('PASS', []), validator.validate_event(event()))

    def test_legacy_pr_skips(self):
        self.assertEqual(('HISTORICAL_SKIP', []), validator.validate_event(event('2026-10-13T23:59:59Z', '')))

    def test_cutoff_boundary_is_enforced(self):
        self.assertEqual('BLOCKED', validator.validate_event(event('2026-10-14T00:00:00Z', ''))[0])

    def test_missing_field_fails(self):
        self.assertTrue(validator.validate_body(BODY.replace('SOURCE_BASE_REF:', 'OLD_BASE:'), 'main'))

    def test_placeholder_fails(self):
        self.assertTrue(validator.validate_body(BODY.replace(BASE_SHA, '<commit>'), 'main'))

    def test_wrong_target_fails(self):
        self.assertIn('ACTIVE_TARGET differs from GitHub PR base',
                      validator.validate_body(BODY, 'integration/binrat-a1-3-visual-gate'))

    def test_non_sha_fails(self):
        self.assertTrue(validator.validate_body(BODY.replace(BASE_SHA, 'x' * 40), 'main'))

    def test_unknown_status_fails(self):
        self.assertTrue(validator.validate_body(BODY.replace('QUARANTINE', 'MERGE_READY'), 'main'))

    def test_duplicate_header_fails(self):
        self.assertIn('duplicate provenance header', validator.validate_body(BODY + '\nSTATUS: ACTIVE', 'main'))

    def test_out_of_order_header_fails(self):
        self.assertTrue(validator.validate_body(BODY.replace('ACTIVE_TARGET: main\nSOURCE_BASE_REF: main',
                                                    'SOURCE_BASE_REF: main\nACTIVE_TARGET: main'), 'main'))

    def test_missing_payload_fails_closed(self):
        self.assertEqual('BLOCKED', validator.validate_event({})[0])

    def test_invalid_timestamp_fails_closed(self):
        self.assertEqual('BLOCKED', validator.validate_event(event('not-a-date'))[0])

    def test_no_body_fails_closed(self):
        self.assertEqual('BLOCKED', validator.validate_event(event(body=None))[0])

    def test_body_edit_rechecked(self):
        first = event()
        self.assertEqual('PASS', validator.validate_event(first)[0])
        edited = copy.deepcopy(first)
        edited['pull_request']['body'] = 'STATUS: QUARANTINE'
        self.assertEqual('BLOCKED', validator.validate_event(edited)[0])

    def test_cli_error_and_success(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'event.json'
            path.write_text(json.dumps(event()))
            cmd = [sys.executable, str(HERE / 'validate_pr_metadata.py'), '--event-file', str(path)]
            self.assertEqual(0, subprocess.run(cmd, capture_output=True).returncode)
            path.write_text(json.dumps(event(body='')))
            self.assertEqual(1, subprocess.run(cmd, capture_output=True).returncode)


if __name__ == '__main__':
    unittest.main()
