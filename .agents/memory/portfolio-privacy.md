---
name: Portfolio privacy boundaries
description: Owner-only recruiter feedback, on-device interview practice, and private publishing analytics.
---

Keep recruiter feedback separate from each visitor's career workspace. Public submission never implies public read access; authenticate reads/deletes and check a verified owner email against Clerk's server-side user record.

**Why:** Career-workbench sign-up is open to other candidates. Authentication alone does not make someone the portfolio owner. Clerk's development and production user stores are separate.

**How to apply:** Fail closed when owner configuration or identity verification is unavailable. Do not use a visitor-supplied email as authorization or automatically grant the first signed-in account ownership.

Keep mock interview drafts and recordings on-device and do not upload them.

**Why:** Practice answers are personal; recording is optional and is not a persisted workbench record.

**How to apply:** Preserve explicit local-only and unsaved-work disclosures, stop microphone tracks on navigation, and offer downloads before disposal.

Use private Publishing analytics for aggregate portfolio interactions, without sending free-form feedback, questions, emails, or visitor identities in custom events.

**Why:** Portfolio engagement is useful without exposing recruiter identities or private content.

**How to apply:** Instrument only event names and non-identifying dimensions; do not create a public analytics read endpoint.