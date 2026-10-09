# SPEC-04 Slice 04C — Orchestrator Review Pass 1

Reviewer: `/root/spec04_04c_acceptance`, fresh orchestrator-owned read-only `clean-room-reviewer`.

Candidate identity: 43/43 hashes plus four declared deletions verified from `SOURCE-SHA256.txt`; manifest digest `c255f626917d09db1045513845d8069523960f349c6cf94ab22542bb7addc774`.

Disposition: **FINDINGS — blocking verification gap, no code repair indicated**.

The inspected 04C code and integration are materially clean. Both builder-review pass-1 findings are closed: production workspace bootstrap no longer lists or auto-opens the retired null-view Legacy population, inactive reconnect sweeps are removed, explicit historical null-view response hydration remains read/cleanup-only, and the real Electron worksurface smoke now targets the production outer `ThreadRail`. Explicit view/session composition, the sibling `ContentArea` boundary, aggregate-host/dock retirement, caller migration, single production placement, hidden-command suppression, accepted 04A/04B behavior, SPEC-02/03 contracts, architecture checks, Electron smokes, V-ACTIONS, V-SUBMIT, V-ISOLATION, V-SHELL and V-BUILD are green.

Independent orchestrator checks also passed:

- manifest and four deletions;
- architecture/lifecycle source lane 20/20;
- V-BUILD, 1,940 modules;
- V-SHELL run `chat-arch-1790146926108-1e6acfc51a`, with exactly one active-view startup list, zero null-view lists and zero startup opens.

The required current-byte numeric acceptance is not complete. Full V-RENDER run `chat-arch-1790142897935-0c73af5c09` and five-minute run `chat-arch-1790143301546-b6109c6678` both returned nonzero `R1_FOCUS_UNAVAILABLE` with `measurementStarted:false` while the host was locked. No short warm/settled or 300,000-ms/9,520-character timing result exists for the 04C shell bytes. SPEC-04 explicitly requires these gates to pass, so 04C cannot be accepted or handed off yet.

Required resolution when the Mac can grant foreground focus:

1. Run full `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce`.
2. Run the registered `R1-FIVE-MINUTE-TYPING` case for 300,000 ms.
3. Preserve the configured thresholds and exact current source identity; do not automate or manipulate the owner Fusion window.
4. Repeat fresh builder-owned and orchestrator-owned review only if the rerun changes source or exposes a material defect. If current source passes unchanged, record the new receipts and repeat the final acceptance review.
