# HireLoop Server

HireLoop Server is the Express and MongoDB backend for the HireLoop job portal. It provides authenticated APIs for job seekers, recruiters, and administrators, including jobs, companies, applications, saved jobs, profiles, uploads, notifications, messages, interviews, analytics, and Stripe billing.

## Technology

The server uses Node.js, Express 5, the native MongoDB driver, Better Auth, Multer for local uploads, and the Stripe Node SDK. The application uses CommonJS modules and starts directly from `index.js`.

## Requirements

Use Node.js 20 or newer and npm. A MongoDB deployment is required. MongoDB Atlas is suitable for development and production; a local MongoDB instance can also be used.

## Installation and development

```bash
npm install
cp .env.example .env
node index.js
```

The server listens on port `5050` by default. The client normally runs at [http://localhost:3000](http://localhost:3000).

The current `package.json` does not define a development script, so use `node index.js` directly. If you use a process watcher locally, run it against `index.js`.

## Environment variables

The required base configuration is:

```env
PORT=5050
MONGO_DB_URI=mongodb+srv://user:password@cluster.mongodb.net/hireloop
BETTER_AUTH_SECRET=replace_with_a_long_random_secret
BETTER_AUTH_URL=http://localhost:5050
CLIENT_URL=http://localhost:3000
```

For Stripe test-mode checkout and webhooks, add:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SEEKER_PRO=price_...
STRIPE_PRICE_SEEKER_PREMIUM=price_...
STRIPE_PRICE_RECRUITER_GROWTH=price_...
STRIPE_PRICE_RECRUITER_ENTERPRISE=price_...
```

Optional email configuration is documented in `.env.example`. Never commit `.env` or any secret key to Git.

## Stripe local testing

Use Stripe Test Mode while developing. Start the API, then run:

```bash
stripe login
stripe listen --forward-to localhost:5050/api/payments/webhook
```

Copy the signing secret printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET` and restart the server. Test checkout with Stripe test cards only. The webhook endpoint verifies the raw request body and Stripe signature before processing events.

Checkout completion, recurring invoice success/failure, subscription updates and deletions, cancellation-at-period-end, plan changes with proration, payment history, and Admin plan grants are supported. Paid plans should be activated from verified Stripe webhook events rather than trusting a client-only success redirect.

## API base URL

All application endpoints are mounted under `/api`. With the default local setup, the base URL is:

```text
http://localhost:5050/api
```

The server also serves locally stored uploaded files through `/uploads`.

## API areas

| Area | Main capabilities |
|---|---|
| Authentication | Better Auth session and account endpoints under `/api/auth`. |
| Jobs | Public search, pagination, recruiter CRUD, close/reopen, and Admin force-close. |
| Companies | Public search and pagination, recruiter registration/update, and Admin approval/rejection. |
| Applications | Seeker submission, cover-letter URL storage, application history, recruiter review, and status updates. |
| Saved jobs | Seeker create, list, and delete operations with plan limits. |
| Profiles | Authenticated profile updates, password-related flows, and avatar handling. |
| Uploads | Authenticated resume, cover letter, avatar, and company-logo uploads with a 5MB Multer limit. |
| Interactions | Notifications, messages, and interviews. |
| Payments | Checkout, confirmation, history, subscriptions, plan changes, cancellation, and webhook lifecycle processing. |
| Admin | Platform statistics, user management, role changes, suspension/activation, deletion, company decisions, job administration, payments, and subscription upgrades. |
| Analytics | Authenticated role-aware dashboard analytics. |

## Roles and authorization

Users have one of three roles: `seeker`, `recruiter`, or `admin`. Authentication middleware loads the current Better Auth session, while role middleware protects role-specific operations. Suspended accounts are blocked by the shared authentication middleware. Admin actions cannot be performed by Seeker or Recruiter accounts, and Admin self-suspension, demotion, and deletion are blocked.

## Data model

The server uses MongoDB collections for users, sessions, jobs, companies, applications, saved jobs, payments, subscriptions, notifications, messages, and interviews. Collection handles are initialized in `index.js` and made available to route modules through `app.locals`.

## Uploads

Uploaded files are stored in the server `uploads/` directory during local development. The upload routes enforce authentication and a 5MB limit. Supported flows include profile avatars, resumes, cover letters, and recruiter company logos. Production deployments should use persistent storage or replace the local storage adapter so files are not lost when instances are recreated.

## Production deployment

Set all required environment variables in the deployment platform, including a strong `BETTER_AUTH_SECRET`, the production MongoDB URI, the public HTTPS client and server URLs, and Stripe live-mode credentials when payments are ready for production.

Register the public HTTPS webhook URL in Stripe for `/api/payments/webhook` and copy its signing secret to `STRIPE_WEBHOOK_SECRET`. Keep Test Mode and Live Mode keys and Price IDs separate. Configure CORS through `CLIENT_URL`, use HTTPS, and provide persistent upload storage.

## Project structure

```text
index.js                 Server startup, MongoDB connection, and route registration
config/stripe.js         Stripe client configuration
middleware/              Authentication, role, and plan-limit middleware
models/                  MongoDB document helpers and model definitions
routes/                  Express API route modules
services/                Email, plan, and Stripe-related services
utils/                   Shared constants, responses, and error handling
uploads/                 Local runtime upload directory
.env.example             Environment variable template
```

## Operational notes

The server is API-only and should be run alongside the Next.js client. Use the client repository README for frontend commands and browser regression tests. For debugging, inspect the server console and Stripe Dashboard event delivery together so local payment records and webhook processing can be compared with Stripe’s event history.
