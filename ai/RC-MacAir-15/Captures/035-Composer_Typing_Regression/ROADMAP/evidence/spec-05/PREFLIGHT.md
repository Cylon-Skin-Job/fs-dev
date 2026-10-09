# SPEC-05 orchestrator preflight

Approved candidate release resolves all draft/awaiting labels in hashed packet. Supervisor dispatch records explicit owner acceptance of 04 (“Begin SPEC 5”), overriding its historical owner_review status only. No normative packet edit made.

Read complete SPEC/packet, root/server AGENTS, code standards hub and routed architecture/WS/UEB/harness/persistence/testing pages, Chat overview/identity/runtime, prerequisite supervisor reviews and implementation reports. Accepted client/render host behavior supersedes stale historical Legacy wording in Wiki; 05D must reconcile affected server references without reverting accepted client behavior or concurrent provenance.

Initial HEAD/branch: 88637d11c65be53d4f2ad0f049f64a07fa3db1de / agent/exact-workspace-paths. Migration 045 prompt receipts exists. START-SOURCE-SHA256.txt and START-GIT-STATUS.txt retain initial code/dirty provenance.

Initial source inspection: ThreadManager 1300+ lines owns group-create transaction, session row primitives, capacity/provider lifecycle, mirror formatting/journals/startup recovery, deletion/tombstone/outbox transaction, session metadata facade. ThreadGroupService receives manager wholesale. Runtime controller 1291 lines mixes activation, acceptance/receipt, canonical drain, Stop and cleanup; automation similarly duplicates orchestration. SessionManager provider-session map is distinct from sole ThreadRuntimeManager canonical runtime state and must remain so.

Review attention (unconfirmed risks to test, not prior findings): deletion fencing currently catches retirement/provider-close errors before fencing; mirror journal inserts catch arbitrary failures as duplicates; raw delete splits journaling/session/group operations. 05A/05B fault gates must resolve actual observable behavior, not mechanically copy silent failure branches.

Validation owner: established chat-architecture runner uses authenticated isolated Electron, staged code, ephemeral ports and owned cleanup. Focused server launcher invokes npm test with native pretest in copied stage. No fixed 3001, profile reuse or runtime download permitted. Coordinate tests so builds/timing do not overlap. Architecture baseline test currently characterizes full-manager injection; 05D must enforce approved final ownership and all extracted file limits, not simply rename detectors.

Direct child builder05a owns 05A. No product edits by orchestrator. No close_agent surface is available; terminal status evidence will be retained.

Independent 05A implementation inspection found pending-activation capacity eviction can deadlock concurrent distinct opens or exceed capacity after both evict one LRU. Sent responsible builder; builder confirmed and is adding serialized eviction, pending-owner exclusion, bounded capacity failure, exact rollback and concurrency tests. This is repair work, not a blocker. No acceptance gate completed yet.
