--- .agents/skills/mc-commit-supervisor/references/workflow.md preimage
+++ .agents/skills/mc-commit-supervisor/references/workflow.md current
@@ -323,3 +323,12 @@
 Dry-run, injected fixtures and a listening port cannot establish readiness.
 A failed or unsupported runtime check preserves evidence as `unmet-gate`;
 reviewed bytes and genuine runtime evidence precede the owner packet.
+
+## Owner wait and operation boundary
+
+After current final review and actual runtime handoff, follow
+[owner-publication.md](owner-publication.md) for the precise candidate/operation
+packet, `COMMIT_READY_WAITING_OWNER` terminal turn, bounded fix requests, final
+pre-operation safety and separate commit/publication/landing/adoption/Alpha
+receipts. Its state/return table and successor rules preserve accepted evidence
+and intentional waits; installation starts no task, timer or operational MC.
