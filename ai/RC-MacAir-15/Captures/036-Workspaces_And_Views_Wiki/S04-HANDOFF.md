# S04 handoff — human-readable view introductions

Status: **READY_FOR_ORCHESTRATOR_REVIEW** for approved candidate WV01-5108f8838c18f10b. Fresh builder-owned pass 1 returned NEEDS_REPAIR; two validated Custom iframe prose claims were corrected. Fresh pass 2 returned terminal **CLEAN** on current bytes. `S04-REVIEW-HISTORY.md` records reviewer identities, terminal dispositions, repair and unavailable `close_agent` lifecycle. The builder stopped at the first materially clean pass.

## Changed live pages and SHA-256

| Action | Repository-relative page | Current SHA-256 |
|---|---|---|
| rewrite | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/004-Wiki_View/000-Wiki_View/PAGE.md` | `9090290f48e7c92733c02895ae29a890543a48596c65b9132aa32d52a67083d2` |
| rewrite | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/005-Browser/PAGE.md` | `3ba4a5763b59fd8a5dc4278afa60956ca16fbfae129eae8935ad5e2c5df0dc65` |
| rewrite | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/006-Custom_Iframe/PAGE.md` | `78be8419e8684f44b754749270883c39baecfe306c010700c0fbca7f1ac9b8d8` |
| rewrite | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/014-Office_Viewer/PAGE.md` | `b9fde05f1e1c5d6d26d607231edc8619c2e41b0e31f5707a447c92e5fda41507` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/007-File_View/PAGE.md` | `a3709e31c07067bbf1c168babadea1feddf3cf83476f67aa22f9c999980f5632` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/008-Agent_View/PAGE.md` | `992a4d542d29fa284ab26ffb5ce0042c0102cb8e24196c7e04a124d962984449` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/009-Issues_View/PAGE.md` | `921b654e1790ff763cacebb401f2c789813377dc5a6bd3ee592d7000ea652075` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/015-Capture_View/PAGE.md` | `d349f9b347699b1694dd39fd29c33c4e1b76d9bbca67c680aa7c76abdfd84eb4` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/016-Calendar_View/PAGE.md` | `173ddf727344632751ab370658068e2165bc4c8037a49fbcc8f632a570e4c913` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/017-Email_View/PAGE.md` | `3ea160b6a223724c1c66f1959fc5b50188d9b23248a8a60d90ec57d8c31575dd` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/018-Contacts_View/PAGE.md` | `0ec28a76692aa8d9e17e05c8f2064af3557b51231448fce143333c25ba7bf8c5` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/019-Library_View/PAGE.md` | `317d2c4e54f47335a836c6a2dba75cfc59bc6b68e3846b3e4ffdc4d0adc601ca` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/020-Media_View/PAGE.md` | `54e44fe59201f940e408043320f6b3c184e6c2b90ffa6da5d242ba1a4ff0e788` |
| create | `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/023-View_Catalog/PAGE.md` | `51d557889de3a8f9a4b19c12451bb584661006569e39c795cc12bbf0d2d061e6` |

All 14 paths are exactly S04-owned PAGE-MAP entries. No other live Wiki page, product code, template, state, historical snapshot or runtime file was edited by this builder. All writes used `wiki-edit.py` with exact compare-before-write predecessor hashes; `EDIT-RECEIPTS.json` records 30 complete S04 edits. Rewritten predecessors have exclusive `.versions` snapshots; new pages start from an absent predecessor. Capture-local changes are `CLAIMS.json`, `S04-EVIDENCE.md`, `S04-REVIEW-HISTORY.md`, this handoff, edit receipts and unique checker reports.

## Acceptance mapping and self-review

- **AC03 / C01–C06:** Each article separates current template/renderer/content facts from the approved future plugin model. None asserts that plugin provisioning, instance relocation, a general capability boundary or external sync has shipped. The Custom introduction now correctly states cross-origin iframe and framing-header limits.
- **AC04:** The catalog links all 13 bundled template introductions and the System surface. It distinguishes eight fixed built-in template mappings, two configured iframe routes and three templates without fixed built-in components. Calendar loads demo data and has deferred write-back; Email mailbox/account content is fake; Contacts is disabled/experimental. Workspace instance label Drive does not rename Office globally. Wiki/Voice deeper specialist references remain linked but unrecertified.
- **AC06 / AC08:** All changed pages have exact code owner `source-files`, quoted UTC `last-modified`, valid local links, preserved predecessor chains and 56 S04 exact-hashed source claims. Manifests/profile JSON are claim evidence rather than code-file metadata. No legacy edge keys were reintroduced. Two pending links in the cumulative checker target S05-created pages and must expire by final.
- **S04 source review:** `S04-EVIDENCE.md` identifies inspected renderers, content sources, statuses, calendar/Provenance boundary and source limitations. Self-review repaired the initial metadata-manifest category error. Reviewer pass 1 then found Custom origin and frame-header overclaims; the builder validated them in `useIframeNavigation.ts`, `shell-navigation-policy.cjs` and `main.cjs`, corrected the article through a new exact receipt, added direct code owners and reran affected checks. Pass 2 independently reviewed current bytes CLEAN.

## Checks and limits

- `python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py slice S04`: PASS, zero failures, 29 cumulative changed pages, two allowed future links, three warnings; latest `runs/20260921T132233950889Z-slice-S04.json`.
- `python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py self-test`: PASS, 29/29; `runs/20260921T131303058388Z-self-test.json`. Checker code did not change during S04 repair.
- Scoped `git diff --check` on four tracked rewrites and separate trailing-whitespace scan on all 14 S04 pages: PASS. Human reading/source/metadata/link review: PASS on current bytes, corroborated by pass 2.

The three warnings are S03-edited shared wiki standards pages in the S00 source census plus unrelated concurrent `thread-runtime-controller.js` drift; none is a mismatched current S04 source claim. No product tests, build, app/server smoke, runtime/manual app validation, Alpha operation, commit or push was run. `VALIDATION.md` excludes them for this documentation-only SPEC; no adapter was needed. Source review does not certify product runtime.

Deviation/out-of-scope touch: **none**. Proposed classification: none. Reviewer pass 2 advisory notes that CustomViewer code comments still overstate the boundary; correcting product comments is outside this SPEC and does not change the accurate wiki claim. Residual risks are source-only verification and owner-deferred plugin schema/permissions/dependency/update/context choices WV-O01–O06. S05 owns generated navigation, final timestamp receipt, pending-link clearance and integrated review; this builder makes no claim those are complete.
