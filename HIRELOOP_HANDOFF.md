# HireLoop Project — Handoff Document

**Last updated:** August 21, 2026 (evening)  
**Repos:** https://github.com/khalidhasan-m/hireloop-server  
**Repos:** https://github.com/khalidhasan-m/hireloop-client  

This document explains everything already done and what remains, so any AI or developer can continue the work.

---

## 1. Project Overview

HireLoop is a full-stack job portal with 3 roles: Seeker, Recruiter, Admin.

**Stack:** Next.js 16 + Express + MongoDB native driver + Better Auth + Stripe scaffold.

---

## 2. What Is Already Done ✅

### Server
- Middleware: auth, role, planLimit
- Models: User, Company, Job, Application, SavedJob, Payment, Subscription
- Routes: jobs, companies, applications, saved-jobs, payments, admin
- Plan limits on application create, job create, saved-job create
- Stripe: checkout session + confirm + payment history

### Client
- Shared Sidebar + layout
- Seeker: Home, Applications, Saved, Billing, Settings
- Recruiter: Dashboard, Jobs (CRUD/close/reopen), Applications (status update)
- Admin: Home, Users, Companies, Jobs, Payments

---

## 3. What’s left (optional)
- Seeker browse jobs page
- Public /pricing
- Stripe production webhook + Price IDs
- Full recruiter company page
- Profile fields API

---

## 4. Run

```bash
# Server
cd hireloop-server && git pull && npm install && npm run dev

# Client  
cd hireloop-client && git pull && npm run dev
# NEXT_PUBLIC_API_URL=http://localhost:5050/api
```

Env: `MONGO_DB_URI`, Better Auth secrets, optional `STRIPE_SECRET_KEY`, `CLIENT_URL`.

Admin users need `role: "admin"`.

---

## 5. Prompt for next AI

> Continue HireLoop (khalidhasan-m/hireloop-server + hireloop-client).  
> Core is done. Next: seeker browse-jobs, public pricing, Stripe webhook.  
> See HIRELOOP_HANDOFF.md.

**End of handoff.**
