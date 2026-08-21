/**
 * Payment Collection Schema
 * Collection name: "payments"
 */
const PaymentFields = {
  _id: "ObjectId",
  userId: "string",                   // User._id
  role: "seeker | recruiter",
  plan: "string",                     // e.g. PRO, GROWTH
  amount: "number",                   // in cents or dollars
  currency: "string",                 // default: usd
  stripeSessionId: "string | null",
  stripePaymentIntentId: "string | null",
  transactionId: "string | null",
  status: "pending | succeeded | failed | refunded",
  createdAt: "Date",
  updatedAt: "Date",
};

/**
 * Helper to create a payment record
 */
function createPaymentDoc(data) {
  return {
    userId: data.userId,
    role: data.role,
    plan: data.plan,
    amount: data.amount,
    currency: data.currency || "usd",
    stripeSessionId: data.stripeSessionId || null,
    stripePaymentIntentId: data.stripePaymentIntentId || null,
    transactionId: data.transactionId || null,
    status: data.status || "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = { PaymentFields, createPaymentDoc };
