# Announcement manager operations

The private manager is served at `https://www.alabamabeachflag.com/admin/`. Before release, create or extend a Cloudflare Access self-hosted application so `/admin*` is available only to the approved operators. The page contains no password system, service token, Access assertion, identity details, analytics, or credential storage.

The static page sends credentialed browser requests to the existing Worker. Cloudflare Access must protect the Worker's `/internal/app-announcement` route for the same approved browser identities. Allow unauthenticated `OPTIONS` requests to reach the Worker so browser preflight succeeds; PUT and DELETE remain protected. An operator who does not already have a Worker-domain session may need to complete the normal Access sign-in when prompted.

## Routine use

1. Open the admin URL and confirm the current status loads.
2. Choose a template or Custom. Templates only fill editable fields.
3. Keep a stable ID when replacing the same event. Choose a local start and expiration; the page sends exact UTC timestamps.
4. Optionally add both an action title and an approved `https://alabamabeachflag.com` URL.
5. Review the local start and expiration in the confirmation dialog, then publish. Critical notices require an explicit confirmation and are not dismissible in the app preview.
6. Use **Edit or replace** to copy the active item into the editor. Refresh never overwrites an unsaved draft.
7. Use **Clear announcement** and confirm to delete the current record.

Public caches use up to a three-minute shared TTL and Workers KV may take roughly another minute to propagate. Wait several minutes before treating a public check as final.

If Access expires, re-authenticate with the configured Cloudflare Access application and retry. A denied response means the identity is not on the existing backend allowlist. Validation messages from the backend are authoritative; network and server failures preserve the editor contents.

## Release checklist

- Protect `www.alabamabeachflag.com/admin*` with the approved operator policy.
- Confirm those browser identities are in the Worker's existing Access policy and `ACCESS_ALLOWED_IDENTITIES` or `ACCESS_ALLOWED_GROUPS` configuration.
- Add an Access bypass policy for `OPTIONS` only on the Worker application; never bypass PUT or DELETE.
- Deploy the reviewed backend CORS/CSRF change first, then publish the static site.
- Sign in as an approved operator and verify inactive status, publish, replace, critical confirmation, and clear from desktop and mobile.
- Verify an unapproved identity cannot load `/admin/` or mutate `/internal/app-announcement`.
- Confirm the public iOS data path remains healthy and alert delivery remains disabled.
