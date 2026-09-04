const crypto = require("crypto");

// Raw token email me bhejte hain, hashed version database me save karte hain
// (taake agar database leak ho to bhi kisi ke token misuse na ho sakein)
function generateToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, hashedToken };
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

module.exports = { generateToken, hashToken };
