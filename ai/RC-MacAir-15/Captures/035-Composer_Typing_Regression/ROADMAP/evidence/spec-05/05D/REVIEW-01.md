# Fresh builder review01 result

Identity `/root/builder05d/review05d`, candidate `d5e5da40c915723ddfaded1581d47a9a9501f6639fbacb027267528d4b8fd955`. Terminal **MATERIAL FINDING — repair required**. All69 hashes unchanged during pass.

High: transient Stop effect timeout leaves default provider running and session STOPPING. Violates SPEC05 no unbounded pending cleanup/preserved exact provider Stop. runtime-stop:220 returns at3s before stopHarness:231; repeat Stop:59 declines STOPPING. Timeout test releases effect without asserting later recovery. Default OpenCode inert process proxy (index:29) receives no normal send completion exit; send clears activeProcess:325. Idle timer already removed. Delayed successful persistence does not release runtime; Send/Move/Delete remain busy until connection/workspace teardown.

Required repair: separate provider termination from delivery-route retirement or exact-owner bounded continuation/retry; preserve real saved ACK, no replacement impact; test delayed effect settlement with real session/proxy lifecycle. Successful canonical terminal publication clears active drain, so ordinary genuine later exit reconciliation is not claimed broken.

Advisory: Runtime Model:322 still says exact-member hydration unsupported; reconcile or label historical.

No other material finding in facade/capability/transaction/repository/history-selection boundary. Raw full-server/backend/submission/actions/build/architecture evidence supports reported passes but does not cover post-timeout recovery. D08/D09 require repair accounting. Retain D07/D12 residuals. Read-only; no edits/workloads/descendants. close_agent unavailable.
