const User = require("../models/User");

// "Alex Mercer" -> "alexmercer", agar pehle se le liya gaya ho to "alexmercer42" jaisa try karta hai
async function generateUniqueUsername(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20) || "user";

  let username = base;
  let attempt = 0;

  // Zyada se zyada 20 dafa try karte hain, warna aakhir me random string laga dete hain
  while (await User.findOne({ username })) {
    attempt += 1;
    if (attempt > 20) {
      username = `${base}${Math.random().toString(36).slice(2, 8)}`;
      break;
    }
    username = `${base}${Math.floor(Math.random() * 10000)}`;
  }

  return username;
}

module.exports = { generateUniqueUsername };
