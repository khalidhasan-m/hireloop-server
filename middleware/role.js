const { USER_ROLES } = require("../utils/constants");

/**
 * Role-based access control middleware
 * Usage:
 *   router.get("/admin-only", auth, roleGuard("admin"), handler)
 *   router.get("/recruiter-or-admin", auth, roleGuard(["recruiter", "admin"]), handler)
 */
const roleGuard = (allowedRoles) => {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not authenticated.",
        });
      }

      const userRole = (req.user.role || "").toLowerCase();

      if (!roles.map((r) => r.toLowerCase()).includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: This action requires one of the following roles: ${roles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Role check error: " + error.message,
      });
    }
  };
};

// Convenience helpers
const seekerOnly = roleGuard(USER_ROLES.SEEKER);
const recruiterOnly = roleGuard(USER_ROLES.RECRUITER);
const adminOnly = roleGuard(USER_ROLES.ADMIN);
const recruiterOrAdmin = roleGuard([USER_ROLES.RECRUITER, USER_ROLES.ADMIN]);

module.exports = {
  roleGuard,
  seekerOnly,
  recruiterOnly,
  adminOnly,
  recruiterOrAdmin,
};
