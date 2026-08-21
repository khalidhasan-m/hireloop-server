const { ObjectId } = require("mongodb");

const auth = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization header ("Bearer <token>")
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    // 2. Check custom header
    else if (req.headers.token) {
      token = req.headers.token;
    }
    // 3. Check Better Auth cookie if no header token is present
    else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      }, {});

      token = cookies["better-auth.session_token"] || cookies["session_token"];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized: No authentication token or session cookie found.",
      });
    }

    const sessionCollection = req.app.locals.sessionCollection;
    const userCollection = req.app.locals.userCollection;

    if (!sessionCollection || !userCollection) {
      return res.status(500).json({
        success: false,
        message: "Server error: Database collections not initialized.",
      });
    }

    // Find session in MongoDB
    const session = await sessionCollection.findOne({ token: token });

    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or expired session.",
      });
    }

    let queryId = session.userId;
    try {
      if (ObjectId.isValid(session.userId)) {
        queryId = new ObjectId(session.userId);
      }
    } catch (e) {}

    const user = await userCollection.findOne({ _id: queryId });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not found.",
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      ...user,
    };
    req.session = session;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Authentication error: " + error.message,
    });
  }
};

module.exports = auth;


