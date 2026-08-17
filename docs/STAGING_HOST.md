# Admin staging host contract

- Hostname: `staging.alabamabeachflag.com` only.
- API: prefer same-origin `/admin/service`; any direct API origin must be `https://alabamabeachflag-api-staging.sparkelectricalservicesllc.workers.dev`. A staging page rejects the production Worker origin.
- Access: protect the staging host and `/admin/service` proxy with staging-specific audiences and authorized administrator/service-token identities. Apply the same staging admin policy to `/admin/*` on both the Pages project alias and wildcard immutable/preview deployment hostnames so they cannot bypass the custom-host gate. Do not reuse production audiences without an explicit security review.
- Build/output: this repository is static; run `npm run check` and publish the repository root (the admin entry is `admin/index.html`). Environment selection is deterministic from the request hostname; no generated configuration is committed.
- Variables: none are required by the static host. The staging API Worker separately defaults provider fetch, fixture mode, and email delivery to disabled.
- UI: staging displays a persistent non-production banner. Production hosts do not.
- Cache: all `/admin/*` HTML and assets use `no-store` to prevent mixed-version admin loads. Public assets retain their existing policy. Never allow cached production HTML to supply a production Worker destination on staging.
- CSP: `/admin/*` permits same-origin connections only, blocks plugins and framing, and restricts base and form targets to the same origin. If a direct staging API origin is authorized later, add only that exact origin to `connect-src`; never add the production Worker origin to staging CSP.
- Rollback/version: retain the previously verified immutable deployment/version and record the source commit. Roll back atomically, then verify hostname, banner, Access, API origin, cache, and diagnostics.
- External prerequisites: the hosting project, DNS, proxy route, Access application/policy, and deployment remain Cloudflare-managed. Verify the custom host, Pages alias, and wildcard immutable hostname Access destinations after every change.
