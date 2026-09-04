const User = require("../models/User");
const { createNotification } = require("./createNotification");
const { extractMentions } = require("./parseText");

// Post/comment text me @username mentions dhoondh kar un users ko notification bhejna.
// NOTE: yeh hamesha response bhej dene ke BAAD call hota hai, is liye khud apna try/catch
// zaroori hai - warna koi error yahan crash kar sakta hai (headers already sent).
async function notifyMentions(text, senderId, postId) {
  try {
    const usernames = extractMentions(text);
    if (usernames.length === 0) return;

    const mentionedUsers = await User.find({ username: { $in: usernames } }).select("_id");
    await Promise.all(
      mentionedUsers.map((u) =>
        createNotification({ recipient: u._id, sender: senderId, type: "mention", post: postId })
      )
    );
  } catch (err) {
    console.warn("Mention notifications fail huien:", err.message);
  }
}

module.exports = { notifyMentions };
