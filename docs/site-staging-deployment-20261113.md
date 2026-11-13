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
- Turnstile secret: `corporate-site-staging-turnstile-secret:1` (value not retrieved or recorded).
- Current revision: `corporate-site-staging-00005-pxb` (100% traffic).
- SMTP endpoint: `smtp-relay.gmail.com:587` with the existing Workspace SMTP credential.

## Verification status

- Local TypeScript build and tests: `16 PASS / 0 FAIL`.
- Public `/`, `/company/`, `/services/`, `/works/`: HTTP 200.
- `/healthz/`: HTTP 200. The slashless `/healthz` is intercepted as a Google 404 on the `run.app` route, matching the previously recorded Cloud Run behavior.
- `/contact/`: HTTP 200 after the Staging Turnstile site key and secret were configured.
- Disallowed Origin: rejected before delivery.
- After the SMTP relay update, `/healthz/` and `/contact/` both returned HTTP 200 and the new revision had no ERROR log entries.
- No E2E email was sent during the SMTP relay preflight or update.

## SMTP relay alignment (2026-11-13)

- Canonical Git state was rechecked: `main` at `eb9b229`, PR #58 at `0eb5a2e`, and PR #59 at `0e3a1ce` before this documentation update.
- The current WordPress sender uses `smtp-relay.gmail.com`; its observed public source IP is the reserved GCE address `34.146.160.232`.
- Google Workspace documents two SMTP relay authentication methods: allowlisted public IP and SMTP AUTH over TLS. It also documents `smtp-relay.gmail.com` ports 25/465/587. See [Route outgoing SMTP relay messages through Google](https://knowledge.workspace.google.com/admin/gmail/advanced/route-outgoing-smtp-relay-messages-through-google) and [Send email from a printer, scanner, or app](https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app).
- A no-message Nodemailer `verify()` preflight to `smtp-relay.gmail.com:587` passed with TLS and SMTP AUTH using the existing Secret Manager credential. The secret value was neither printed nor written to a file.
- Because SMTP AUTH succeeded from the current environment, the Staging path does not require a fixed egress IP, Serverless VPC Access connector, Cloud Router, or Cloud NAT. The project currently has no Cloud Router; the existing `34.146.160.232` address is attached to the production WordPress VM and was not reused or changed.
- Staging-only change: `SMTP_HOST` was changed from `smtp.gmail.com` to `smtp-relay.gmail.com`. Port, SMTP user, From address, Secret reference, image digest, service account, scaling, and application code are unchanged.
- The exact Google Admin SMTP relay rule is not exposed by GCP and was not changed. Successful SMTP AUTH proves that the existing Workspace configuration accepts this authenticated connection, but final Google Group routing and inbox delivery still require the approved one-message E2E and received-header inspection.

## Remaining E2E approval gate

Do not send another message until the supervising lane explicitly approves the
single post-change E2E. After approval, submit one normal form message and
verify SMTP acceptance, Google Group routing (`List-ID`, `X-BeenThere`, or
`Mailing-list`), `Delivered-To`, From, To, Reply-To, SPF, DKIM, and DMARC.
Production `corporate-site`, load balancer, DNS, GCE, Apache, WordPress, and
Google Workspace settings remain unchanged.
