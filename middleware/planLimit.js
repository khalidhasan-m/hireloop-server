const { SEEKER_PLANS, RECRUITER_PLANS, JOB_STATUS } = require("../utils/constants");

/**
 * Check if a Seeker can still apply this month based on their plan.
 * Must be used AFTER auth middleware.
 *
 * Usage: router.post("/", auth, checkSeekerApplicationLimit, handler)
 */
const checkSeekerApplicationLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const applicationCollection = req.app.locals.applicationCollection;
    if (!applicationCollection) {
      return res.status(500).json({
        success: false,
        message: "Application collection not initialized",
      });
    }

    // Default to Free plan if none set
    const planKey = (req.user.plan || "FREE").toUpperCase();
    const plan = SEEKER_PLANS[planKey] || SEEKER_PLANS.FREE;

    // Unlimited plans skip the check
    if (plan.maxApplicationsPerMonth === Infinity) {
      return next();
    }

    // Count applications made this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await applicationCollection.countDocuments({
      candidateId: req.user.id,
      createdAt: { $gte: startOfMonth },
    });

    if (count >= plan.maxApplicationsPerMonth) {
      return res.status(403).json({
        success: false,
        message: `You have reached your monthly application limit (${plan.maxApplicationsPerMonth}). Please upgrade your plan.`,
        limit: plan.maxApplicationsPerMonth,
        used: count,
        plan: plan.name,
      });
    }

    // Attach useful info for the controller if needed
    req.planInfo = {
      plan: plan.name,
      used: count,
      limit: plan.maxApplicationsPerMonth,
      remaining: plan.maxApplicationsPerMonth - count,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Plan limit check error: " + error.message,
    });
  }
};

/**
 * Check if a Recruiter can still post / reopen an active job based on their plan.
 * Must be used AFTER auth middleware.
 *
 * Usage: router.post("/", auth, checkRecruiterJobLimit, handler)
 *        router.patch("/:id/reopen", auth, checkRecruiterJobLimit, handler)
 */
const checkRecruiterJobLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const jobCollection = req.app.locals.jobCollection;
    if (!jobCollection) {
      return res.status(500).json({
        success: false,
        message: "Job collection not initialized",
      });
    }

    // Default to Free plan if none set
    const planKey = (req.user.plan || "FREE").toUpperCase();
    const plan = RECRUITER_PLANS[planKey] || RECRUITER_PLANS.FREE;

    // Count currently active jobs of this recruiter
    const activeCount = await jobCollection.countDocuments({
      recruiterId: req.user.id,
      status: JOB_STATUS.ACTIVE,
    });

    if (activeCount >= plan.maxActiveJobs) {
      return res.status(403).json({
        success: false,
        message: `You have reached your active job limit (${plan.maxActiveJobs}). Please upgrade your plan or close an existing job.`,
        limit: plan.maxActiveJobs,
        used: activeCount,
        plan: plan.name,
      });
    }

    req.planInfo = {
      plan: plan.name,
      used: activeCount,
      limit: plan.maxActiveJobs,
      remaining: plan.maxActiveJobs - activeCount,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Plan limit check error: " + error.message,
    });
  }
};

/**
 * Optional helper: check saved jobs limit for seekers
 */
const checkSeekerSavedJobLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const savedJobCollection = req.app.locals.savedJobCollection;
    // If collection doesn't exist yet, skip the check
    if (!savedJobCollection) {
      return next();
    }

    const planKey = (req.user.plan || "FREE").toUpperCase();
    const plan = SEEKER_PLANS[planKey] || SEEKER_PLANS.FREE;

    if (plan.maxSavedJobs === Infinity) {
      return next();
    }

    const count = await savedJobCollection.countDocuments({
      userId: req.user.id,
    });

    if (count >= plan.maxSavedJobs) {
      return res.status(403).json({
        success: false,
        message: `You have reached your saved jobs limit (${plan.maxSavedJobs}). Please upgrade your plan.`,
        limit: plan.maxSavedJobs,
        used: count,
        plan: plan.name,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Saved job limit check error: " + error.message,
    });
  }
};

module.exports = {
  checkSeekerApplicationLimit,
  checkRecruiterJobLimit,
  checkSeekerSavedJobLimit,
};
