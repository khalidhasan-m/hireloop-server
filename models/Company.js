/**
 * Company Collection Schema
 * Collection name: "companies"
 */
const CompanyFields = {
  _id: "ObjectId",
  recruiterId: "string",              // User._id of the owner
  name: "string",                     // required
  industry: "string",                 // Fintech, AI, etc.
  website: "string | null",
  location: "string | null",
  employeeCount: "string | null",     // e.g. "1-10", "11-50", "51-200"
  logo: "string | null",              // image URL
  description: "string | null",
  status: "Pending | Approved | Rejected",  // default: Pending
  createdAt: "Date",
  updatedAt: "Date",
};

/**
 * Helper to create a new company document
 */
function createCompanyDoc(data, recruiterId) {
  return {
    recruiterId,
    name: data.name,
    industry: data.industry || "Other",
    website: data.website || null,
    location: data.location || null,
    employeeCount: data.employeeCount || null,
    logo: data.logo || null,
    description: data.description || null,
    status: "Pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = { CompanyFields, createCompanyDoc };
