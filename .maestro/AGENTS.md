# .maestro — Mobile E2E Flows

## Purpose

- Govern deterministic Maestro flows for login, hide, guess, and result journeys.
- Keep runtime assumptions for device-level testing separate from general app guidance.

## Ownership

- Owns YAML flow files, shared Maestro snippets, and E2E-specific environment/input conventions under `.maestro/`.

## Local Contracts

- `EXPO_PUBLIC_E2E_MODE=true` must be present when the app bundle is started or built for these flows.
- Flow files rely on deterministic app affordances documented in `.maestro/README.md`.
- `hide-login-save-picture.yml` must run before guess-only flows because it creates the saved hide payload bridge they assert.
- `_shared/` holds reusable Maestro snippets; keep common steps there instead of duplicating them across flows.
- `e2e.env.example.yaml` documents required runtime inputs. Actual credentials or local overrides belong in local env input files, not in committed flow YAML.
- Auth still talks to configured backend even in deterministic mode.

## Work Guidance

- Keep selectors and test IDs aligned with app code changes; update flows when user-visible contracts move.
- Prefer deterministic E2E-mode hooks over brittle coordinate-based workarounds when app exposes a stable test affordance.
- Keep `.maestro/README.md` current when flow order, required inputs, or runtime assumptions change.
- Avoid destructive state-reset steps that break Expo Dev Client startup unless the flow explicitly requires and documents them.

## Verification

- Follow the current command sequence in `.maestro/README.md`.
- Re-run `hide-login-save-picture.yml` before either guess-only flow after touching saved-payload or hide/guess path behavior.
- Re-run the smallest affected flow first, then the full `hide-to-guess-to-result.yml` journey when changes cross multiple steps.

## Child DOX Index

None.