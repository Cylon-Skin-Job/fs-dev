# Startup negative proof

R1 executable negative and R2 identity-only masking-control evidence are available; both slices are accepted. Codex side chat (ephemeral), repair orchestrator `/root/startup_integrity_repair_orchestrator`.

Before edits, all 82 approved source hashes matched and the builder preserved eleven exact audited files with SHA-256 values in [R1/PREIMAGE-RECEIPT.json](R1/PREIMAGE-RECEIPT.json). Orchestrator independently verified all copied bytes. The nonce-owned root `chat-ar-r1-preimage-0eszen0n` remains retained for R2. No reset or reconstruction of shared checkout bytes occurred.

The new executable startup test invokes exported `startup.start()` and its actual HTTP listen callback. The negative fixture copies only exact saved startup/runtime into a marker-owned shadow with unchanged current dependency owners; positive cases use current production directly. It preserves the real effect registry and consumer oracle. The audited registration rejects `workspace-automation-pipeline`, so components are never loaded. The test fails at expected consumer count 1/actual 0 and retains the real unknown-name exception.

Builder command from server checkout:

```sh
STARTUP_INTEGRITY_PREIMAGE_ROOT='/private/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-ar-r1-preimage-0eszen0n' npx jest --runInBand --runTestsByPath test/runtime/workspace-startup-integrity.test.js -t 'actual normal'
```

Expected exit 1, one failed test/two filtered skips. [Builder raw log](R1/negative-startup-preimage.log), SHA-256 `f2b852d444c9ab2f2aeebbe1d62915a3484d96a4cd4e2f197599e14cc1303adf`, port 51403. The orchestrator reran the same command with the same causal failure, port 51442; [independent raw log](R1/orchestrator-negative-preimage.log). Both per-case roots were removed and guard/listener identities restored. Normal shutdown's owner-drain deadline and fallback cleanup are explicit fixture limitations, not a production shutdown pass.

The saved AST audit is supporting diagnosis only. This R1 negative case does not prove readiness safety because IA-01 masks IA-02. R1 current positive source/test hashes are in [CURRENT-FINGERPRINTS.json](R1/CURRENT-FINGERPRINTS.json).

## R2 distinctly labeled identity-only counterfactual

The pristine saved audit probe/result remain unchanged: direct factory work bypasses unavailable readiness while the disconnected wrapper declines. R2 creates a separate eleven-file copy of the audited preimages at `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-ar-r2-identity-control-0vi4iw2c`, with a distinct owner/nonce. [IDENTITY-CONTROL.json](R2/IDENTITY-CONTROL.json) records every original/current hash and dependency resolution. The sole source delta replaces the old effect-name literal in copied runtime, SHA-256 `d5fba64a72c8a5d5340bbe1edc57878ae5e377e2ab8e4ee3014c2e567294ee6a` → `9cbc2e8a1142550523f5f10995a4174cad99f69f2f5aa8cc7a8d4e0b9857a8b8`. Copied startup remains `cab1812bcf64f579b64c70d22d54ac93042d24aeb5ba2d21dc6ab660f2a2bda3`.

Orchestrator independently verified all eleven copy hashes, exactly that literal replacement, and four executed readiness/view/controller dependency hashes. The actual-startup shadow loads copied startup/runtime and unchanged real dependencies. Original startup never imports readiness-startup; current repaired wrapper cannot enter this control. This is identity-corrected audited composition, not pristine audited production.

Command from server checkout:

```sh
STARTUP_INTEGRITY_PREIMAGE_ROOT='/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-ar-r2-identity-control-0vi4iw2c' npx jest --runInBand --runTestsByPath test/runtime/workspace-startup-integrity.test.js -t 'actual unavailable startup|actual normal startup'
```

Builder expected exit 1, two readiness failures/eleven filtered skips, [raw result](R2/identity-only-negative.log). Independent rerun has the same causal failure, ports 51742/51746, [raw result](R2/orchestrator-identity-only-negative.log), SHA-256 `e169a906c310bd333a94f635487c1aac1da27c3241ab0711a714e04f153e9360`. Ready initialization runs all eleven stages at lease 0 instead of 1. Genuine unavailable/root_conflict remains from the controller's registered-workspace pass, but all eleven stages still run at lease 0 instead of none. No unknown-name rejection masks either assertion. Both test roots are removed and guards/listeners restored; retained controls remain untouched.

The same final ready/unavailable canaries pass on current repaired source in the independent 117-test R2 suite, with eleven ready stages under one acquire/release and no refused-work stages. [R2 inspection](R2/ORCHESTRATOR-INSPECTION.md) records current hashes, checks and limits. Both fresh R2 gates are CLEAN, with [separate acceptance](R2/R2-ACCEPTANCE-REVIEW-01.md); R3's actual-server and public-provider evidence remain separate requirements.
