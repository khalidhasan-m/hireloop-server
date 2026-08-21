/**
 * Application Collection Schema
 * Collection name: "applications"
 */
const ApplicationFields = {
  _id: "ObjectId",
  jobId: "string",                    // Job._id
  candidateId: "string",              // User._id (seeker)
  candidateName: "string",            // denormalized for easier listing
  candidateEmail: "string",
  resumeUrl: "string | null",
  coverLetter: "string | null",
  status: "Applied | Under Review | Shortlisted | Rejected | Offered",
  createdAt: "Date",
  updatedAt: "Date",
};

/**
 * Helper to create a new application document
 */
function createApplicationDoc(data, candidate) {
  return {
    jobId: data.jobId,
    candidateId: candidate.id,
    candidateName: candidate.name || "Candidate",
    candidateEmail: candidate.email || "",
    resumeUrl: data.resumeUrl || candidate.resumeUrl || null,
    coverLetter: data.coverLetter || null,
    status: "Applied",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = { ApplicationFields, createApplicationDoc };
