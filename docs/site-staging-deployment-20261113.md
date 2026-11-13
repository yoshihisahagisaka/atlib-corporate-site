# Corporate site Staging deployment (2026-11-13)

## Scope

- Project: `atlib-corporate-site`
- Region: `asia-northeast1`
- Service: `corporate-site-staging`
- Production service, load balancer, DNS, VM, Apache and WordPress: unchanged

## Source and image

- Git base: PR #58 head `0eb5a2ef7c98c746761f223de50b561a1887e795`
- Integration commit: `27ebf12`
- Sites source: accepted v30, commit `0eb3cc0b658dc264a640cee43e8b75651e4276fa`
- Cloud Build: `a04c12a2-5cfa-4606-bde5-3d1ca747aacd` (`SUCCESS`)
- Image digest: `sha256:c5d9a7990138e6f80ad351e60c3320404aef36a6179f4020d29441c20c7f986b`

## Staging resources

- Runtime service account: `corporate-site-staging@atlib-corporate-site.iam.gserviceaccount.com`
- Secret access is granted on the named SMTP, form-HMAC and Staging Turnstile secrets only.
- Cloud Run: min instances `0`, max instances `2`, concurrency `10`, ingress `all`.
- URL: `https://corporate-site-staging-1074470408021.asia-northeast1.run.app`
- Turnstile secret container: `corporate-site-staging-turnstile-secret` (no version at initial deployment).

## Verification status

- Local TypeScript build and tests: `16 PASS / 0 FAIL`.
- Public `/`, `/company/`, `/services/`, `/works/`: HTTP 200.
- `/healthz/`: HTTP 200. The slashless `/healthz` is intercepted as a Google 404 on the `run.app` route, matching the previously recorded Cloud Run behavior.
- `/contact/`: HTTP 503 until the Staging Turnstile site key is configured.
- `POST /api/contact`: `503 not_ready` until the Staging Turnstile secret is configured.
- Disallowed Origin: rejected before delivery.
- No E2E email was sent during the fail-closed deployment.

## Remaining Staging gate

The Cloudflare widget `atlib-contact` must allow the exact Staging hostname. Its
public site key must be configured as `SITE_CONTACT_TURNSTILE_SITE_KEY`, and its
secret must be added as a new version of
`corporate-site-staging-turnstile-secret`. After that, update the Staging Cloud
Run service to reference the secret and run one normal-form E2E submission.
