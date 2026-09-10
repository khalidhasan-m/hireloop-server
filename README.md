# HireLoop Server

Express + MongoDB backend for the HireLoop job portal. Provides authenticated APIs for seekers, recruiters, and admins — jobs, companies, applications, saved jobs, profiles, uploads, notifications, messages, interviews, analytics, and Stripe billing.

> Client: Next.js app (normally `http://localhost:3000`). This repo is API-only.

## Contents

- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [NPM scripts](#npm-scripts)
- [Stripe setup](#stripe-setup--local-testing)
- [Auth & roles](#auth--roles)
- [Plans & limits](#plans--limits)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Uploads](#uploads)
- [Project structure](#project-structure)
- [Production deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Tech stack

- Node.js 20+, Express 5, CommonJS (`index.js` entrypoint)
- Native `mongodb` driver v7 (no ODM)
- `multer` for local disk uploads (served from `/uploads`)
- `stripe` Node SDK (PaymentIntents + Subscriptions + Webhooks)
- `cors`, `dotenv`, optional Resend email
- Compatible with Better Auth `user` / `session` collections: the server validates the session token directly from MongoDB (no `better-auth` npm dependency here; issuance lives on the client).

## Requirements

- Node.js 20+ and npm
- MongoDB (Atlas or local). Database name used in code: `hireloop_db`
- Stripe Test Mode account (only if testing billing)

## Quick start

```bash
npm install
cp .env.example .env
# fill in MONGO_DB_URI + Stripe keys (see below)
node index.js
```

API: `http://localhost:5050` (or `$PORT`). Health check `GET /` returns `Hireloop Server is running!`. No `dev` script exists — run `node index.js` directly (or `nodemon index.js` locally). CORS allows `http://localhost:3000` and `http://localhost:3001` with credentials.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Key | Required | Notes |
|---|---|---|
| `PORT` | No | Default `5050` |
| `MONGO_DB_URI` | Yes | MongoDB connection, DB `hireloop_db` |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Shared with client | Session signing + server public URL |
| `CLIENT_URL` | Yes | Default `http://localhost:3000`; also builds resume/avatar/logo URLs |
| `API_PUBLIC_URL` | No | Cover-letter URL base, falls back to `BETTER_AUTH_URL` |
| `UPLOAD_MAX_MB` | Doc only | Code enforces hardcoded 5 MB Multer limit |
| `STRIPE_SECRET_KEY` | For billing | Real `sk_test_...`; placeholders with `YOUR_` disable Stripe |
| `STRIPE_PUBLISHABLE_KEY` | No | Read in `config/stripe.js`, not required server-side |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | `whsec_...` verifies `POST /api/payments/webhook` |
| `STRIPE_PRICE_SEEKER_PRO` / `PREMIUM` / `RECRUITER_GROWTH` / `RECRUITER_ENTERPRISE` | Recommended | `price_...` monthly Prices; empty falls back to dynamic `price_data` |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Enables application-status emails, else skipped |

## NPM scripts

Only `test` (placeholder) exists. Useful commands:

```bash
node index.js
node scripts/stripe-check.js         # verify STRIPE_SECRET_KEY / mode
node scripts/setup-stripe-prices.js  # create Pro/Premium/Growth/Enterprise monthly Prices
```

## Stripe setup & local testing

1. Real Test Mode key: https://dashboard.stripe.com/test/apikeys → `STRIPE_SECRET_KEY=sk_test_...`, restart, `node scripts/stripe-check.js` must say YES.
2. Prices: `node scripts/setup-stripe-prices.js` → copy four `STRIPE_PRICE_*` values into `.env`.
3. Dev shortcut (no webhook): frontend `/success?session_id=...` calls `POST /api/payments/confirm` to activate the plan. Test-only, trusts client.
4. Webhook flow (production-correct):

```bash
stripe login
stripe listen --forward-to localhost:5050/api/payments/webhook
```

Copy `whsec_...` to `STRIPE_WEBHOOK_SECRET`, restart. Handler verifies raw body + signature. Events: `payment_intent.succeeded` (activate plan), `customer.subscription.updated` (sync status/period), `customer.subscription.deleted` (back to FREE).

## Auth & roles

`middleware/auth.js`: token order `Authorization: Bearer` → `token` header → `better-auth.session_token`/`session_token` cookie; validates `{ token }` in `session` (rejects expired, `401`), loads `user` by `session.userId` (`401` if missing), blocks `isSuspended` non-admins (`403`), sets `req.user`/`req.session`.

`middleware/role.js`: `roleGuard` + `seekerOnly`/`recruiterOnly`/`adminOnly`/`recruiterOrAdmin`. Roles: `seeker` | `recruiter` | `admin`. Admins cannot suspend/delete other admins here, nor delete their own account.

## Plans & limits (`utils/constants.js`, `middleware/planLimit.js`)

| Seeker | Free: 3 applications/mo, 10 saved | Pro $19: 30/mo, unlimited saved | Premium $39: unlimited |
| Recruiter | Free: 3 active jobs | Growth $49: 10 active, basic analytics | Enterprise $149: 50 active, advanced analytics |

Job posting also requires an Approved company owned by the recruiter.

## API base URL

Local default `http://localhost:5050/api`; static files at `/uploads/*`; health `GET /`.

## API reference

`{auth}` = session token required. Shape: `{ success, message?, data?, pagination? }`.

### Jobs `/api/jobs`

- `POST /` `{auth}` + job-limit — requires Approved company; forces `companyId/companyName/recruiterId/status:active`
- `GET /my` `{auth}` — caller's jobs, newest first
- `PATCH /:id`, `DELETE /:id` `{auth}` — owner-only
- `PATCH /:id/close` | `/:id/reopen` `{auth}` — owner sets `closed`/`active`
- `GET /?q=&jobType=&location=&category=&minSalary=&maxSalary=&page=&limit=` public, active-only (`q`/`search` on title/description/location/category/companyName/skills; `remote` also matches location/workMode; limit max 50, default 12)
- `GET /:id` public

### Companies `/api/companies`

- `POST /` `{auth}` — one per `recruiterId`, `name` required, `Pending`
- `GET /my` `{auth}` — caller's profile
- `PATCH /:id` `{auth}` — owner-only; cannot change `recruiterId`/`status`
- `GET /?q=&industry=&size=&page=&limit=` public Approved-only + `openJobs` count (limit max 24, default 6)
- `GET /:id` public Approved-only

### Applications `/api/applications`

- `POST /` `{auth}` + app-limit — `{ jobId, resumeUrl?, coverLetter? }`; notifies job owner
- `GET /my` `{auth}` — `candidateId = me`
- `GET /job/:jobId` `{auth}` — recruiter must own job
- `PATCH /:id/status` `{auth}` — `{ status: Applied|Under Review|Shortlisted|Rejected|Offered }`; recruiter-ownership checked; notifies seeker + optional Resend email

### Saved jobs `/api/saved-jobs`

- `POST /` `{auth}` + saved-limit — `{ jobId }`, deduped per user
- `GET /my` `{auth}` — enriched with job title/company/location/salary/status/deadline/category/jobType
- `DELETE /:id` `{auth}` — by saved `_id + userId`

### Payments `/api/payments`

- `POST /webhook` Stripe-signature only — see Stripe section
- `GET /my` `{auth}` — caller history (note: file defines `GET /my` twice; first route wins, so history is served)
- `POST /create-payment-intent` `{auth}` — `{ plan, role }` → PaymentIntent (USD, `metadata: userId/plan/role/transactionId`), inserts `pending` payment, returns `clientSecret`/`paymentIntentId`/`amount`
- `POST /confirm` `{auth}` — `{ sessionId, plan }`; marks `succeeded`, sets `user.plan`, upserts `subscriptions(active)` (test-only shortcut)
- `POST /change-plan` `{auth}` — needs `stripeSubscriptionId` + Price ID; prorated update
- `POST /cancel` `{auth}` — `cancel_at_period_end`, stores period end

### Admin `/api/admin` (all `{auth}` + admin)

- `GET /stats` — users/recruiters/companies/jobs/payments/applications/pendingCompanies
- `GET /users?email=&role=` — max 200, safe projection
- `PATCH /users/:id/role` `{ seeker|recruiter }` · `PATCH /users/:id/suspend` `{ suspended }` (no admin targets) · `DELETE /users/:id` (no self/admin delete)
- `PATCH /users/:id/subscription` `{ plan }` paid plan for target role; Stripe-prorated if linked else `admin_granted`
- `GET /companies` · `PATCH /companies/:id/status` `{ Pending|Approved|Rejected }` · `DELETE /companies/:id` (Rejected only)
- `GET /jobs` (max 200) · `PATCH /jobs/:id/close` · `DELETE /jobs/:id` (+ its applications)
- `GET /payments` — latest 200 + `userEmail`

### Profile `/api/profile`

- `GET /me` `{auth}` without password hashes · `PATCH /me` `{auth}` allowlist `name/email/image/avatar/resumeUrl/skills/headline/bio`

### Analytics `/api/analytics`

- `GET /recruiter` recruiter/admin — per-job applicant counts
- `GET /admin?days=7|15|30` admin (default 30) — jobs-by-category, registrations/day, succeeded revenue

### Uploads `/api/uploads` (all `{auth}`, field `file`, 5 MB)

- `POST /resume` PDF only → sets `user.resumeUrl`
- `POST /cover-letter` any allowed mime → returns URL only
- `POST /avatar` image only → sets `user.image`
- `POST /company-logo/:companyId` image only, owner-only → sets `company.logo`

### Interactions `/api`

- `GET /notifications` (50) · `PATCH /notifications/:id/read` (owner)
- `GET /messages` (100, sent or received) · `POST /messages` `{ recipientId, body }` (+ recipient notification) · `PATCH /messages/:id/read` (recipient)
- `POST /interviews` recruiter `{ applicationId, startsAt, endsAt?, meetingUrl?, notes? }` (owns job; notifies seeker) · `GET /interviews/my` (recruiter by `recruiterId`, seeker by `seekerId`) · `PATCH /interviews/:id/cancel` (owner-scoped)

## Data model

Collections in `hireloop_db` via `app.locals` (`index.js`): `user`, `session`, `jobs`, `companies`, `applications`, `savedJobs`, `payments`, `subscriptions`, `notifications`, `messages`, `interviews`. Shapes in `models/*.js`.

- `user`: Better Auth fields + `role/plan/planExpiresAt/headline/bio/skills/resumeUrl/phone/location/isSuspended`
- `session`: `token/userId/expiresAt`
- `jobs`: `recruiterId/companyId/title/category/jobType/salaryMin/Max/currency/location/isRemote/deadline/responsibilities/requirements/benefits/status: active|closed|draft`
- `companies`: `recruiterId` unique, `name/industry/website/location/employeeCount/logo/description/status: Pending|Approved|Rejected`
- `applications`: `jobId/candidateId/candidateName/Email/resumeUrl/coverLetter/status: Applied|Under Review|Shortlisted|Rejected|Offered`
- `payments`: `userId/role/plan/amount(cents)/currency/stripeSessionId/stripePaymentIntentId/transactionId/status`
- `subscriptions`: `userId/role/plan/status/currentPeriodStart/End/cancelAtPeriodEnd/stripeSubscriptionId/stripeCustomerId`
- `notifications`: `userId/type/title/body/readAt` + `applicationId/jobId/messageId/interviewId/companyId/status`
- `messages`: `senderId/senderName/recipientId/body/readAt`
- `interviews`: `applicationId/jobId/recruiterId/seekerId/startsAt/endsAt/meetingUrl/notes/status: scheduled|cancelled`

`controllers/` are placeholders — logic lives in `routes/`. Also placeholder: `config/db.js`, `config/cloudinary.js`, `middleware/upload.js` (Multer is in `upload.routes.js`), `utils/response.js`, `utils/errorHandler.js`, `services/plan.service.js`, `services/stripe.service.js`.

## Uploads

Local disk `./uploads` (auto-created), served at `/uploads`. Do not use local disk in prod without persistent volumes — use S3/Cloudinary and replace the Multer adapter. Note: `.gitignore` does not currently ignore `uploads/`.

## Project structure

```text
index.js                 Startup, MongoDB wiring (app.locals), route mounts, static /uploads, CORS
config/stripe.js         Stripe init + mode detection (disabled on placeholder key)
middleware/auth.js       Session-token auth + suspended check
middleware/role.js       roleGuard + helpers
middleware/planLimit.js  Application / saved-job / active-job limits
models/                  Doc-shape helpers (Job, Company, Application, SavedJob, Payment, Subscription, User)
routes/                  job, company, application, savedJob, payment, admin, profile, analytics, upload, interaction
services/email.service.js        Resend status email
services/notification.service.js createNotification()
scripts/stripe-check.js, setup-stripe-prices.js
uploads/                 Local runtime files (dev only)
.env.example             Full env template
```

## Production deployment

Set production `MONGO_DB_URI`, strong `BETTER_AUTH_SECRET`, HTTPS `BETTER_AUTH_URL` + `CLIENT_URL`, live Stripe keys + Price IDs + webhook secret for `https://<api>/api/payments/webhook`. Keep Test/Live separate. Update hardcoded localhost CORS in `index.js` to your domain(s). Use HTTPS, restrict MongoDB access, never expose `.env`, use durable upload storage. Prefer webhooks over client-confirm.

## Troubleshooting

- `Stripe is DISABLED` → paste real `sk_test_...`, restart, `node scripts/stripe-check.js`.
- `Invalid API Key` → template key; use Dashboard → Developers → API keys.
- Webhook `503` → set `STRIPE_WEBHOOK_SECRET`.
- `An approved company profile is required` → admin approves via `PATCH /api/admin/companies/:id/status` (`Approved`).
- `403 limit` → upgrade plan, close a job, or admin-grant via `PATCH /api/admin/users/:id/subscription`.
- `401 No token` → send `Authorization: Bearer <session-token>`.
- `suspended` → admin `PATCH /api/admin/users/:id/suspend` `{ suspended: false }`.
