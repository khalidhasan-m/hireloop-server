// ======================
// APPLICATION STATUS
// ======================
const APPLICATION_STATUS = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  OFFERED: "Offered",
};

const APPLICATION_STATUS_FLOW = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.UNDER_REVIEW,
  APPLICATION_STATUS.SHORTLISTED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.OFFERED,
];

// ======================
// COMPANY STATUS
// ======================
const COMPANY_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// ======================
// JOB STATUS
// ======================
const JOB_STATUS = {
  ACTIVE: "active",
  CLOSED: "closed",
  DRAFT: "draft",
};

// ======================
// USER ROLES
// ======================
const USER_ROLES = {
  SEEKER: "seeker",
  RECRUITER: "recruiter",
  ADMIN: "admin",
};

// ======================
// SEEKER PLANS
// priceId from env: STRIPE_PRICE_SEEKER_PRO / STRIPE_PRICE_SEEKER_PREMIUM
// If null, checkout uses price_data with `price` amount (works in test mode)
// ======================
const SEEKER_PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    maxApplicationsPerMonth: 3,
    maxSavedJobs: 10,
    features: [
      "Browse & save up to 10 jobs",
      "Apply to up to 3 jobs/month",
      "Basic profile",
      "Email alerts",
    ],
  },
  PRO: {
    name: "Pro",
    price: 19,
    priceId: process.env.STRIPE_PRICE_SEEKER_PRO || null,
    maxApplicationsPerMonth: 30,
    maxSavedJobs: Infinity,
    features: [
      "Apply to up to 30 jobs/month",
      "Unlimited saved jobs",
      "Application tracking",
      "Salary insights",
    ],
  },
  PREMIUM: {
    name: "Premium",
    price: 39,
    priceId: process.env.STRIPE_PRICE_SEEKER_PREMIUM || null,
    maxApplicationsPerMonth: Infinity,
    maxSavedJobs: Infinity,
    features: [
      "Everything in Pro",
      "Unlimited applications",
      "Profile boost to recruiters",
      "Early access to new jobs",
      "Priority support",
    ],
  },
};

// ======================
// RECRUITER PLANS
// ======================
const RECRUITER_PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    maxActiveJobs: 3,
    analytics: false,
    features: [
      "Up to 3 active job posts",
      "Basic applicant management",
      "Standard listing visibility",
    ],
  },
  GROWTH: {
    name: "Growth",
    price: 49,
    priceId: process.env.STRIPE_PRICE_RECRUITER_GROWTH || null,
    maxActiveJobs: 10,
    analytics: "basic",
    features: [
      "Up to 10 active job posts",
      "Applicant tracking",
      "Basic analytics",
      "Email support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 149,
    priceId: process.env.STRIPE_PRICE_RECRUITER_ENTERPRISE || null,
    maxActiveJobs: 50,
    analytics: "advanced",
    features: [
      "Up to 50 active job posts",
      "Advanced analytics dashboard",
      "Featured job listings",
      "Team collaboration",
      "Custom branding",
      "Priority support",
    ],
  },
};

const JOB_TYPES = ["Full-time", "Part-time", "Remote", "Contract", "Internship"];

const JOB_CATEGORIES = [
  "Software Engineering",
  "Product Design",
  "Marketing",
  "Sales",
  "Data Science",
  "DevOps",
  "Customer Support",
  "Finance",
  "HR",
  "Other",
];

module.exports = {
  APPLICATION_STATUS,
  APPLICATION_STATUS_FLOW,
  COMPANY_STATUS,
  JOB_STATUS,
  USER_ROLES,
  SEEKER_PLANS,
  RECRUITER_PLANS,
  JOB_TYPES,
  JOB_CATEGORIES,
};
