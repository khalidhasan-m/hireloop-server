function normalizeUserId(value) {
  return value === undefined || value === null ? null : String(value);
}

async function createNotification(notificationCollection, { userId, type, title, body, ...metadata }) {
  const normalizedUserId = normalizeUserId(userId);
  if (!notificationCollection || !normalizedUserId) return null;

  const notification = {
    userId: normalizedUserId,
    type: type || "system",
    title: title || "New update",
    body: body || "You have a new update.",
    ...metadata,
    readAt: null,
    createdAt: new Date(),
  };

  const result = await notificationCollection.insertOne(notification);
  return { _id: result.insertedId, ...notification };
}

module.exports = { createNotification, normalizeUserId };
