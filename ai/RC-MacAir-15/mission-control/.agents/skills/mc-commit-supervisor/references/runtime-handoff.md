# Candidate development runtime handoff

Runtime follows settled code/Wiki acceptance and fresh whole-candidate review.
Use the exact candidate checkout's corrected `restart-fusion.sh`; copy its
cohesive `scripts/fusion-restart*.mjs` support into any disposable candidate.
The maintained personal procedure is
[fusion-electron-restart](/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md).
Definitions and injected fixtures do not prove a successful live app.

## Resolve ownership before effects

Record candidate realpath/HEAD/branch, reviewed byte identity, machine System
tree and explicit absolute disposable profile. Normal development and Alpha
processes/profiles remain outside a rehearsal. Never copy or restore their
databases. Before an isolated first launch, prevent migration 009 from attaching
the real development tree; the existing public-shell smoke's bootstrap pattern
is a reference, not evidence that this job ran.

`--repo` selects a Git worktree root. `--machine` overrides inherited
`FUSION_LOCAL_MACHINE`, otherwise `RC-MacAir-15` is used. `--user-data` overrides
inherited `FUSION_APP_USER_DATA`. With no profile environment/argument, the
unpackaged server retains `<repo>/fusion-studio-server/data/fusion.db` and uses
its checkout log; Electron uses the ordinary Fusion Studio profile. With an
explicit or inherited profile, the server owns `<profile>/server-data/fusion.db`
and `<profile>/server-live.log`. Never silently change that default database mode.

The restart script refuses Alpha, relative/overlapping paths, a borrowed
Electron binary, conflicting CLI/environment/profile or machine evidence,
foreign checkout profile users, orphan profile renderers and PID reuse. It
ignores shared global pidfiles/pkill patterns. Existing LaunchServices cwd `/`
can be safely selected from exact absolute executable/entry/profile facts;
the new launch must use the selected client cwd. A separate profile restart
lock prevents overlapping script writers. Verify a stale writer is inactive
before manually removing its lock; the script never guesses lock recovery.

## Rebuild and live evidence

```sh
<candidate>/restart-fusion.sh --repo <candidate> --machine <fixture-machine> --user-data <fixture-profile>
```

The selected client build must succeed. Only verified selected process trees
are stopped; the five documented renderer/session cache leaves and `server.port`
are cleared in the selected profile. Databases and unrelated caches stay intact.
The script launches the selected installed Electron executable/main directly
with matching profile/machine environment, private per-run TMPDIR/logs and a
loopback CDP probe. It uses the selected client's existing Playwright dependency
to attach, never a replacement app runtime or a new product health endpoint.

`RUNTIME_VERIFIED` requires actual main executable/entry/cwd/profile/machine,
server executable/entry/ancestry/owning listener and storage mode, renderer
executable/profile/ancestry, and the real `fusion-shell://app/` connection
indicator continuously connected for two seconds after shell initialization.
The existing indicator derives from WebSocket OPEN and renders only after
`workspace:init`; sanitized logs cannot substitute for this DOM observation.
The CDP client detaches after observation. Record actual command, exit status,
the per-run `target.json`/`verified.json`, launch/Electron/renderer/server logs
and protected-process/profile sentinels. Exercise the candidate's relevant
success/failure/regression and article/navigation behavior through the real
UI/server afterward; the canonical connection probe alone cannot prove a fix.

Wrong path/profile, dead server, disconnected renderer or missing independent
probe support withholds readiness. `failure.json` preserves `UNMET_RUNTIME_CHECK`
and diagnostic paths; a failed launched app may remain for investigation.
Return `unmet-gate` with exact evidence and the next authorized repair/check.
Never substitute another checkout or certify a dry-run/injected fixture as live.
Startup/generated-byte drift invalidates affected final review/check claims;
refresh those gates before owner readiness. End rehearsal by stopping only its
owned disposable tree, retaining evidence and proving source/index/ref and
normal/Alpha profile/process preservation. Runtime effects have their own
disposable recovery boundary; source checkpoints do not undo profile effects.
