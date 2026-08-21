const sendApplicationStatusEmail = async ({ to, candidateName, jobTitle, status }) => {
  if (!to || !process.env.RESEND_API_KEY) return { sent: false, reason: "Email provider is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "HireLoop <notifications@hireloop.app>",
      to: [to],
      subject: `Application update: ${jobTitle || "your application"}`,
      html: `<p>Hello ${candidateName || "there"},</p><p>Your application status is now <strong>${status}</strong>.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return { sent: true };
};

module.exports = { sendApplicationStatusEmail };
