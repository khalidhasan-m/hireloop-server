require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const port = process.env.PORT || 5050;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = buffer; } }));
app.use("/uploads", express.static(require("path").join(process.cwd(), "uploads")));
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.send("Hireloop Server is running!");
});

const uri = process.env.MONGO_DB_URI || "mongodb://127.0.0.1:27017";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

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
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Hireloop server listening on port ${port}`);
});
