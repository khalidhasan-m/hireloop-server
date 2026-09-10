const https = require("https");
const { MongoClient } = require("mongodb");
(async () => {
  const fs = require("fs");
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};
  envText.split("\n").forEach(function(line) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m && !m[1].trim().startsWith("#")) env[m[1].trim()] = m[2];
  });
  const uri = env.MONGO_DB_URI;
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db("hireloop_db");
  const s = db.collection("session");
  const doc = await s.findOne({}, { sort: { expiresAt: -1 } });
  if (!doc) { console.log("no session found"); await c.close(); process.exit(0); }
  console.log("session keys:", Object.keys(doc));
  console.log("userId:", doc.userId || doc.id);
  if (doc.token) console.log("token (first 40):", doc.token.substring(0, 40) + "...");
  const body = JSON.stringify({ plan: "PRO", role: "seeker" });
  const data = await new Promise((res, rej) => {
    const req = https.request({
      hostname: "localhost",
      port: 5050,      path: "/api/payments/create-payment-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (doc.token || ""),
        "Content-Length": Buffer.byteLength(body),
      },
    }, (resp) => {
      let chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => res(Buffer.concat(chunks).toString()));
    });
    req.on("error", rej);
    req.write(body);
    req.end();
  });
  console.log("RESPONSE:", data);
  await c.close();
})().catch(e => console.error("FAILED:", e.message));
