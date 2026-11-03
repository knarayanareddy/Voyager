# Voyager remediation plan

Proposed work only; see [review](REVIEW.md). Dependencies: `VO-T1 → VO-T2 → VO-T3 → VO-T4 → VO-T5`.

### VO-T1 — Select variant and reproduce baseline (VO-1, VO-2)
Prerequisite: owner identifies supported applications. Observed paths: `.github/workflows/ci.yml`, all three nested `package.json` files.
1. Inspect the failed historical run's logs and identify the actual failed step without assuming its cause.
2. Run each supported app's existing build and available checks in isolated clean environments; record versions and failures.
3. Trace each app's persistence and feature differences and decide whether variants are maintained independently.
Deliverable: candidate inventory and reproducible baseline. Verification: independent reviewer reproduces the failed step or records why it cannot be reproduced.
- [ ] Each supported variant and its scope is named.
- [ ] CI failure cause is evidenced or explicitly unresolved.

### VO-T2 — Protect data and validate core behavior (VO-4)
Prerequisite: VO-T1; owner approves privacy and storage requirements. Observed paths: `voyager-app-feature-expansion/src/context/DatabaseContext.tsx`, `src/utils/db.ts`, `src/components/MarkdownRenderer.tsx` within that app, and equivalent supported variants.
1. Trace storage, serialization, rendering, media permissions and any external data transmission in each supported variant.
2. Implement or accurately describe confidentiality, input sanitization, export and data-loss behavior; remove unsupported security claims.
3. Test malicious markup, denied permissions, storage failures and synthetic data export/import with independent expected outcomes.
Deliverable: documented data boundary and corrected behavior or claims. Verification: deliberately weaken a renderer or storage error path and confirm the appropriate negative test fails.
- [ ] Data persistence and protection claims are supported or narrowed.
- [ ] Failure and injection cases are tested without real personal data.

### VO-T3 — Repair and broaden automation (VO-1–VO-3)
Prerequisite: VO-T2. Observed paths: `.github/workflows/ci.yml`, `voyager-app-feature-expansion/e2e/`, nested manifests.
1. Fix the evidenced CI failure without weakening coverage or skipping tests.
2. Add required build/type/test jobs for each owner-supported variant; define missing scripts before invoking them.
3. Add user-visible editor, reload persistence, export and media-denial E2E checks beyond the current smoke selection.
Deliverable: candidate-specific automation. Verification: intentionally break a saved-note round trip and observe the corresponding E2E test fail.
- [ ] Supported variants are independently gated.
- [ ] Critical journeys and negative cases are exercised.

### VO-T4 — Deploy and recover (preventive)
Prerequisite: VO-T3; owner approves platform and data policy. Observed paths: nested package lockfiles; proposed release and recovery runbooks.
1. Build immutable artifacts from locked dependencies and record provenance and audit results.
2. Stage the chosen application and verify the served revision and browser storage behavior.
3. Demonstrate export/import or other approved restoration using synthetic notes and roll back to a prior verified artifact.
Deliverable: release and recovery evidence. Verification: an independent observer checks restored content and the actual served revision.
- [ ] Candidate artifact and dependency versions are recorded.
- [ ] Restore and rollback are observed.

### VO-T5 — Independent UX acceptance (preventive)
Prerequisite: VO-T4. Observed paths: supported app's `src/components/` and `src/index.css`.
1. Test keyboard-only editing, focus management, permission-denial messages and contrast.
2. Check responsive layouts and assistive technology behavior on supported browsers.
3. Independently repeat representative note, search, graph and media journeys and document limitations.
Deliverable: accessibility and acceptance record. Verification: observe users completing core flows without relying only on snapshots.
- [ ] Critical usability barriers are resolved or explicitly accepted.
- [ ] Owner approves supported variants and candidate release.

## Gates and rollback

Owner approval is required for variant selection, privacy promises, hosting, retention and recovery objectives. No production promotion while the candidate CI failure remains unresolved or a required restore is unobserved. Roll back to a previously verified immutable artifact and retain evidence of the failed candidate.
