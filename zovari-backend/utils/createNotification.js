const Notification = require("../models/Notification");

// recipientId ko apni khud ki activity pe notification nahi jati (self-like/self-comment safe)
async function createNotification({ recipient, sender, type, post }) {
  try {
    if (String(recipient) === String(sender)) return; // khud ko notification nahi
    await Notification.create({ recipient, sender, type, post });
  } catch (err) {
    console.warn("Notification create nahi ho saki:", err.message);
  }
}

module.exports = { createNotification };
