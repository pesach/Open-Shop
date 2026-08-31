# Conversion and crash-recovery investigation — 2026-08-31

## Planned scope

Verify four reported runtime defects before editing:

1. Trace CLI `convert` through `/api/process` and prove whether output bytes are actually converted.
2. Trace crash-recovery export, persistence, restore, and logger calls end to end.
3. Determine whether two recovery engines are active, incompatible, or redundant and select one only from demonstrated runtime contracts.
4. Audit what the existing regression suite genuinely executes and what it only checks statically.

Constraints: isolated worktrees for code edits; no new tests, mocks, fakes, or placeholder behavior without explicit user permission; no push; preserve unrelated work.

## Work completed

### Verified findings

- The conversion report was correct. `/api/process` returned the submitted bytes unchanged with `ok: true`; `demo.psd` and the alleged PNG were both 10,966 bytes, had identical SHA-256 hashes, and began with `8BPS`.
- No server-side converter or conversion dependency exists in this repository. The truthful behavior is therefore an explicit unsupported-operation failure, not renamed input bytes.
- Both recovery scripts were active, opened separate databases, used the same banner ID, and relied on incompatible private editor assumptions.
- `openshop-autosave.js` misread `exportDocument()` as `{ data }`, called nonexistent `OpenShopLogger.info()`, and stored null snapshots. It was the duplicate engine and was deleted.
- The earlier recovery engine was also inert because `window.app` is not exposed. It now uses the editor's verified `app.echoToOE` / `saveToOE` scripting protocol through `OpenShopAgent`.
- The original 29 assertions were 18 existence checks, five CSS substrings, two live status constants, and four PSD-header inspection checks. The later 36 count only added seven icon existence checks. Neither conversion nor recovery executed.

### Implemented

- `a952b7d` makes `/api/process` return HTTP 501 with an explicit unsupported-conversion error. The Node client now throws before creating an output file.
- `9b2e203` consolidates recovery to `openshop-recovery.js`, deletes `openshop-autosave.js`, removes it from the page and service-worker cache, validates PSD magic, waits for IndexedDB transaction completion, uses the logger's public `log()` method, suppresses overlapping/hidden-tab autosaves, and restores through `OpenShopAgent.openFile()`.
- The existing regression harness now removes the deleted-file assertion and launches this checkout's server on an OS-assigned isolated port. It no longer depends on an unidentified process already listening on port 8888. No new test was created.

### Verification

- Conversion after the fix: explicit failure, nonzero client result, and no output path created.
- Integrated browser recovery round trip: real `demo.psd` opened; `saveNow()` returned true; IndexedDB stored a 12,478-byte `ArrayBuffer` beginning `8BPS`; reload displayed the recovery banner; Restore reopened one `file.psd` document; the banner disappeared; logger error count remained zero.
- Exactly one custom recovery engine/database was active in a fresh browser profile.
- Service worker activated, cached `openshop-recovery.js`, and did not cache the deleted autosave script.
- Existing repository suite passes 35/35 against the server launched from this checkout. These 35 checks still do not constitute automated conversion or recovery coverage.

### Lessons and mistakes

- A probe-cleanup command that combined process work and deletion was rejected. Separate runtime actions from exact-target cleanup; validate the target first.
- Browser snapshot evaluation runs in an isolated read-only scope and cannot prove page globals. Use scoped developer runtime inspection for live JavaScript contracts.
- Cache API entries are `Request` objects; inspect `new URL(request.url).pathname`, not `request.pathname`.
- `PORT=0` correctly requests an OS-assigned port, but the server logged the requested value instead of `server.address().port`. The harness initially connected to port 80; the server now reports its actual bound port.
- Deleting a service-worker precache entry without updating `sw.js` can silently degrade installation because the worker catches `cache.addAll()` failure. Loader and precache inventories must change together.
- A first recovery design patched minified core internals and expanded to six files. Reusing the verified public scripting bridge kept the implementation to five files and made it survive future generated-bundle rebuilds.
- Two temporary isolated Chrome profile directories created during verification remain under the Windows temp directory because recursive cleanup was blocked: `openshop-recovery-chrome-2` and `openshop-recovery-chrome-3`.

### Remaining test limitation

No automated conversion or browser save/reload/restore test was added because repository policy requires explicit permission before creating tests. The current green suite must not be described as certification for either workflow.
