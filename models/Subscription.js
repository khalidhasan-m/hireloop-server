/**
 * Subscription Collection Schema (optional - can also live on User)
 * Collection name: "subscriptions"
 */
const SubscriptionFields = {
  _id: "ObjectId",
  userId: "string",
  role: "seeker | recruiter",
  plan: "FREE | PRO | PREMIUM | GROWTH | ENTERPRISE",
  status: "active | canceled | past_due | incomplete",
  currentPeriodStart: "Date",
  currentPeriodEnd: "Date",
  cancelAtPeriodEnd: "boolean",
  stripeSubscriptionId: "string | null",
  stripeCustomerId: "string | null",
  createdAt: "Date",
  updatedAt: "Date",
};

/**
 * Helper to create a subscription document
 */
function createSubscriptionDoc(data) {
  return {
    userId: data.userId,
    role: data.role,
    plan: data.plan || "FREE",
    status: data.status || "active",
    currentPeriodStart: data.currentPeriodStart || new Date(),
    currentPeriodEnd: data.currentPeriodEnd || null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    stripeSubscriptionId: data.stripeSubscriptionId || null,
    stripeCustomerId: data.stripeCustomerId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = { SubscriptionFields, createSubscriptionDoc };
