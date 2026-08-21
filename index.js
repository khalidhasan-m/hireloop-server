require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const port = process.env.PORT || 5050;
const { MongoClient, ServerApiVersion } = require("mongodb");

// Middleware (Enable credentials for cookies/auth headers across ports)
app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));

app.get("/", (req, res) => {
  res.send("Hireloop Server is running!");
});

const uri = process.env.MONGO_DB_URI;

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
    
    // Better Auth collections in MongoDB
    const userCollection = database.collection("user");
    const sessionCollection = database.collection("session");

    // Attach all collections to app.locals for global availability
    app.locals.jobCollection = jobCollection;
    app.locals.companyCollection = companyCollection;
    app.locals.applicationCollection = applicationCollection;
    app.locals.userCollection = userCollection;
    app.locals.sessionCollection = sessionCollection;

    const jobRoutes = require("./routes/job.routes")(jobCollection);
    const companyRoutes = require("./routes/company.routes")(companyCollection);
    const applicationRoutes = require("./routes/application.routes")(applicationCollection);

    app.use("/api/jobs", jobRoutes);
    app.use("/api/companies", companyRoutes);
    app.use("/api/applications", applicationRoutes);

  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Hireloop server listening on port ${port}`);
});