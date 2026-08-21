/**
 * SavedJob Collection Schema
 * Collection name: "savedJobs"
 */
const SavedJobFields = {
  _id: "ObjectId",
  userId: "string",                   // User._id (seeker)
  jobId: "string",                    // Job._id
  createdAt: "Date",
};

/**
 * Helper to create a saved job document
 */
function createSavedJobDoc(userId, jobId) {
  return {
    userId,
    jobId,
    createdAt: new Date(),
  };
}

module.exports = { SavedJobFields, createSavedJobDoc };
