# Slice 04C builder review pass 1

- Reviewer: `/root/spec04_slice04c/review_04c_pass1`
- Terminal disposition: `FINDINGS — NOT CLEAN`
- Candidate manifest digest: `428da0dfe65078cf5f9c34d73396a863130b24045258c2f4d11caa095a64146c`
- Lifecycle: reviewer reached terminal status before repairs began. This runtime exposes no `close_agent` operation, so closure could not be attempted; the terminal reviewer is non-conflicting and edited no files.

## Material findings routed to the builder

1. High: workspace bootstrap still sent `thread:list` for `viewId: null`, and the null-view response path still selected/opened the Legacy MRU despite retirement of the production Legacy host.
2. Material: `thread-worksurface-electron-smoke.mjs` still addressed the deleted `ViewWorksurfaceDock` selectors instead of the production outer `ThreadRail`.

## Builder disposition

Both findings were accepted as valid. The repair removes automatic null-view list/open work while preserving explicit historical null-view response hydration for read/cleanup compatibility; migrates the Electron worksurface smoke to the production shell rail; adds a real-shell startup command oracle; and adds source enforcement for the retired paths. A fresh reviewer pass is required after affected verification and evidence are resealed.
