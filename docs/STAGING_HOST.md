# Admin staging host contract

- Hostname: `staging.alabamabeachflag.com` only.
- API: prefer same-origin `/admin/service`; any direct API origin must be `https://alabamabeachflag-api-staging.sparkelectricalservicesllc.workers.dev`. A staging page rejects the production Worker origin.
- Access: protect the staging host and `/admin/service` proxy with staging-specific audiences and authorized administrator/service-token identities. Do not reuse production audiences without an explicit security review.
- Build/output: this repository is static; run `npm run check` and publish the repository root (the admin entry is `admin/index.html`). Environment selection is deterministic from the request hostname; no generated configuration is committed.
- Variables: none are required by the static host. The staging API Worker separately defaults provider fetch, fixture mode, and email delivery to disabled.
- UI: staging displays a persistent non-production banner. Production hosts do not.
- Cache: HTML and environment-selection modules must be revalidated or invalidated on release; hashed/versioned assets may be cached. Never allow cached production HTML to supply a production Worker destination on staging.
- CSP: allow same-origin connections. If a direct staging API origin is authorized later, add only that exact origin to `connect-src`; never add the production Worker origin to staging CSP.
- Rollback/version: retain the previously verified immutable deployment/version and record the source commit. Roll back atomically, then verify hostname, banner, Access, API origin, cache, and diagnostics.
- External prerequisites: a hosting project, DNS, proxy route, Access application/policy, CSP, cache rules, and deployment remain separate authorized Cloudflare work.
