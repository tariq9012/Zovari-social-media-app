/* =========================================================
   ZOVARI - Premium Social App
   Shared front-end interactivity
   NOTE: Yeh sab client-side hai (localStorage/backend nahi hai abhi).
   Jab Express/Django backend lagega, is file ke fetch() calls
   backend API endpoints ko hit karengi (comments me batya hai kahan).
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initLikeButtons();
  initFollowButtons();
  initPasswordToggle();
  initProfileTabs();
  initExploreTabs();
  initComposer();
});

/* ---------- Like button ---------- */
function initLikeButtons() {
  const likeButtons = document.querySelectorAll(".like-btn");

  likeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const countEl = btn.querySelector(".like-count");
      const isLiked = btn.classList.toggle("liked");
      let count = parseInt(countEl.textContent.replace(/,/g, ""), 10);

      count = isLiked ? count + 1 : count - 1;
      countEl.textContent = count.toLocaleString();

      // TODO: backend lagne ke baad yahan se call jayega:
      // fetch(`/api/posts/${postId}/like`, { method: "POST" })
    });
  });
}

/* ---------- Follow button ---------- */
function initFollowButtons() {
  const followButtons = document.querySelectorAll(".btn-follow");

  followButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const following = btn.classList.toggle("following");
      btn.textContent = following ? "Following" : "Follow";

      // TODO: backend lagne ke baad:
      // fetch(`/api/users/${userId}/follow`, { method: "POST" })
    });
  });
}

/* ---------- Password show/hide toggle (auth pages) ---------- */
function initPasswordToggle() {
  const toggle = document.querySelector("[data-password-toggle]");
  if (!toggle) return;

  const input = document.querySelector("[data-password-input]");

  toggle.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.querySelector(".material-symbols-outlined").textContent = isHidden
      ? "visibility"
      : "visibility_off";
  });
}

/* ---------- Profile page tabs (Posts / Media / Likes) ---------- */
function initProfileTabs() {
  const tabs = document.querySelectorAll(".profile-tab");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      document
        .querySelectorAll(".profile-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".profile-panel")
        .forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
}

/* ---------- Explore page filter chips (For You / Trending / News...) ---------- */
function initExploreTabs() {
  const chips = document.querySelectorAll(".tab-chip");
  if (!chips.length) return;

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      // TODO: backend se category-wise posts fetch karne ka logic yahan aayega
    });
  });
}

/* ---------- Post composer ("What's on your mind?") ---------- */
function initComposer() {
  const postBtn = document.querySelector("[data-composer-post]");
  if (!postBtn) return;

  const textarea = document.querySelector("[data-composer-input]");

  postBtn.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) {
      textarea.focus();
      return;
    }

    // Abhi ke liye naya post card seedha feed ke top pe add ho jata hai.
    // Backend lagne ke baad yeh fetch("/api/posts", {method:"POST", body:...}) banega
    // aur response se real post render hoga.
    addPostToFeed(text);
    textarea.value = "";
  });
}

function addPostToFeed(text) {
  const feed = document.querySelector("[data-feed]");
  if (!feed) return;

  const card = document.createElement("article");
  card.className = "post-card";
  card.innerHTML = `
    <div class="post-header">
      <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80" alt="You" />
      <div class="post-author">
        <div class="post-author-name">You</div>
        <div class="post-author-meta">Just now</div>
      </div>
      <button class="post-more"><span class="material-symbols-outlined">more_horiz</span></button>
    </div>
    <p class="post-text">${escapeHtml(text)}</p>
    <div class="post-footer">
      <div class="post-stats">
        <button class="post-stat-btn like-btn">
          <span class="material-symbols-outlined">favorite</span>
          <span class="like-count">0</span>
        </button>
        <button class="post-stat-btn">
          <span class="material-symbols-outlined">chat_bubble</span>
          <span>0</span>
        </button>
        <button class="post-stat-btn">
          <span class="material-symbols-outlined">share</span>
        </button>
      </div>
      <button class="post-save"><span class="material-symbols-outlined">bookmark</span></button>
    </div>
  `;

  feed.prepend(card);
  initLikeButtons(); // naye button pe bhi listener lagana zaroori hai
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Login form (demo validation only, no backend yet) ---------- */
function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("login-error");

  if (!email || !password) {
    errorBox.textContent = "Email aur password dono zaroori hain.";
    errorBox.classList.add("show");
    return;
  }

  // TODO: backend lagne ke baad yahan real login call hogi:
  // fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  errorBox.classList.remove("show");
  window.location.href = "index.html";
}

/* ---------- Signup form (demo validation only, no backend yet) ---------- */
function handleSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("signup-error");

  if (!name || !email || password.length < 6) {
    errorBox.textContent = "Naam, email theek se bharein aur password 6+ characters ka rakhein.";
    errorBox.classList.add("show");
    return;
  }

  // TODO: backend lagne ke baad yahan real signup call hogi:
  // fetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) })
  errorBox.classList.remove("show");
  window.location.href = "index.html";
}
