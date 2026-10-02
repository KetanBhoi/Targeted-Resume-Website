---
name: Portfolio privacy boundaries
description: Owner-only public content, consent-based publication, optional private written-practice saves, on-device audio, and private analytics.
---

Keep recruiter feedback separate from each visitor's career workspace. Public submission never implies public read access; authenticate reads/deletes and check a verified owner email against Clerk's server-side user record.

**Why:** Career-workbench sign-up is open to other candidates. Authentication alone does not make someone the portfolio owner. Clerk's development and production user stores are separate.

**How to apply:** Fail closed when owner configuration or identity verification is unavailable. Do not use a visitor-supplied email as authorization or automatically grant the first signed-in account ownership.

Keep mock interview drafts on-device by default. Written answers and reflections may be saved privately only through an explicit, informed save action. Keep recordings on-device and never upload them.

**Why:** Practice answers are personal. The user requested a private interview progress tracker with saved written answers while explicitly retaining on-device recordings.

**How to apply:** Distinguish ephemeral drafts from explicitly saved written records in privacy notices. Never include audio in persistence requests; stop microphone tracks on navigation and offer downloads before disposal.

Use private Publishing analytics for aggregate portfolio interactions, without sending free-form feedback, questions, emails, or visitor identities in custom events.

**Why:** Portfolio engagement is useful without exposing recruiter identities or private content.

**How to apply:** Instrument only event names and non-identifying dimensions; do not create a public analytics read endpoint.

Keep recruiting simulations clearly labeled as fictional practice, never professional experience. Publish recommendations only after author consent and owner approval; adding an entry does not imply publication.

**Why:** The user selected a fictional recruiting lab and consent-based, owner-approved recommendations. Practice must not misrepresent recruiting experience or expose unapproved endorsements.

**How to apply:** Keep lab records private, use invented candidates, and preserve separate consent, approval, and publication decisions for recommendations.

Public recruiting case studies are separately reviewed fictional practice, not permission to publish the underlying private lab record or claim employment experience.

**Why:** The user selected public fictional recruiting case studies alongside private preparation tools. Publishing a polished example should not expose private scores, reflections, or candidate notes.

**How to apply:** Require an explicit review of the exact public text, retain the fictional-practice disclaimer, and keep publication independent from changes or deletion of private preparation records.

Treat bearer-link fragments as sensitive to client-side analytics, even though HTTP requests and referrers omit them.

**Why:** The inspected published Replit-injected Umami tracker included full URL fragments by default; its injected tag did not enable hash exclusion. Fragment-only links therefore protect server URL logs but do not, by themselves, protect automatic page views.

**How to apply:** Capture and remove application-link fragments synchronously before the app or injected analytics runs, including later fragment navigation. Preserve refresh access in the browser's history entry, not a URL query. Do not add or configure Replit's injected analytics script.