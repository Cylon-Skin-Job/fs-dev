# SPEC-00 — Trusted Fusion Shell Authority

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`  
**Domain owner:** Electron shell bootstrap and server connection authority  
**Prerequisite:** owner-accepted Agent Tool Provenance product bytes integrated into the implementation baseline  
**Blocks:** Thread Group Foundation and every new privileged thread/System mutation  
**Does not depend on:** component tabs, BRIDGE-01, BRIDGE-02, thread groups, or Side Chat

## 1. Objective

Establish one server-verifiable distinction between the trusted Fusion Studio
shell and untrusted workspace, custom-view, browser, harness, model, or raw
localhost clients.

At acceptance, Fusion Studio still looks and behaves the same. The Electron
main frame loads from an Electron-owned secure origin, receives one validated
runtime endpoint descriptor through preload, authenticates each WebSocket with
a short-lived one-use proof, and is the only client allowed to create a chat
session or perform an existing durable thread mutation.

This SPEC extracts the trust/origin/transport work previously embedded in
`SPEC-01-THREAD-GROUP-FOUNDATION.md`. It changes no Thread Group schema,
portable chat component, tab placement, worksurface, Provenance, or provider
behavior.

## 2. Authorities And Dispatch Baseline

Read before implementation:

- `BUNDLE-INDEX.md`, `DECISIONS.md`, `ISSUES.md`, `GUIDANCE.md`, and
  `ROADMAP.md` in this folder;
- repository `AGENTS.md`;
- Code Standards: Architecture Routing, WebSocket Protocol, Universal Event
  Bus, Harness Adapters, Persistence And Metadata, and Testing And Smoke
  Slices;
- Chat System Overview, WebSocket Protocol, Thread Actions, Runtime Model,
  Structure, and Testing And Operations;
- the final owner-accepted Agent Tool Provenance implementation report and its
  exact integrated product baseline;
- the accepted TABS-03 report at
  `../026-Tab-Target-Placement/TAB_TARGET_PLACEMENT_ORCHESTRATOR_REPORT.md`;
  and
- current Electron main/preload/protocol/server-spawn code, renderer transport
  consumers, server startup/listen/session/router code, thread mutation routes,
  harness child spawns, and their tests.

Accepted TABS-03 implementation identity:

- implementation commit `22cc435`;
- integration commit `2748f03`; and
- exact accepted 22-path fingerprint
  `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666`.

TABS-03 is context only. This SPEC must not edit its accepted implementation,
recreate its placement controller, reinterpret `state_commit_failed`, or add
actor/time/permission/provenance authority to a placement result.

Agent Tool Provenance candidate
`AGENT-TOOL-PROV-616b34ab8f748fd2` is owner-accepted, but its report currently
states that its product bytes are uncommitted in
`/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`. No builder may
dispatch this SPEC until those exact accepted bytes are integrated into the
implementation checkout and an exact baseline commit/fingerprint is recorded.

BRIDGE-01 and BRIDGE-02 are external planning lanes. This SPEC neither depends
on nor authors their contracts. Before dispatch, re-inventory shared transport,
router, event-registry, admission, subscription, ledger, and protocol-test
paths against any bridge work that has since landed. Preserve later bridge
context as opaque, non-authorizing data.

## 3. Scope

### In scope

- a dedicated Electron-owned secure origin for the trusted app shell;
- strict separation between the shell origin and workspace/custom/browser
  content origins;
- a main-frame-only preload API returning one bounded runtime descriptor;
- one renderer transport owner for the WebSocket and every server-backed
  HTTP/resource URL;
- exact IPv4 loopback binding and endpoint validation;
- a per-launch high-entropy master delivered to the server through one
  inherited, one-read bootstrap pipe;
- a short-lived, one-use, connection-bound challenge/HMAC proof handshake;
- a server-owned `trusted-shell` connection role that cannot be asserted by a
  request field;
- gating current new-session creation and existing durable thread mutations on
  that role without redesigning those actions;
- reconnect, server-restart, stale-generation, replay, redaction, and failure
  behavior;
- a central allowlisted child-process environment builder that excludes shell
  authority material; and
- focused server, renderer, Electron, restart, and packaged-shell proof.

### Out of scope

- Thread Group tables, membership, primary history, migration, MRU, or group
  actions;
- `thread:action`, Pending New Chat, end-to-end Fork code removal, or any new
  thread action vocabulary;
- `ChatSurface`, `ThreadRail`, view-bound thread populations, Side Chat, or
  worksurface continuity;
- component/tab action context, Provenance event construction, UEB publication,
  ledger writes, or BRIDGE-01/BRIDGE-02 fields;
- System/View capsule relocation, protected-root filesystem enforcement,
  config editing, permissions/consent, plugins, or automation authority;
- accounts, remote authentication, LAN access, browser-only Fusion operation,
  or a general capability system; and
- provider credentials, provider session identity, model/variant policy, prompt
  acceptance, live streaming, Stop, transcript, or exchange behavior.

## 4. Trust Model

### 4.1 Trusted principal

The trusted principal is one live Electron main-frame shell instance for one
app/server launch generation. It is not a workspace, view, tab, component,
thread, model, attachment, file, localhost process, browser frame, or possession
of a public runtime endpoint.

The server records authority on its private per-connection session after proof
verification. Product handlers read only that server-owned connection state.
No inbound message may contain `trusted`, `role`, `origin`, `permission`,
`capability`, or equivalent data that enlarges authority.

### 4.2 Untrusted clients

All of the following are untrusted unless they independently complete the exact
main-frame proof path—which the contracts below make unavailable to them:

- workspace HTML and custom views;
- Browser and remote page frames;
- subframes, popups, and navigated/stale main frames;
- raw local WebSocket or HTTP clients;
- harness/CLI child processes;
- model output, prompts, attachments, Markdown, JSON, and view configuration;
  and
- a renderer from a prior server/app generation.

Loopback reachability is not authentication.

## 5. Shell Origin And Navigation Contract

Register a new privileged Electron scheme, such as `fusion-shell`, before app
readiness and serve only the built/development Fusion renderer assets from an
Electron-owned handler. The canonical main-frame origin is exactly
`fusion-shell://app`.

Keep workspace/custom content on a distinct content origin. The existing
`fusion-studio://` content scheme must not serve shell assets, and the shell
scheme must not resolve workspace paths, arbitrary files, server responses, or
remote URLs.

Electron main enforces all of the following:

1. the main frame may navigate only within the exact shell origin;
2. a subframe, popup, or child window may never load the shell origin;
3. workspace/custom/browser content cannot access or delegate through
   `parent.electronAPI`;
4. preload authority methods reject calls unless the sender is the current
   committed main frame at the exact shell origin and launch generation;
5. the existing subframe header-rewrite behavior cannot remove or weaken shell
   CSP/navigation protection; and
6. a rejected navigation or preload call has no mutation side effect and logs
   only a bounded fixed diagnostic.

The shell CSP names only its own assets, the exact loopback runtime endpoint,
and explicitly supported child-content origins. Server CORS names the exact
shell origin where required. Neither uses `*`, `localhost`, an origin reflected
from the requester, or a shared content/shell origin.

## 6. Runtime Descriptor And Transport Ownership

Electron main owns one immutable descriptor per launch generation:

```ts
type FusionRuntimeDescriptor = {
  generation: string;
  httpOrigin: `http://127.0.0.1:${number}`;
  webSocketUrl: `ws://127.0.0.1:${number}`;
};
```

The descriptor contains no secret. Preload returns it only to the exact current
main frame. The renderer validates a closed object shape, bounded opaque
generation, `http:`/`ws:` pairing, exact `127.0.0.1`, one identical valid port,
and no username, password, path, query, or fragment.

One renderer module owns the accepted descriptor and provides:

- WebSocket creation;
- server-backed HTTP URL construction;
- server-backed resource URL construction; and
- generation-change cancellation/reconnect signals.

Every current server consumer—including API requests, panels, styles, icons,
screenshots, view config, harness status, and discovered server resources—must
use this owner. No production consumer may derive the endpoint from
`window.location`, use a relative server URL from the shell scheme, assume
port 3001, or fall back to `localhost`.

A malformed, missing, or stale descriptor produces a visible disconnected
shell. It never guesses an endpoint. When the server restarts, Electron
publishes a new generation; the renderer aborts old-generation HTTP work,
drops the old socket and response trackers, rebinds once, and reloads
authoritative state through the normal initialization path.

The server listens only on IPv4 `127.0.0.1` with an OS-assigned or explicitly
validated loopback port. Startup readiness reports only that port to Electron.

## 7. Bootstrap Secret And Proof Protocol

### 7.1 Per-launch master

Electron main creates a cryptographically strong ephemeral master for each
server launch. It remains only in Electron main and server memory.

Electron passes the master to the server through a dedicated inherited pipe:

- never an environment variable;
- never a command-line argument;
- never stdin shared with another protocol;
- never stdout/stderr or a log;
- never a file, database, workspace, renderer value, crash report, or child
  process environment; and
- read exactly once and closed before the server reports readiness.

Missing, malformed, repeated, or over-bounded bootstrap data makes privileged
authentication unavailable and fails packaged Electron startup. A deliberately
standalone server may run its existing diagnostic/read paths but cannot mint a
trusted-shell role.

### 7.2 Connection handshake

For each new socket the server creates private bounded state and sends one
challenge containing only:

- connection ID;
- server nonce;
- launch generation;
- issue/expiry information; and
- protocol version.

The renderer creates a fresh nonce and asks preload to authorize that exact
challenge. Electron main validates the sender frame/origin/generation and
returns a one-use HMAC proof bound to protocol version, generation, connection
ID, server nonce, renderer nonce, and expiry.

The renderer sends the proof through the authentication message family. The
server validates closed shapes, bounds, Origin, generation, expiry, one-use
state, nonce/connection binding, and constant-time equality before setting
`trusted-shell` on that connection.

Challenges and proofs are single use. Reconnect and restart require new values.
Expired, duplicated, reordered, cross-connection, stale-generation, malformed,
or forged proof attempts never partially authenticate and return only a fixed
bounded error before close or read-only quarantine.

Authentication is transport authority, not a product command or UEB fact. It
is not published to Provenance or the Universal Event Bus.

## 8. Privileged Route Gate

Add one server-owned guard at the current thread WebSocket domain boundary.
Until Thread Group Foundation replaces the route vocabulary, it gates:

- `thread:open-assistant` only when it would create a new session;
- current thread Rename;
- current thread Delete;
- any other current public route that creates or destructively mutates a
  durable chat session discovered by the dispatch inventory.

Any legacy Fork/session-cloning route discovered at baseline is denied
unconditionally or removed before the guard activates. It is never preserved,
tested, or exposed as a trusted capability. SPEC-01 owns the remaining
end-to-end stale-symbol and provider-argument removal.

Passive list/open, history hydration, search, diagnostics, and other read-only
requests remain governed by their existing workspace/session rules. Resuming an
existing exact session through `thread:open-assistant` preserves current
behavior unless implementation inspection proves it performs a durable
mutation; any exception must be reported, reviewed, and tested rather than
silently guessed.

The guard runs after frame decoding and before manager, database, filesystem,
harness, UEB, or fan-out effects. Denial uses one bounded canonical error and
does not reveal proof details. Existing workspace/thread ownership validation
still runs for authenticated requests; shell authority does not replace it.

This SPEC does not introduce `thread:action`, request idempotency, group
identity, or new mutations. Thread Group Foundation consumes the exported guard
for its creation and action routes without changing the proof protocol.

## 9. Child-Process Secret Isolation

Create one server-owned child-environment builder with a documented minimal
allowlist plus explicit adapter-required additions. Every harness/CLI child
spawn uses it before privileged routes ship.

It unconditionally excludes:

- the launch master and bootstrap pipe metadata;
- runtime generation and proof/challenge/nonce material;
- server-only authority or test-injection values;
- Electron-only runtime descriptor data; and
- unknown environment values not explicitly needed by the child.

Electron's server spawn may use its separately documented server environment;
it must not spread authority material into environment variables. Static and
runtime canary tests cover every discovered harness/CLI spawn. This SPEC does
not redesign provider commands or remove adapter-specific variables that are
demonstrably required.

## 10. Failure, Restart, And Logging

1. A shell-origin or descriptor failure shows a disconnected shell and performs
   no privileged request.
2. A server crash rotates the master, generation, challenges, proofs, socket,
   and pending response ownership before reconnect hydration.
3. An old renderer or late old-generation response cannot authenticate, settle
   a current request, or mutate current state.
4. Authentication denial never calls a product manager or emits a mutation
   fact.
5. A failed requester delivery after an already-authorized product mutation
   follows that product route's existing recovery semantics; authentication
   does not invent replay.
6. Logs may contain only fixed result codes and non-secret bounded connection
   correlation. They exclude masters, proofs, nonces, challenges, authorization
   headers, full descriptors, prompts, payloads, and derived HMAC material.
7. Development, test, and packaged builds use the same production handshake.
   Test injection may supply deterministic entropy/clock/authority only through
   process-owned dependency seams unavailable in production and never through
   an inbound request field.

## 11. Code-Standards Compliance

- **Architecture Routing:** authentication is owned by one transport-security
  module; the existing client-message router and thread handler call its guard
  rather than duplicating checks.
- **WebSocket Protocol:** `shell-auth:*` is a narrowly justified transport
  family because no product-domain command family owns connection
  authentication. Product mutations retain their existing canonical routes.
- **UEB:** authentication commands and results are not facts. No authentication
  event enters canonical admission, ledger, subscribers, or resource refresh.
- **Harness boundary:** proof material and provider syntax never cross the
  product/adapter boundary; the child-environment owner enforces this.
- **Persistence:** no new durable credential or authentication table exists.
  Authority is launch- and connection-scoped memory only.
- **State:** the renderer holds only the public descriptor and transient
  challenge/proof long enough to authenticate; it never persists or exposes
  them through app stores.
- **File responsibility:** origin serving, descriptor validation, HMAC/proof
  state, server guard, child environment, and renderer transport each have one
  named owner. Do not place all responsibilities in `main.cjs`, `ws-client.ts`,
  `server.js`, or `client-message-router.js`.
- **Size:** any touched file over 400 lines receives only thin integration;
  new behavior is split by one-job ownership. Test files follow the same rule
  when they cover unrelated jobs; focused fixtures are retained when they are
  durable regression assets.

## 12. Dependency-Ordered Vertical Slices

### Slice 00A — Runtime endpoint and secure shell origin

- Inventory every production WebSocket, HTTP, and server-resource endpoint
  consumer and every main/subframe navigation path.
- Add the validated runtime descriptor and one renderer transport owner.
- Rebase all consumers, then move the main renderer to the exact secure shell
  origin and enforce navigation, frame, CSP, and CORS separation.
- Prove dev and packaged shell startup, existing content frames, server
  resources, generation cancellation, malformed-descriptor failure, and no
  `window.location`/relative/localhost endpoint bypass before proceeding.

### Slice 00B — One-use connection authentication

- Add per-launch master creation, one-read bootstrap pipe, challenge state,
  main-frame-only signing IPC, renderer handshake, constant-time verification,
  connection role, rotation, redaction, and deterministic test seams.
- Start from the public Electron shell and cross preload, socket, server
  verification, connection session, initialization, reconnect, and restart.
- Prove replay, stale generation, subframe/custom content, raw socket,
  delegation, expiry, mismatch, and standalone-server denial.

### Slice 00C — Privileged thread gate and child isolation

- Inventory existing durable thread creation/mutation routes and every
  harness/CLI spawn.
- Apply the single connection guard before mutation effects and route all child
  environments through the allowlisted builder.
- Exercise trusted New Chat and current Rename/Delete through the public shell;
  prove legacy session cloning is inaccessible; then cover untrusted denials,
  normal read-only behavior, provider launch, restart, and packaged acceptance.
- Export the guard/role contract for Thread Group Foundation without adding
  group, bridge, provenance, or tab behavior.

Each slice must be a public vertical increment with one fresh builder, builder-
owned first-clean review, orchestrator-owned first-clean review, exact changed
paths, verification results, warnings, deviations, and downstream effects.

## 13. Required Verification

Required focused proof includes:

- descriptor validation and generation rotation;
- every server-backed renderer URL consuming the centralized owner;
- `fusion-shell://app` main-frame success and shell-origin subframe denial;
- workspace/custom/browser frames retaining function without shell authority;
- `parent.electronAPI`, popup, stale navigation, and wrong-frame proof denial;
- exact `127.0.0.1` listener and rejection of wildcard/LAN binding;
- bootstrap master pipe lifecycle, bounds, close-before-ready, and no
  env/argv/log/file/renderer/child leakage;
- one-use proof success, replay, expiry, cross-connection, wrong nonce,
  wrong-generation, malformed shape, and constant-time comparison path;
- authenticated reconnect and server-restart reauthentication;
- trusted current New Chat and durable thread mutations succeeding;
- every legacy Fork/session-cloning request being inaccessible without a
  provider invocation or durable side effect;
- raw/custom/harness/model/request-field authority attempts failing before
  manager, database, mirror, provider, UEB, or fan-out effects;
- read-only routes preserving their existing behavior;
- child-environment canaries across every harness/CLI spawn;
- main/preload/server-spawn unit tests and server public-route integration;
- Electron development and packaged smoke; and
- current chat lifecycle, Provenance, component-tab, server, and client build
  regressions.

Run at minimum, adapted only to the accepted integrated baseline:

```bash
cd fusion-studio-client && node --test electron/*.test.cjs
cd fusion-studio-server && npm test -- --runInBand
cd fusion-studio-client && npm run build
cd fusion-studio-client && npm run electron:pack
```

The orchestrator must also run the exact accepted Agent Tool Provenance
regression commands from its integrated final report and the exact accepted
TABS-03 focused tests named by its report. If Electron test configuration adds
a purpose-built trusted-shell Playwright entry, run it against both a normal
launch and one server restart.

## 14. Expected Changed Areas

Expected, not exclusive after baseline re-inventory:

- `fusion-studio-client/electron/main.cjs` as thin integration only;
- `fusion-studio-client/electron/protocol-handler.cjs` or separate shell/content
  protocol owners;
- `fusion-studio-client/electron/preload-source.cjs`, generated preload, and
  preload tests;
- `fusion-studio-client/electron/server-spawn.cjs` and focused tests;
- new focused Electron runtime-descriptor and shell-proof modules/tests;
- one new renderer runtime-endpoint/transport owner plus bounded call-site
  migrations;
- `fusion-studio-client/src/lib/ws-client.ts` as thin consumer;
- renderer Electron/WebSocket types and focused source/Electron tests;
- `fusion-studio-server/server.js` and startup as thin integration only;
- new focused server shell-auth challenge/verifier/guard modules/tests;
- `fusion-studio-server/lib/ws/client-message-router.js`, session initialization,
  redaction, and thread handler integration;
- one central server child-environment builder and harness spawn call sites; and
- public-route, restart, origin/navigation, leak-canary, packaged, and regression
  tests.

No accepted TABS-03 implementation file, Thread Group migration, tab placement,
Provenance schema, canonical event admission, bridge contract, or view capsule
is edited.

## 15. Definition Of Done

1. The app main frame loads from an Electron-owned origin unavailable to
   workspace/custom/browser content.
2. One validated descriptor owns every renderer connection/resource endpoint;
   no production fallback derives it from the page or assumes localhost/port.
3. The server listens only on exact IPv4 loopback.
4. The launch master crosses one inherited one-read pipe and never enters
   environment, argv, logs, files, renderer state, or child processes.
5. Every socket authenticates with a fresh bounded one-use proof before it can
   create or durably mutate a thread.
6. Raw, subframe, custom-content, stale-generation, replayed, forged, model,
   harness, and request-asserted authority fails before mutation effects.
7. Trusted current New Chat and supported durable thread mutations still work,
   legacy session cloning is inaccessible, and read-only/current chat lifecycle
   behavior does not regress.
8. Restart rotates authority and reconnect hydrates only after fresh proof.
9. Child environments are centrally allowlisted and proven free of authority
   material.
10. No Thread Group, composable-chat, worksurface, tab-placement, bridge,
    Provenance-event, System relocation, plugin, or permission scope enters the
    implementation diff.
11. Builder and orchestrator first-clean reviews, required tests, packaged
    smoke, deviation accounting, and explicit owner acceptance are complete.

Until then, Thread Group Foundation and every later privileged chat mutation
remain blocked.
