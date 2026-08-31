# Security and robustness review — 2026-08-31

## Scope

Verified the eleven externally reported claims against the repository before changing code. No test, mock, fake data, or placeholder was added. Nothing was pushed.

## Claim disposition

| # | Disposition | Evidence and decision |
|---|---|---|
| 1 | Confirmed, fixed | The server joined a decoded request path to the repository root without proving containment. The server now rejects malformed, traversal, dotfile, and canonical junction/symlink escapes. |
| 2 | Confirmed, fixed | The public agent bridge and the generated editor command handler accepted messages without origin/source validation. Both sides now require same-origin, non-opaque messages from a trusted window and use an exact response origin. |
| 3 | Confirmed, fixed | `setLayerProperties` interpolated attacker-controlled strings into editor script source. Script string values are now produced with `JSON.stringify`, with input type validation. |
| 4 | Confirmed, fixed | Build patches used unchecked exact replacements. Required patches now report match counts and abort the build before writing generated output when an anchor is missing. Seven already-stale anchors are now surfaced explicitly. |
| 5 | Confirmed, mitigated | A completion message resolved every pending execution. Executions are now serialized to one in flight; timeouts reject and mark the uncorrelated legacy channel desynchronized. True request IDs require changing the legacy editor protocol. |
| 6 | Confirmed, fixed | Export fallback listeners were removed only on success and had no timeout. Export operations are serialized and clean up listeners and timers on success, failure, or timeout. |
| 7 | Rejected | The current service worker is registered by `index.html`, precaches an app shell, and has runtime caching/fallback behavior. It is not an unused network-only worker. No change made. |
| 8 | Partly confirmed, fixed | The downloader lacked a redirect limit, relative-redirect support, status validation, a timeout, and a response-size bound. Those checks were added. Async recursion did not establish the reported stack-overflow wording. |
| 9 | Partly confirmed, not changed | The recovery interval contains synchronous full-PSD serialization with no dirty/visibility gate, but its current `window.app` exposure patch is stale, so the path is presently inert. No reliable dirty-state contract was found; inventing one would be unsafe. |
| 10 | Partly confirmed, documented only | `performance.memory` is Chromium-specific, but every use is already feature-guarded and degrades to a no-op. This is a compatibility limitation, not a current crash bug. |
| 11 | Partly confirmed, fixed | Query-string version changes create new asset cache keys, but hour-cached HTML can delay delivery of those new references. Development HTML, scripts, styles, and JSON now use `no-store`; the service worker uses `no-cache`. |

## Implemented changes

- `4164f5c` — hardened local server path boundaries, canonical containment, local-only default binding, request-body limits, malformed input handling, cache policy, and removal of wildcard CORS.
- `33a3504` — hardened the public agent bridge, safely encoded script values, serialized legacy commands/exports, and guaranteed timeout cleanup.
- `05b9c56` + `5609bd7` — hardened upstream downloads and required build patches, plus secured the generated editor message handler. These commits are isolated on `codex/fix-build-runtime` until unrelated uncommitted edits in the shared checkout are resolved.

## Verification performed

- `node --check` passed for each changed JavaScript/MJS file in its isolated worktree.
- Server runtime probes passed for normal files and status, and returned the intended `400`/`403`/`413` results for malformed URLs, traversal/dotfiles, invalid JSON, and oversized bodies.
- The fixed server bound to `127.0.0.1` by default, honored an explicit `HOST` override, emitted no wildcard CORS header, and used the intended cache headers.
- Agent bridge existing regression suite: 29/29 passed. This was an existing suite; no tests were created.
- Build verification intentionally exits nonzero and lists seven stale required anchors instead of silently producing a partially patched bundle.
- `git diff --check` passed in all three isolated fix branches.

## Known build blockers now exposed

The current upstream/minified input no longer matches these required patch anchors: capability-prompt suppression, two telemetry/external-routing hooks, Install OpenShop visibility, `window.app` exposure, and PeaMark/About removal. The build is deliberately blocked until each behavior is re-derived from the current upstream bundle and verified.

## Mistakes and lessons

- A PowerShell HTTP response body was a byte array, so calling `.Trim()` on it failed. Decode response bytes explicitly before text assertions.
- Passing `-- --help` to the repository test command unexpectedly ran the full existing suite. Inspect package scripts before forwarding arguments.
- The first origin-gate draft could accept opaque `null` origins. Require a non-opaque same-origin value.
- Lexical path containment alone does not cover Windows junctions. Check containment again after canonical `realpath` resolution.
- The first core response patch preserved a top-level-frame guard, which would have made top-level commands time out. The final patch posts to `window.parent` even when it is `window` and ignores its own acknowledgement messages.
- Shared-checkout edits appeared while isolated work was running. Keep editing agents in worktrees and never overwrite or silently absorb unrelated uncommitted changes.
