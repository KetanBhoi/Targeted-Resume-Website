---
name: React version changes and Vite cache
description: Vite can keep serving prebundled React dependencies after package versions change.
---

When upgrading or aligning React and React DOM, a development preview may continue reporting a version mismatch even when the workspace package links and lockfile now resolve to matching versions. The artifact-local Vite optimization cache can be stale.

**Why:** The browser consumes Vite's optimized dependency bundle, not the package links directly, so restarting alone may leave an old prebundle in use.

**How to apply:** If installed React and React DOM versions match but the browser still reports a mismatch after restart, clear that artifact's generated `node_modules/.vite` cache and restart its web workflow.