/**
 * User Collection Schema (managed mainly by Better Auth)
 * Collection name: "user"
 *
 * Extra fields we use beyond Better Auth defaults:
 */
const UserFields = {
  // Better Auth default fields
  _id: "ObjectId | string",
  name: "string",
  email: "string",
  emailVerified: "boolean",
  image: "string | null",          // avatar URL
  createdAt: "Date",
  updatedAt: "Date",

  // Custom fields
  role: "seeker | recruiter | admin",   // default: seeker
  plan: "FREE | PRO | PREMIUM | GROWTH | ENTERPRISE", // default: FREE
  planExpiresAt: "Date | null",
  headline: "string | null",
  bio: "string | null",
  skills: ["string"],
  resumeUrl: "string | null",
  phone: "string | null",
  location: "string | null",
  isSuspended: "boolean",               // default: false
};

module.exports = { UserFields };
