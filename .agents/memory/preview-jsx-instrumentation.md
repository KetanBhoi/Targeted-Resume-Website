---
name: Preview JSX instrumentation
description: A development-only metadata transformation can reject otherwise valid generic JSX component invocations.
---

Do not assume a successful TypeScript check and production build prove the development preview can parse explicit generic JSX.

**Why:** The preview metadata transformation inserted component attributes before a JSX type-argument delimiter, producing invalid syntax. The original TypeScript source and production build were valid; only the instrumented development preview failed.

**How to apply:** Prefer generic inference from typed component props when practical. Check the actual preview after adding generic JSX invocations rather than disabling instrumentation or weakening the component's types.