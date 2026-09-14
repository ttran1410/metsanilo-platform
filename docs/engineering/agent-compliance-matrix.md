---
last_updated: 2026-09-14
document_type: reference
status: partial
---

# Agent instruction compatibility

`AGENTS.md` is the canonical repository policy. Vendor files are optional discovery adapters and are not checked as mandatory repository structure.

| Agent/ecosystem | Entry point | Status | Verification needed |
|---|---|---|---|
| Codex | `AGENTS.md` and nearest nested `AGENTS.md` | Supported — repository convention | Re-run after major Codex changes |
| Claude-compatible agents | Optional `CLAUDE.md` → `AGENTS.md` | Adapter present | Confirm with the deployed agent version |
| Gemini/Antigravity-compatible agents | Optional `GEMINI.md` → `AGENTS.md` | Adapter present | Confirm with the deployed agent version |
| OpenCode | `AGENTS.md` where supported by the configured version | Unverified | Run the smoke test before relying on nested discovery |
| All agents | GitHub Actions `verify:release` check | Workflow present | Confirm required pull request status check in GitHub settings |

Adapters may be removed without failing `verify:policy`. If an agent does not discover `AGENTS.md`, pass the canonical policy through that tool's project/system configuration instead.

“Supported” describes the repository convention and tested discovery path, not a hard security boundary. Markdown instructions are advisory model context; CI, tests, and runtime authorization must enforce invariants independently.
