const User = require("../models/User");

// Dono taraf check karta hai - A ne B ko block kiya ho ya B ne A ko, dono cases me true
async function isBlockedEitherWay(userIdA, userIdB) {
  if (String(userIdA) === String(userIdB)) return false;

  const [userA, userB] = await Promise.all([
    User.findById(userIdA).select("blockedUsers"),
    User.findById(userIdB).select("blockedUsers"),
  ]);

  if (!userA || !userB) return false;

  const aBlockedB = userA.blockedUsers.some((id) => String(id) === String(userIdB));
  const bBlockedA = userB.blockedUsers.some((id) => String(id) === String(userIdA));

  return aBlockedB || bBlockedA;
}

// Feed/reels/stories filter karne ke liye - jin authors ko exclude karna hai unki list deta hai
// (jinhe maine block/mute kiya hai + jinhone mujhe block kiya hai)
async function getExcludedAuthorIds(currentUserId) {
  const me = await User.findById(currentUserId).select("blockedUsers mutedUsers");
  if (!me) return [];

  const blockedOrMuted = [...me.blockedUsers, ...me.mutedUsers].map((id) => String(id));

  // Jin logon ne mujhe block kiya hai unki posts bhi mujhe nahi dikhni chahiye
  const blockedMe = await User.find({ blockedUsers: currentUserId }).select("_id");
  const blockedMeIds = blockedMe.map((u) => String(u._id));

  return [...new Set([...blockedOrMuted, ...blockedMeIds])];
}

module.exports = { isBlockedEitherWay, getExcludedAuthorIds };
