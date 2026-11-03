# Voyager remediation plan

Proposed work only; see [review](REVIEW.md).

### VO-T1 — Select variant and reproduce baseline (VO-1, VO-2)
Prerequisite: owner identifies supported applications. Observed sampled sources: `.github/workflows/ci.yml`, `evidence/Voyager/snapshot.json:210-216`, and all three nested `package.json` files.
1. Inspect the failed historical run's logs and identify the actual failed step without assuming its cause.
2. Run each supported app's existing build and available checks in isolated clean environments; record versions and failures.
3. Trace each app's persistence and feature differences and decide whether variants are maintained independently.
Deliverable: candidate inventory and reproducible baseline. Verification: independent reviewer reproduces the failed step or records why it cannot be reproduced.
- [ ] Each supported variant and its scope is named.
- [ ] CI failure cause is evidenced or explicitly unresolved.

### VO-T2 — Protect data and validate core behavior (VO-4)
Prerequisite: VO-T1; owner approves privacy and storage requirements. Observed sampled sources: `README.md`, `voyager-app-feature-expansion/src/App.tsx`, `voyager-app-feature-expansion/src/components/LogseqApp.tsx:1-220`, `voyager-repository-deep-dive/src/App.tsx`. Tree-existing but uninspected candidate bodies for this task: `voyager-app-feature-expansion/src/context/DatabaseContext.tsx`, `voyager-app-feature-expansion/src/utils/db.ts`, `voyager-app-feature-expansion/src/components/MarkdownRenderer.tsx`, and equivalent files in any owner-supported variant.
1. Trace storage, serialization, rendering, media permissions and any external data transmission in each supported variant.
2. Implement or accurately describe confidentiality, input sanitization, export and data-loss behavior; remove unsupported security claims.
3. Test malicious markup, denied permissions, storage failures and synthetic data export/import with independent expected outcomes.
Deliverable: documented data boundary and corrected behavior or claims. Verification: deliberately weaken a renderer or storage error path and confirm the appropriate negative test fails.
- [ ] Data persistence and protection claims are supported or narrowed.
- [ ] Failure and injection cases are tested without real personal data.

### VO-T3 — Repair and broaden automation (VO-1–VO-3)
Prerequisite: VO-T2. Observed sampled sources: `.github/workflows/ci.yml`, `voyager-app-feature-expansion/package.json`, and `evidence/Voyager/snapshot.json:16-35`. Tree-existing but uninspected candidate bodies: `voyager-app-feature-expansion/e2e/smoke.spec.ts`, `voyager-app-feature-expansion/e2e/voyager.demo.spec.ts`, `voyager-app-feature-expansion/playwright.config.ts`, plus any test files added for other supported variants.
1. Fix the evidenced CI failure without weakening coverage or skipping tests.
2. Add required build/type/test jobs for each owner-supported variant; define missing scripts before invoking them.
3. Add user-visible editor, reload persistence, export and media-denial E2E checks beyond the current smoke selection.
Deliverable: candidate-specific automation. Verification: intentionally break a saved-note round trip and observe the corresponding E2E test fail.
- [ ] Supported variants are independently gated.
- [ ] Critical journeys and negative cases are exercised.

### VO-T4 — Deploy and recover (preventive)
Prerequisite: VO-T3; owner approves platform and data policy. Observed sampled sources: the three nested `package.json` manifests only. Tree-existing but uninspected artifacts: nested `package-lock.json` files. Proposed paths/documents: release runbook, staging config, restore runbook, and provenance record.
1. Build immutable artifacts from locked dependencies and record provenance and audit results.
2. Stage the chosen application and verify the served revision and browser storage behavior.
3. Demonstrate export/import or other approved restoration using synthetic notes and roll back to a prior verified artifact.
Deliverable: release and recovery evidence. Verification: an independent observer checks restored content and the actual served revision.
- [ ] Candidate artifact and dependency versions are recorded.
- [ ] Restore and rollback are observed.

### VO-T5 — Independent UX acceptance (preventive)
Prerequisite: VO-T4. Observed sampled sources: `README.md` feature claims plus `voyager-app-feature-expansion/src/components/LogseqApp.tsx:1-220`. Tree-existing but uninspected candidate bodies: supported app `src/components/` outside sampled ranges, `src/index.css`, and any browser/device-specific UX fixtures.
1. Test keyboard-only editing, focus management, permission-denial messages and contrast.
2. Check responsive layouts and assistive technology behavior on supported browsers.
3. Independently repeat representative note, search, graph and media journeys and document limitations.
Deliverable: accessibility and acceptance record. Verification: observe users completing core flows without relying only on snapshots.
- [ ] Critical usability barriers are resolved or explicitly accepted.
- [ ] Owner approves supported variants and candidate release.

## Task dependency map

| Task | Depends on | Why |
| --- | --- | --- |
| VO-T1 | Owner names candidate apps | Prevents treating all three tree variants as equally supported without evidence. |
| VO-T2 | VO-T1 | Data-flow review must target the actual supported variant set. |
| VO-T3 | VO-T2 | Automation scope should follow the real storage/rendering and claim boundaries. |
| VO-T4 | VO-T3 | Release and restore evidence should come from a passing, fully gated candidate. |
| VO-T5 | VO-T4 | UX acceptance should be run against the staged candidate chosen for release. |

## Production acceptance checklist

- [ ] Owner has named the supported Voyager variant(s) and unsupported tree entries are explicitly excluded from release claims.
- [ ] The historical CI failure on `697d61d739a2fc5a0b1804b9cd584aa11ee16ec8` is either reproduced with root cause evidence or documented as unresolved.
- [ ] Security/privacy wording such as `"Secure Local-First IndexedDB"` is either technically demonstrated or narrowed.
- [ ] Each supported variant has explicit build, lint/type, unit/integration, and E2E gates rather than relying on the feature-expansion smoke test alone.
- [ ] A restore/export workflow using synthetic notes is observed end to end.
- [ ] Supported browsers, media-permission behavior, and accessibility limitations are documented and owner-approved.

## Changes requiring owner approval

Owner approval is required for supported-variant selection, privacy/security promises, media integrations, hosting target, retention policy, and recovery objective.

## Release and rollback policy

No production promotion while the candidate CI failure remains unresolved, the supported variant list is ambiguous, or a required restore remains unobserved. Release from an immutable artifact with recorded dependency versions and provenance. Roll back to the last independently verified artifact and retain evidence for the rejected candidate.
