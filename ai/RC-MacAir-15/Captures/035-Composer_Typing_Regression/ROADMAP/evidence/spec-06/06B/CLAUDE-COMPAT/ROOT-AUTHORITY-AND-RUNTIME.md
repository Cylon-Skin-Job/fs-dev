# Owner-directed Claude compatibility removal

Supervisor relays owner request: “We need to also get rid of whatever is pulling in Claude’s stuff. I haven’t used it in months. It’s stale.” Scope: narrow durable policy for Fusion-launched OpenCode, through retained builder06b and focused checks/reviews. No global file deletion, shell change, permission bypass, --auto, or adjacent completion repair. Keep existing human Electron64115/driver64110 untouched and recording.

Exact installed version verified independently: /opt/homebrew/bin/opencode1.18.32. Root reviewed upstream v1.18.32 packages/opencode/src/effect/runtime-flags.ts (broad flag controls Claude prompt and skill fallbacks), skill/index.ts (Claude skills excluded while .agents/native directories/explicitpaths remain), and session/instruction.ts (globalClaude and projectCLAUDE.md fallback excluded while AGENTS/native settings remain). The earlier core/flag URL contains no declaration because runtime flags own this behavior. Historical .agents collateral behavior does not apply to this version. Sources are recorded in builder upstream.json.

The running human session uses a separately copied staged child-environment.js, not a symlink. At07:28:48UTC its SHA256 was64cf7bef1bea086aec1260a0089e7c310ab6a7d85dfa4985dfae76b6bd3b9cbc and it had no Claude-disabling policy; driver64110/Electron64115 were alive. Development source changes cannot update that staged server or its loaded modules. No runtime mutation is authorized now. A newly staged/relaunched Fusion session using updated server source will be needed. A new chat/provider session is also needed to start without the stale Claude content already present in the existing transcript; changing environment policy cannot erase history.

The policy disables automatic compatibility discovery. It is not a filesystem access denial, transcript eraser, or cleanup of deliberately configured paths, and does not modify Claude files or provider credentials.

## Eight-field deviation

1. Original: SPEC06/06B is sustained/native/owner acceptance, with necessary product repairs routed through the builder.
2. Actual: add fixed Claude-compatibility disabling policy only to production OpenCode child environments and focused policy/route/discovery tests.
3. Reason: explicit owner-directed removal of stale automatically discovered Claude content observed during human testing.
4. Files: child-environment.js plus narrowly affected tests/discovery fixture; builder supplies final frozen delta.
5. Checks: default/override resistance, unchanged other-family/credential isolation, actual production spawn boundary, installed OpenCode discovery excluding Claude while retaining .agents/native skills; fresh builder/root reviews.
6. Effect: future OpenCode launches from updated Fusion source skip automatic Claude rule/skill compatibility. Existing staged human session stays untouched.
7. Risk/downstream: existing transcript still contains already loaded material; current session needs separately authorized relaunch and newchat for clean context. Reuse old B20/human evidence only for its recorded source and claims; newpolicy is not a numerical benchmark pass or permission repair.
8. Classification: accepted explicit owner-scoped product policy change. No unavoidable .agents/native-skill collateral effect found in exact-version source. Full06B/owneracceptance and06C remain pending.
