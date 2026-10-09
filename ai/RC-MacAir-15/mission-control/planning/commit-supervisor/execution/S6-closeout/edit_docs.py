"""Exclusive bounded S6 documentation edit, with original byte guards."""
import json,os
from datetime import datetime,timezone
import readbacks as q
owner=json.loads((q.O/'ownership-and-preimages.json').read_bytes())
for row in owner['owned_docs']:assert q.leaf(row['source'])==row['before'],row['source']
assert q.tree(q.PAGE.parent/'.versions')==owner['existing_complete_versions']
version=q.Path(owner['future_exclusive_version'])
old=q.PAGE.read_bytes()
version.parent.mkdir(exist_ok=True)
with version.open('xb') as f:f.write(old)
os.chmod(version,q.PAGE.stat().st_mode&0o777)
assert version.read_bytes()==old
snapshot_done=q.now()
stamp=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
article='''---
name: Fusion Restart
description: Fusion restart script behavior and when to use it for chat validation.
metadata:
  source-files:
    - restart-fusion.sh
    - scripts/fusion-restart.mjs
    - scripts/fusion-restart-target.mjs
    - scripts/fusion-restart-processes.mjs
    - scripts/fusion-restart-probe.mjs
  last-modified: "STAMP"
---

Use the selected checkout's canonical `restart-fusion.sh` for final visual
validation of the real development app shell or when client bundle changes
must reach the running Electron app. In this development checkout:

```bash
/Users/rccurtrightjr./projects/fs-dev/restart-fusion.sh \\
  --repo /Users/rccurtrightjr./projects/fs-dev \\
  --machine RC-MacAir-15
```

`--repo` selects the exact Git worktree root; it defaults to the script's own
checkout. `--machine` overrides `FUSION_LOCAL_MACHINE`, with `RC-MacAir-15` as
the fallback, and requires that checkout's `ai/<machine>/System` tree. For an
isolated candidate, run its own script with its own machine tree and add
`--user-data /absolute/disposable/profile`. The explicit profile overrides
`FUSION_APP_USER_DATA`. With neither setting, Electron uses the ordinary Fusion
Studio profile and the unpackaged server uses the checkout's
`fusion-studio-server/data/fusion.db`. An explicit or inherited profile instead
owns `<profile>/server-data/fusion.db`, even if its path names the ordinary
profile. Profile selection therefore also selects server database ownership.

Before runtime effects, the script checks selected checkout/profile ownership.
It builds the client before stopping the verified owned process tree, rejects
conflicting or ambiguous ownership, then clears only the selected profile's
`Cache`, `Code Cache`, `GPUCache`, `Local Storage`, `Session Storage` and stale
`server.port`. Databases are preserved. It launches the selected checkout's
local Electron executable directly with `electron/main.cjs`; that shell owns
the selected `fusion-studio-server/server.js` child. Another checkout's Electron
runtime is not borrowed.

Readiness requires matching main/server/renderer executable paths, entry paths,
CWD, profile, machine, ancestry and listener ownership. A loopback CDP probe
uses the selected client's existing Playwright dependency to observe
`fusion-shell://app/` connected after `workspace:init`, repeatedly over two
seconds, and then rechecks live process identity. A port file or listening
server alone cannot establish readiness. Missing probe support, a disconnected
renderer or wrong identity withholds readiness and reports the failure.

Per-run target, verification/failure evidence and launch/Electron/renderer logs
are under `<profile>/fusion-restart/run-*/`. Server logs are in the checkout's
`fusion-studio-server/server-live.log` for default mode, or
`<profile>/server-live.log` for explicit/inherited mode. A failed run may leave
its selected app available for diagnosis; report the shown evidence path and
check any lock's writer before removal. `--dry-run` reports resolved paths
without restarting or proving app health.

The script excludes Alpha checkout, app, profile and machine identities.
Alpha updates and restarts follow the repository's separate owner-governed
workflow, including both Alpha identity variables. See
[Testing And Operations](../PAGE.md) and
[Electron Playwright](../003-Playwright_Electron/PAGE.md) for the surrounding
chat validation requirements.
'''.replace('STAMP',stamp)
q.PAGE.write_text(article)
wiki_written=q.now()
at=q.now()
facts=(f'Recorded by Codex side chat (ephemeral), {at}. MC-T09\'s installation and isolated behavioral outcome are **complete**; root full-S6 acceptance, final whole-SPEC integration review and owner setup acceptance remain pending. The [actual private rehearsal](jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1/report.md) exercised terminal provider/intent holds, fresh initial/repair/Wiki/final gates, two canonical app/UI/watcher handoffs, two historical `COMMIT_READY_WAITING_OWNER` packets, fix-X/Y reopening, stale-input/operation refusals and interrupted guarded recovery. The preview is now **stopped and abandoned**, with original128/full4353 seeded inputs restored; the historical owner packets do not assert current readiness. Supported default runtime roles explicitly loaded the exact installed skills/TOML instructions, inherited root settings without overrides, and exposed no concrete model/effort or native-loader metadata. Fixture landing/adoption receipts were labeled simulations; real publication, landing, consumer adoption and Alpha actions are absent. Setup created no operational MC role, persistent integration task or schedule. The [closeout raw manifest](planning/commit-supervisor/execution/S6-closeout-manifest.json) maps original criteria, current documentation and exact evidence; older preservation claims apply only before the authorized six-record/article edits.')
changes={}
def edit(name,old,new):
 p=q.C/name;data=changes.get(name,p.read_text());assert data.count(old)==1,(name,old[:80]);changes[name]=data.replace(old,new,1)
edit('AGENTS.md','S5 installs the routes; isolated behavioral rehearsal remains pending. Installation does not activate a job or approve publication.','S5 installed the routes; the S6 [private behavioral rehearsal](jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1/report.md) is complete and its preview is stopped with original inputs restored. Root full-S6/whole-SPEC gates and owner setup acceptance remain pending. Installation and rehearsal do not activate operational MC or approve publication.')
edit('registry.md','installed under D-024/S5; isolated rehearsal pending.','installed under D-024/S5; isolated S6 behavioral rehearsal complete, with full-S6/whole-SPEC and owner setup acceptance pending.')
p=q.C/'registry.md';row=next(n for n in p.read_text().splitlines() if n.startswith('| MC-T09 |'))
edit('registry.md',row,'| MC-T09 | Build Commit Supervisor | installation + behavioral outcome complete; setup acceptance pending | Owner-assigned S1–S6 runtime children; no persistent integration job UUID registered | Existing accepted integration prerequisites; D-021/D-023/D-024 | [Installed entry](.agents/skills/mc-commit-supervisor/SKILL.md), [actual raw recovery/result](jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1/report.md) and [current full-S6 raw manifest](planning/commit-supervisor/execution/S6-closeout-manifest.json) record the completed private behavioral chain. Two owner-ready packets are historical; preview stopped/abandoned, original128/full4353 restored, current readiness false. Root full-S6 acceptance and final whole-SPEC gate, then owner setup acceptance, remain pending. No real publication/landing/adoption/Alpha, persistent integration task, schedule or operational MC. |')
edit('todo.md','### MC-T09 — Build the Commit Supervisor\n','### MC-T09 — Build the Commit Supervisor\n\n- **Current S6 behavioral outcome:** '+facts+'\n')
edit('todo.md','- [ ] **Deliver:** profile, MC assignment packet, integration evaluation gate, change/issue report and checkpoint/resume procedure.','- [x] **Deliver:** profile, MC assignment packet, integration evaluation gate, change/issue report and checkpoint/resume procedure; installation and private behavioral proof complete, pending the setup acceptance gates above.')
edit('handoff.md','## Current state\n','## Current state\n\n### S6 — Private behavioral rehearsal complete; setup acceptance pending\n\n'+facts+'\n')
edit('handoff.md','MC-T04–12 remain open.','MC-T04–08 and MC-T10–12 remain open; MC-T09 now has completed installation/behavioral outcomes with setup acceptance gates pending above.')
edit('handoff.md','Current continuation: the assigned SPEC orchestrator accepts the current S5 packet, then performs approved S6 fixture preparation and isolated agent/runtime/recovery rehearsal. Use [execution ledger](planning/commit-supervisor/execution/slice-ledger.json) for accepted current revisions; setup acceptance does not approve any future integration candidate or Git operation. Earlier planning/creation paragraphs below retain their dates/provenance and no longer select the installed route.','Current continuation: the assigned root SPEC orchestrator independently accepts the current full-S6 builder packet, performs the separate fresh whole-SPEC integration gate, then returns completed setup for owner acceptance. Use the [current raw S6 manifest](planning/commit-supervisor/execution/S6-closeout-manifest.json) and [execution ledger](planning/commit-supervisor/execution/slice-ledger.json). The private preview is stopped/restored; preserve its historical owner packets and recovery records. Setup acceptance does not approve a future integration candidate or Git operation. Earlier S5/planning/creation paragraphs retain their dated provenance and no longer select the current action.')
edit('deployment.md','D-024/S5 now installs Commit Supervisor and its two subordinate roles; actual isolated workflow/recovery rehearsal remains S6 work.','D-024/S5 installs Commit Supervisor and its two subordinate roles; S6 has completed the isolated workflow/recovery behavioral outcome, with full-S6/whole-SPEC and owner setup acceptance pending below.')
edit('deployment.md','## Validation and remaining runtime checks\n','## Validation and remaining runtime checks\n\n### S6 — Completed private behavior; pending setup acceptance\n\n'+facts+'\n\nActual command receipts, runtime/UI screenshots, persisted ordinary watcher events, failure controls, role/gate lifecycles and mixed index/worktree restoration are retained in that manifest. Private index recovery is semantic (stage/blob/mode/flags/status), while the protected source physical index remains `f37b5bfc9a44893b132661290fe095ddafccb79bed38ca9007dc3803d2ff7966`. Normal/Alpha live DB hash/stat changes are recorded as volatile with device/inode identity preserved. The [canonical restart article](../Wiki/007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md) now follows all four current support modules and launcher; no app/profile, installed definition or product code changes accompany this closeout. The dated S5 installation observation below is retained unchanged.\n')
edit('skills-and-agents.md','## Scope and status\n',facts+'\n\n## Scope and status\n')
for name,text in changes.items():
 row=next(x for x in owner['owned_docs'] if x['source']==str(q.C/name));assert q.leaf(row['source'])==row['before']
 (q.C/name).write_text(text)
q.save(q.O/'write-receipt.json',{'actor':'/root/s6_builder','version_declared':owner['future_exclusive_version'],'version_copy_completed_utc':snapshot_done,'version_complete_preimage_sha256':q.sha(version.read_bytes()),'version_actual':q.leaf(version),'wiki_metadata_last_modified':stamp,'wiki_write_completed_utc':wiki_written,'central_fact_timestamp':at,'finished':q.now(),'current_docs':{str(p):q.leaf(p) for p in q.DOCS},'source_files':{str(q.R/n):q.leaf(q.R/n) for n in ['restart-fusion.sh','scripts/fusion-restart.mjs','scripts/fusion-restart-target.mjs','scripts/fusion-restart-processes.mjs','scripts/fusion-restart-probe.mjs']},'ownership':'Only six central docs/current-state surfaces + exact restart article/version; unique closeout evidence','timestamp_limit':'PAGE had no trustworthy previous timestamp/created field; complete unchanged preimage retains that absence'})
print(json.dumps({'wiki_timestamp':stamp,'version':str(version),'central_docs':len(changes)}))
