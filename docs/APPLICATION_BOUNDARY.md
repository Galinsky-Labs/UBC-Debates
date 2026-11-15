# UBC application boundary

UBC Debates owns branding, navigation and presentation. Live Debate Engine
(`Galinsky-Labs/Live-Debate-Engine`) owns competitions, rules, scheduling,
scoring, admission, identity, permissions, voting, media and authoritative
records. No engine code, database or authorization rule is copied here.

## Engine dependency decision (2026-11-15)

Decision recorded for the owner: **UBC is built against the engine's current,
versioned public API (`public-v1`) instead of waiting for engine V1 (E-47).**
The client (`src/engine-client.js`) checks the `apiVersion` on every response and
treats anything else as unsupported, so a future breaking engine change cannot be
silently misread; moving to engine V1 means adding a new client version.

## Routes and components (UBC-01/02/05)

| Hash route | View |
| --- | --- |
| `#/` | Overview: live-now list from the engine |
| `#/program` | Published upcoming/live debates |
| `#/debates` | Archive of concluded debates |
| `#/debates/{uuid}` | Debate detail: motion, phase, venue/broadcast, live notice, certified results with explanation and fingerprint, published transcript with timestamps |
| `#/speakers` | Honest "coming soon" (no public speaker API yet) |
| `#/participant` | Hand-off to the engine workspace for sign-in, MFA, admission, voting and role-based actions |
| Anything else | Not found; nothing reflected |

Only a fixed route list and a strict UUID detail pattern are interpreted. All
content is rendered with text nodes. Links are fixed hashes or the configured
engine origin.

## Identity, admission and permissions (UBC-04)

UBC holds no sessions, passwords or roles. Participants follow the link to the
engine origin, where Better Auth sessions, MFA, admission (E-12), anonymous
ballot credentials (E-20) and server-side authorization apply. Public reads use
`credentials: 'omit'`, so UBC pages never send engine cookies.

## Security controls (UBC-06)

- CSP (meta and response header): `default-src 'none'`, scripts/styles self only,
  `connect-src` limited to the configured engine origin, `frame-ancestors 'none'`,
  no forms, no objects; plus `nosniff`, `no-referrer`, HSTS and a restrictive
  Permissions-Policy (see `render.yaml`).
- The engine allows browser reads only from the exact UBC origin
  (`LDE_PUBLIC_CORS_ORIGINS`), GET only, no credentials.
- Client hardening: exact-HTTPS-origin check, UUID validation, 8 s abort timeout,
  `redirect: 'error'`, response projection that drops unknown fields.
- Build reads only `UBC_ENGINE_ORIGIN` and `UBC_TENANT_ID`, both validated and non-secret.

## Build, CI and deployment (UBC-07)

`npm run check` runs unit/negative/DOM tests and a clean build; `.github/workflows/ci.yml`
also verifies a configured production build. Render static site `ubc-debates`
is described in `render.yaml` (free plan). No database is used.

## Remaining owner actions (UBC-08)

- Create the UBC tenant in the engine and set `UBC_TENANT_ID` on the Render site,
  then grant UBC organizers their engine roles. Until then the site shows
  "No debates have been published yet".
- UBC/university brand assets and trademark approval; speaker profiles need an engine API.
