"""Offline tests: never call Cloudflare or modify production."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

S = pathlib.Path(__file__).resolve().parents[1] / 'scripts/cloudflare_emergency_pause.py'
spec = importlib.util.spec_from_file_location('pause', S)
pause = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pause)


class StopTests(unittest.TestCase):
    def test_inspect_never_mutates(self):
        with patch.object(pause, 'probe', return_value={'delivery_paused': False, 'crons': ['* * * * *']}) as probe:
            with patch.object(pause, 'api') as api:
                pause.run('inspect', '', 'acct', 'token')
                api.assert_not_called()
                self.assertEqual(probe.call_count, 1)

    def test_pause_requires_confirmation_before_provider_read(self):
        with patch.object(pause, 'probe') as probe:
            with self.assertRaisesRegex(RuntimeError, 'confirmation'):
                pause.run('pause', 'wrong', 'acct', 'token')
            probe.assert_not_called()

    def test_pause_blocks_cron_change_when_queue_did_not_pause(self):
        before = dict(delivery_paused=False, crons=['* * * * *'], queue_settings={}, queue_id='qid')
        with patch.object(pause, 'probe', side_effect=[before, before]):
            with patch.object(pause, 'api') as api:
                with self.assertRaisesRegex(RuntimeError, 'not verified'):
                    pause.run('pause', pause.CONFIRM, 'acct', 'token')
                self.assertEqual(api.call_count, 1)
                self.assertEqual(api.call_args.args[2], 'PUT')
                self.assertIn('/queues/qid', api.call_args.args[3])

    def test_pause_only_known_queue_then_cron(self):
        before = dict(delivery_paused=False, crons=['* * * * *'], queue_settings={}, queue_id='qid')
        middle = dict(delivery_paused=True, crons=['* * * * *'], queue_settings={}, queue_id='qid')
        after = dict(delivery_paused=True, crons=[], queue_settings={}, queue_id='qid')
        with patch.object(pause, 'probe', side_effect=[before, middle, after]):
            with patch.object(pause, 'api') as api:
                pause.run('pause', pause.CONFIRM, 'acct', 'token')
                self.assertEqual(api.call_count, 2)
                self.assertIn('/queues/qid', api.call_args_list[0].args[3])
                self.assertIn('/schedules', api.call_args_list[1].args[3])

    def test_already_paused_is_idempotent(self):
        paused = dict(delivery_paused=True, crons=[], queue_settings={}, queue_id='qid')
        with patch.object(pause, 'probe', side_effect=[paused, paused, paused]):
            with patch.object(pause, 'api') as api:
                pause.run('pause', pause.CONFIRM, 'acct', 'token')
                api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
