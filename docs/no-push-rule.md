# Mandatory Local-Only Development & No-Push Protocol

## 🚫 Strict Prohibition on `git push`

1. **NO AUTO PUSH**: Under NO circumstances should an agent run `git push` or publish commits to remote repositories without explicit user instruction.
2. **LOCAL REVIEW FIRST**: All work must be served locally on `http://localhost:8888` and reviewed by the user.
3. **USER COMMAND ONLY**: Only push when the user explicitly types a command such as "push it" or "push to github".

## 🧪 Verification Protocol Before Presenting Work

1. Run DOM computed style checks to verify no white rectangles (`rgb(255, 255, 255)`) in panels or options bar.
2. Take browser screenshots and visually compare them with the user's reference screenshots.
3. Check `window.OpenShopLogger.getErrors()` to ensure `0 Errors`.
