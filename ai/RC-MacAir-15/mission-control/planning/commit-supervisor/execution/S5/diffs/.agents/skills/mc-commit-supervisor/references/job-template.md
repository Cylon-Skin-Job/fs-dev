--- .agents/skills/mc-commit-supervisor/references/job-template.md preimage
+++ .agents/skills/mc-commit-supervisor/references/job-template.md current
@@ -100,3 +100,16 @@
 clean review plus required checks yields `HANDOFF_VALIDATED`; editor self-check
 returns `READY_FOR_HANDOFF_REVIEW`. Preserve affected invalidation and unaffected
 evidence separately. No documentation report certifies app runtime or landing.
+
+## Owner operation and cutover fields
+
+Follow [owner-publication.md](owner-publication.md) for exact phase/return criteria.
+Bind each owner packet and operation receipt to current candidate dependencies,
+actual owner instruction/source, permitted operation and exact destination,
+pre-operation writer/ref/index/config/check/runtime/recovery readbacks, and
+uncertain-outcome reconciliation. Preserve previous packets and fix-request
+source, affected versus retained evidence and fresh gate/runtime revisions.
+Keep local commit, remote push, PR attachment/merge, target landing, provider
+release, consumer adoption and future Alpha confirmations/results separate.
+Legacy job records keep their IDs/locations with alias-to-current-role, pinned
+procedure/source revision, predecessor/schedule disposition and next safe action.
