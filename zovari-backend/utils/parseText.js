// Text ke andar se #hashtags aur @mentions dhoondh nikalta hai

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) || [];
  // "#" hata kar, lowercase kar ke, duplicates hata dete hain
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

module.exports = { extractHashtags, extractMentions };
