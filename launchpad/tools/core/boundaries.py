"""Optional process fault instrumentation at actual publication boundaries."""
import json
import os
import signal

_count = 0


def before(stage, path=''):
    global _count
    _count += 1
    trace = os.environ.get('LP_TX_TRACE')
    if trace:
        with open(trace, 'a') as handle:
            handle.write(json.dumps({'index': _count, 'stage': stage, 'path': str(path)})+'\n')
            handle.flush()
    if os.environ.get('LP_TX_STOP') == str(_count):
        os.kill(os.getpid(), signal.SIGKILL)
    if os.environ.get('LP_TX_FAIL') == str(_count):
        raise OSError('Injected filesystem failure before '+stage)
