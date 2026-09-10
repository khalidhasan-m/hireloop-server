const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();

app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = buffer; } }));
app.use("/uploads", express.static(require("path").join(process.cwd(), "uploads")));

// Lazy CORS require so missing/old cors versions don't crash cold starts.
let corsMiddleware = null;
try {
  const cors = require("cors");
  corsMiddleware = cors({
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://hireloop-client-weld.vercel.app",
        process.env.CLIENT_URL,
      ].filter(Boolean);
      if (!origin || allowed.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });
} catch (e) {
  corsMiddleware = (req, res, next) => next();
}
app.use(corsMiddleware);

app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("Hireloop Server is running!");
});

const uri = process.env.MONGO_DB_URI || "mongodb://127.0.0.1:27017";

let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

let routesMounted = false;
async function ensureDbAndRoutes() {
  const client = await getClient();
  await client.db("admin").command({ ping: 1 });

  if (routesMounted) return;
  routesMounted = true;

  const database = client.db("hireloop_db");

  const jobCollection = database.collection("jobs");
  const companyCollection = database.collection("companies");
  const applicationCollection = database.collection("applications");
  const savedJobCollection = database.collection("savedJobs");
  const paymentCollection = database.collection("payments");
  const subscriptionCollection = database.collection("subscriptions");

  const userCollection = database.collection("user");
  const sessionCollection = database.collection("session");
  const interviewCollection = database.collection("interviews");
  const notificationCollection = database.collection("notifications");
  const messageCollection = database.collection("messages");

  app.locals.jobCollection = jobCollection;
  app.locals.companyCollection = companyCollection;
  app.locals.applicationCollection = applicationCollection;
  app.locals.savedJobCollection = savedJobCollection;
  app.locals.paymentCollection = paymentCollection;
  app.locals.subscriptionCollection = subscriptionCollection;
  app.locals.userCollection = userCollection;
  app.locals.sessionCollection = sessionCollection;
  app.locals.interviewCollection = interviewCollection;
  app.locals.notificationCollection = notificationCollection;
  app.locals.messageCollection = messageCollection;

  const jobRoutes = require("./routes/job.routes")(jobCollection);
  const companyRoutes = require("./routes/company.routes")(companyCollection);
  const applicationRoutes = require("./routes/application.routes")(applicationCollection, jobCollection, notificationCollection);
  const savedJobRoutes = require("./routes/savedJob.routes")(savedJobCollection, jobCollection);
  const paymentRoutes = require("./routes/payment.routes")(paymentCollection, userCollection, subscriptionCollection, notificationCollection);
  const adminRoutes = require("./routes/admin.routes")(
    userCollection,
    companyCollection,
    jobCollection,
    paymentCollection,
    applicationCollection,
    subscriptionCollection,
    notificationCollection,
  );
  const profileRoutes = require("./routes/profile.routes")(userCollection);
  const analyticsRoutes = require("./routes/analytics.routes")({ jobCollection, applicationCollection, userCollection, paymentCollection });
  const uploadRoutes = require("./routes/upload.routes")({ userCollection, companyCollection });
  const interactionRoutes = require("./routes/interaction.routes")({ interviewCollection, notificationCollection, messageCollection, applicationCollection, jobCollection });

  app.use("/api/jobs", jobRoutes);
  app.use("/api/companies", companyRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/saved-jobs", savedJobRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api", interactionRoutes);
}

// Vercel serverless handler: connect + mount on every cold start / request.
module.exports = async (req, res) => {
  try {
    await ensureDbAndRoutes();
    return app(req, res);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return res.status(500).json({ success: false, message: "Database connection failed: " + error.message });
  }
};

// Local / long-running hosts (Render, Railway, etc.): keep listening.
if (require.main === module) {
  const port = process.env.PORT || 5050;
  ensureDbAndRoutes()
    .then(() => {
      app.listen(port, () => {
        console.log(`Hireloop server listening on port ${port}`);
      });
    })
    .catch((error) => console.error("Failed to connect to MongoDB:", error));
}
