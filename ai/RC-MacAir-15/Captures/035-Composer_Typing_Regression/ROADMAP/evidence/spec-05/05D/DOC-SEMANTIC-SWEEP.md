# Exact-member documentation consistency sweep

Scope: current Chat Wiki PAGE.md pages, one contract only: passive/existing-session open resolves the exact validated member, while group-only/visible-row open resolves Main. Source checked: thread-open-handler, thread-crud activation branches, selection-service resolveOpenTarget, thread-history selection/pending behavior, and threadGroupRows.threadOpenRequest.

`DOC-SEMANTIC-SWEEP.txt` retains the rg search output for hydration/open/resume/activation/compatibility/correlation with primary/non-primary/requestId phrases. Also inspected broader exact-member/unsupported/limitation search hits across current Chat pages. Changed remaining contradictory current statements in Protocol135/185/396, Overview40, Decisions76 and Testing25; no product behavior changed.

Reviewed retained matches:
- Thread Identity42, Runtime313/317, Protocol210 and Overview's first sentence describe visible-row/group-only requests. `threadOpenRequest` intentionally emits only group ID for a row; these Main statements remain correct.
- Runtime347 and Protocol219/396 now distinguish explicit member from group-only; group creation and current-primary row projections are unchanged.
- Actions48/165/196, Protocol329/356–365 and Menus51/55 describe separate resolve_link/open_member_in_side placement consumers. Exact-link read/focus gap remains real and unchanged; successful historyOnly component hydration does not supply that missing navigation action.
- Testing73 describes existing current-primary public-route coverage and remains correctly bounded; Testing25 now requires non-primary after-Move and historyOnly/reconnect coverage without claiming every historical test proves it.
- Current MRU/Move/role descriptions do not assert primary-only hydration. Unrelated Legacy host/UI prose and dated provenance preserved.

No remaining current claim was found that an explicitly validated non-primary thread:open or existing-session assistant target is replaced with Main. This is a semantic documentation review, not a runtime test or unrelated Wiki recertification. Fresh reviewer must check current cross-references as well as changed hunks.
