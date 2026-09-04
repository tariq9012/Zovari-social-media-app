const Notification = require("../models/Notification");
const User = require("../models/User");
const { emitToUser } = require("./socket");
const { isBlockedEitherWay } = require("./blockHelpers");

const prefFieldByType = {
  like: "notifyOnLikes",
  comment: "notifyOnComments",
  follow: "notifyOnFollows",
  follow_request: "notifyOnFollows",
  follow_accept: "notifyOnFollows",
  mention: "notifyOnMentions",
};

// recipientId ko apni khud ki activity pe notification nahi jati (self-like/self-comment safe)
async function createNotification({ recipient, sender, type, post }) {
  try {
    if (String(recipient) === String(sender)) return; // khud ko notification nahi

    // Extra safety net - agar kahin block check chook bhi jaye, yahan bhi ruk jayegi
    if (await isBlockedEitherWay(recipient, sender)) return;

    // Recipient ne is type ki notification apni Settings me band kar rakhi ho to bilkul mat banao
    const prefField = prefFieldByType[type];
    if (prefField) {
      const recipientUser = await User.findById(recipient).select(prefField);
      if (recipientUser && recipientUser[prefField] === false) return;
    }

    const notification = await Notification.create({ recipient, sender, type, post });

    // Real-time: recipient agar online hai to notifications.html turant update ho jayega,
    // page refresh/reopen ki zaroorat nahi. "post" bhi populate karte hain taake preview text
    // (jis post pe like/comment hua) turant dikh sake, page refresh ka intezar na karna paray
    const populated = await notification.populate([
      { path: "sender", select: "name avatar" },
      { path: "post", select: "text" },
    ]);
    emitToUser(recipient, "newNotification", populated);
  } catch (err) {
    console.warn("Notification create nahi ho saki:", err.message);
  }
}

module.exports = { createNotification };