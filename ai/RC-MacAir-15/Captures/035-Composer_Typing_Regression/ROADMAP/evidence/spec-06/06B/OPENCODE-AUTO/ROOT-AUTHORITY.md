# Owner-directed OpenCode auto policy — orchestrator authority

The supervisor relayed the owner’s explicit instructions: “Open Code runs in full auto” and “The hook work is later. Just set the auto for now.” These supersede the earlier no-auto feasibility boundary. This is the accepted authority for the narrow adapter policy; there is no remaining owner decision for this change.

## Classified deviation

1. Original SPEC: SPEC-06/06B validates the accepted chat architecture, native input, performance and owner symptoms. Interactive permission design and automatic approval were not original 06B implementation scope; earlier read-only feasibility expressly excluded --auto.
2. Actual change: every Fusion production OpenCode run receives the supported --auto flag, including new and resumed sessions. Tests assert the actual child-process argv.
3. Reason: explicit owner direction requires OpenCode to run automatically now and reserves hook/list/Fusion approval UI work for later.
4. Files: fusion-studio-server/lib/harness/opencode/index.js; fusion-studio-server/test/harness/opencode/harness-send-message.test.js. Evidence is retained in this directory. No hook, service transport, permission UI, config rewrite or other harness change is authorized.
5. Verification: focused existing adapter/child-environment tests, independent current-byte inspection, and fresh builder/orchestrator review. Pinned OpenCode1.18.32 source establishes auto replies once to asked permissions and explicit denies fail before asked is published. This source evidence is not an executed real-provider approval test.
6. Observable effect: future runs from the updated server automatically approve requests that OpenCode would otherwise ask about. JSON output, model/variant/thinking/pure/session selection, Stop and Claude compatibility policy remain unchanged.
7. Risk: supported auto mode permits tools to proceed without a Fusion prompt when native policy says ask. Explicit configured denies still apply. The existing synthetic-completion behavior following a denied/failed tool remains unresolved and must not be described as fixed by this flag. A previously rejected operation is not revived.
8. Downstream impact and classification: accepted owner-directed bounded policy deviation. Future hook design is deferred. New production adapter bytes invalidate runtime evidence only for claims involving this launch policy; prior input/build measurements remain historical within their original scope. Full 06B acceptance, quantified soak and 06C clearance remain pending.

## Runtime activation

The current human session runs a copied server stage and cannot receive this source edit. Leave Electron68197/driver68194 and its profile/transcript untouched. Supervisor must separately coordinate a refresh of the isolated runtime using the updated server stage; no renderer build is needed for this server-only change. A later new or resumed send from that updated server receives --auto. Existing rejected operations require a new owner-authorized request and are never replayed automatically.

No app input/restart, global configuration change, native permission grant, provider inference, Alpha operation or Git publishing is part of this source-ready task.
