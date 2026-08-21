/**
 * Job Collection Schema
 * Collection name: "jobs"
 */
const JobFields = {
  _id: "ObjectId",
  recruiterId: "string",              // User._id
  companyId: "string | ObjectId",     // optional link to company
  title: "string",                    // required
  category: "string",
  jobType: "Full-time | Part-time | Remote | Contract | Internship",
  salaryMin: "number | null",
  salaryMax: "number | null",
  currency: "string",                 // default: USD
  location: "string | null",
  isRemote: "boolean",
  deadline: "Date | null",
  responsibilities: "string",
  requirements: "string",
  benefits: "string | null",
  status: "active | closed | draft",  // default: active
  applicantsCount: "number",          // denormalized counter
  createdAt: "Date",
  updatedAt: "Date",
};

/**
 * Helper to create a new job document
 */
function createJobDoc(data, recruiterId) {
  return {
    recruiterId,
    companyId: data.companyId || null,
    title: data.title,
    category: data.category || "Other",
    jobType: data.jobType || "Full-time",
    salaryMin: data.salaryMin ?? null,
    salaryMax: data.salaryMax ?? null,
    currency: data.currency || "USD",
    location: data.location || null,
    isRemote: data.isRemote || false,
    deadline: data.deadline ? new Date(data.deadline) : null,
    responsibilities: data.responsibilities || "",
    requirements: data.requirements || "",
    benefits: data.benefits || null,
    status: "active",
    applicantsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = { JobFields, createJobDoc };
