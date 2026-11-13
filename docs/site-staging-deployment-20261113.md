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

## Failed form E2E investigation (2026-11-13 23:52-23:53 JST)

No retry or configuration change was made during this investigation.

- Cloud Run request logs contain three `POST /api/contact` requests to revision
  `corporate-site-staging-00005-pxb`, at 23:52:57, 23:53:13, and 23:53:52 JST.
  All three returned HTTP 502 in 1.668 s, 0.328 s, and 0.899 s respectively.
- Trace IDs are `cdf17c615373cbc7262e3c3467eb9fbb`,
  `2df94161bacab92c4bdba08111371b70`, and
  `a11c06bd5d9d0fc68b5acc0b526604a6`. Corresponding span IDs are
  `40984a902523fa00`, `9c97051a1ade0227`, and `80c8bde6fad32da8`.
- These are server responses, not the browser's 15-second abort. The API's only
  502 path is `notification_failed` after payload validation and successful
  Turnstile verification. Therefore Turnstile passed and
  `sendContactNotification()` was called for each request.
- `sendContactNotification()` did not resolve successfully. The current catch
  block deliberately suppresses the Nodemailer error, so existing logs cannot
  distinguish connection, SMTP AUTH, `MAIL FROM`, `RCPT TO`, `DATA`, or final
  SMTP-response failure. The earlier no-message SMTP AUTH preflight remains a
  separate PASS and is not evidence that any of these messages was accepted.
- There is no successful SMTP final response, API 200, or Message-ID evidence.
  Consequently SMTP acceptance, Workspace processing, Google Group delivery,
  and Gmail inbox delivery are all **not confirmed**. Workspace mail-log and
  inbox investigation was not used to claim delivery.
- The minimum change proposed at investigation time was Staging-only structured event
  logs for Turnstile success, SMTP start, SMTP success, and SMTP failure. On
  failure, log only a trace-correlated stage plus allowlisted Nodemailer fields
  such as `code`, numeric `responseCode`, and `command`; never log SMTP
  credentials, form fields, email addresses, message body, or raw SMTP response.
  Keep the client response generic. This was implemented under the subsequent
  diagnostics approval; a separate approval is still required before exactly
  one further real-message E2E.

## Staging SMTP diagnostics (2026-11-14)

- Workspace Email Log Search for 2026-11-13 23:52-23:54 JST could not be
  completed because the authenticated browser access host was unavailable. No
  Workspace setting was changed. Delivery therefore remains unconfirmed rather
  than classified as undelivered.
- The three POSTs used the same revision, browser family/version, same-origin
  contact page and application instance. Cloud Run recorded two network source
  representations (IPv6 for the first two and IPv4 for the third), so logs do
  not prove that all three came from one network identity. No personal network
  address is copied into this record.
- Added opt-in `SITE_CONTACT_DIAGNOSTIC_LOGS`; its default is disabled. Staging
  enables it explicitly, while Production remains disabled and unchanged.
- Diagnostic events are limited to SMTP start, success, and failure. Each event
  includes a validated Cloud Trace ID. Failure details are reduced to an
  allowlisted Nodemailer `code`, integer `responseCode`, and allowlisted SMTP
  command name. Raw error messages, stack traces, SMTP responses, credentials,
  addresses, and form fields are never passed to the diagnostic logger.
- Automated tests and TypeScript build: 18 PASS / 0 FAIL.
- No real email or automated retry was performed while adding diagnostics.
- Implementation commit: `4f635fb8b0e9b8647839f85c49e8eb7fc9a74842`.
- Cloud Build: `48a4f0bd-4d81-4d60-80f7-da6e9d4f9644` (`SUCCESS`).
- Image digest: `sha256:28696e739abbc27eadc370be34f8e0e6f044c353eb18defa4e810819e0698802`.
- Staging revision: `corporate-site-staging-00006-zfr` (100% traffic),
  with `SITE_CONTACT_DIAGNOSTIC_LOGS=true`.
- Post-deployment non-mail checks: `/healthz/` HTTP 200, `/contact/` HTTP
  200, and no ERROR entries for the new revision at verification time.
- Production remained on `corporate-site-00005-fbg` at 100% traffic with
  `corporate-site-00006-xud` preview-tagged and its existing
  `corporate-site:recruit-note-20260929` image.
