# Conversion and crash-recovery investigation — 2026-08-31

## Planned scope

Verify four reported runtime defects before editing:

1. Trace CLI `convert` through `/api/process` and prove whether output bytes are actually converted.
2. Trace crash-recovery export, persistence, restore, and logger calls end to end.
3. Determine whether two recovery engines are active, incompatible, or redundant and select one only from demonstrated runtime contracts.
4. Audit what the existing regression suite genuinely executes and what it only checks statically.

Constraints: isolated worktrees for code edits; no new tests, mocks, fakes, or placeholder behavior without explicit user permission; no push; preserve unrelated work.

## Work completed

Investigation in progress.
