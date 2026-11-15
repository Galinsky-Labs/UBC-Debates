# Release evidence (UBC-08, in progress)

| Item | Evidence (2026-11-15) |
|---|---|
| Hosting | Render static site `ubc-debates` (`srv-dbt0eqmi0phs73ebcskg`), https://ubc-debates.onrender.com, auto-deploy from `main`. |
| Build | Render build log: `Built UBC Debates (configured) in dist/`; deploy status `live`. |
| Engine | Live Debate Engine web service `live-debate-engine` (https://live-debate-engine.onrender.com), public API `public-v1`, CORS allows exactly `https://ubc-debates.onrender.com`. |
| Tenant | UBC tenant `4f9fab00-0101-4e3c-9c25-58cceecebbe7` bootstrapped in the engine release step (`tenants_bootstrapped`); set as `UBC_TENANT_ID`. |
| Headers | CSP (`connect-src` engine only, `frame-ancestors 'none'`), nosniff, no-referrer, HSTS, Permissions-Policy configured on the static site. |
| Tests | `npm run check` in CI (11 tests) on every PR and on `main`. |

## Not yet evidenced

- A browser check of the live site against the live engine from an external network (the build sandbox cannot reach new `onrender.com` hosts).
- Real published UBC debates: organizers need engine role grants for the UBC tenant (`npm run access:admin` with the engine release credential), then publish series/motions/events.
- Engine email delivery is disabled until a Resend key and verified domain exist, so new participants cannot verify accounts yet.
- University brand/trademark approval and accessibility review by people with assistive technology.
