# Lessons

Repo-level lessons learned during orchestration sessions. Reference this file
from handoffs when a distinction is easy to forget or has already caused a
wrong implementation direction.

## 2026-06-07 - OpenCode Thinking And Terminal Events

### Exit Code 0 Is Not A Reasoning Signal

OpenCode process exit code `0` only means the CLI process completed
successfully. It does not say anything about whether the model reasoned, whether
reasoning text was exposed, or whether Fusion received a terminal stream event.

Keep these separate:

- Reasoning visibility: whether OpenCode emits visible reasoning text, such as
  `part.type === "reasoning"` with non-empty `part.text`.
- Reasoning token usage: whether OpenCode reports `tokens.reasoning`.
- Terminal completion: whether OpenCode emits `step_finish`, which Fusion maps
  to canonical `turn_end`.
- Process completion: whether the OpenCode child process exits, and with which
  code.

Do not treat `tokens.reasoning` as a thought trace. Do not treat exit code `0`
as a `turn_end`.

### Missing `step_finish` On Clean Exit Is A Terminal Contract Issue

Slice 9 found OpenCode model/flag combinations that can emit useful text, and
sometimes reasoning text, then exit successfully without emitting `step_finish`.
Fusion's current OpenCode harness treats that as:

```text
OpenCode process exited before turn_end
```

The correct repair is not a wait-and-kill timer. The process is already gone.
For clean exit after useful output, Fusion should synthesize a canonical
`turn_end` and mark metadata, for example:

```text
terminalSource: "process_exit_missing_step_finish"
```

Keep strict errors for:

- nonzero process exit
- process error
- clean exit with no useful assistant output

Timeouts/watchdogs are a separate problem for a process that stays alive and
never exits.

### `--thinking` And `--variant` Are Different Controls

OpenCode exposes both:

```text
--thinking  show thinking blocks
--variant   provider-specific reasoning effort, such as high, max, minimal
```

`--thinking` is about visible thinking blocks. `--variant` is about
provider/model reasoning effort. They can interact, but one does not imply the
other.

Known Slice 9 result:

- `openai/gpt-5.5 --thinking` was `GOOD_VISIBLE_THINKING`.
- `openai/gpt-5.5 --thinking --variant high` was also
  `GOOD_VISIBLE_THINKING`.
- `opencode/mimo-v2.5-free` and `google/gemini-2.5-flash` can emit useful
  output but may miss terminal `step_finish`.

Do not enable visible thinking globally. Treat it as a model/profile capability
until proven stable for a specific model/variant combination.

### Free Or Weak Endpoints May Need Degraded Behavior

Some free or lower-tier endpoints may support enough OpenCode protocol to return
text but not enough to produce a complete Fusion-quality stream contract. This
does not mean OpenCode as a harness is bad, and it does not mean Fusion's
frontend is broken.

Classify model profiles by observed behavior:

- visible thinking supported
- no visible thinking, but stable terminal stream
- useful text with missing terminal event
- provider/model error
- hang or timeout

Product behavior should be based on the profile, not on assumptions about a
provider or model family.

## 2026-06-07 - OpenCode Picker And Install Status

OpenCode can be registered in the server harness registry and still be absent or
disabled in the New Chat picker when a multi-harness config makes that picker
visible.

There are three separate surfaces:

- Runtime registry: `fusion-studio-server/lib/harness/registry.js`
- Picker catalogs:
  - `fusion-studio-client/src/config/harness.ts`
  - `fusion-studio-server/lib/cli-config/catalog.js`
- Install-status gate: `/api/harnesses`, backed by
  `fusion-studio-server/lib/harness/harness-status-service.js`

Slice 7 added OpenCode to the picker catalogs. The item was visible but not
clickable because `OpenCodeHarness` did not expose `cliName = "opencode"`.
The status service probes non-Kimi CLI install state through `harness.cliName`.

When adding a new harness that should be selectable in a multi-harness config:

1. Register it in the runtime registry.
2. Add it to both picker catalogs.
3. Ensure it exposes a CLI name or built-in status for install probing.
4. Confirm `/api/harnesses` reports it installed or built in.
5. Confirm `cli.json` lists and enables it.
6. Confirm picker selection sends `thread:open-assistant` with the selected
   `harnessId`.

## 2026-06-07 - `cli.json` Is Harness Policy

Slice 11 changed `ai/system/config/cli.json` from a cosmetic catalog override
into the workspace harness policy.

Current semantics:

- `defaultHarness` controls the harness used for new threads when no explicit
  `harnessId` is supplied.
- `harnesses` is the allow-list for new-thread creation and UI display.
- A listed harness with `enabled: true` is allowed and displayed.
- A listed harness with `enabled: false` is not displayed and not allowed for
  new-thread creation.
- An absent harness is not displayed and not allowed for new-thread creation.
- Missing, empty, or malformed `cli.json` falls back to OpenCode-only.
- OpenCode-only config hides the selector; New Thread directly creates an
  OpenCode-backed thread.

Do not add a separate `harness-policy.json`; that would split one concern across
two files. `cli.json` owns both policy and display metadata. The runtime harness
registry still contains Kimi and other hooks for advanced users/plugin authors,
but registry presence alone does not make a harness selectable.

Existing historical threads are not migrated by this policy. They should still
hydrate with their stored `harness_id`.

## 2026-06-07 - Default Harness Switch Gates

Do not switch the default harness just because an opt-in smoke passes.

Before defaulting new threads to OpenCode, verify:

- OpenCode thread creation works from OpenCode-only `cli.json`
- text streaming works
- tool calls work
- stop/interrupt works
- per-thread OpenCode session continuity persists through cold runtime restart
- clean-exit missing-terminal behavior is repaired
- existing Kimi threads keep `harness_id = "kimi"`
- explicit `harnessId` still wins

The default switch should only change the default for newly created threads.
It should not migrate existing threads.
