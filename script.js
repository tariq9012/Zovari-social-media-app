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
  initComments();
  initFeedSearch();
  initSettingsToggles();
  initMessages();
  initComposerFocus();
});

/* ---------- Focus the composer when "Create" is clicked or page opens with #composer ---------- */
function initComposerFocus() {
  const composer = document.getElementById("composer");
  if (!composer) return; // sirf home page pe composer hota hai

  const focusComposer = () => {
    composer.scrollIntoView({ behavior: "smooth", block: "center" });
    composer.querySelector("[data-composer-input]").focus();
  };

  document.querySelectorAll("[data-focus-composer]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      focusComposer();
    });
  });

  // Agar koi doosre page se "index.html#composer" link se aaya hai
  if (window.location.hash === "#composer") {
    setTimeout(focusComposer, 200);
  }
}

/* ---------- Like button ---------- */
function initLikeButtons() {
  const likeButtons = document.querySelectorAll(".like-btn");

  likeButtons.forEach((btn) => {
    if (btn.dataset.bound) return; // dobara listener na lagay
    btn.dataset.bound = "true";

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
    if (btn.dataset.bound) return; // dobara listener na lagay
    btn.dataset.bound = "true";

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

/* ---------- Comments (view + add) ---------- */
function initComments() {
  // Open/close a post's comment section when the comment-bubble icon is clicked
  document.querySelectorAll(".comment-toggle").forEach((btn) => {
    // avoid double-binding if called again after a new post is injected
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";

    btn.addEventListener("click", () => {
      const card = btn.closest(".post-card");
      const section = card.querySelector(".comments-section");
      const isOpen = section.classList.toggle("open");
      btn.classList.toggle("active", isOpen);
      if (isOpen) {
        const input = section.querySelector(".comment-input-wrap input");
        input.focus();
      }
    });
  });

  // Submit a new comment (Enter key or send button)
  document.querySelectorAll(".comment-form").forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";

    const input = form.querySelector("input");
    const sendBtn = form.querySelector("[data-comment-send]");

    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      addComment(form, text);
      input.value = "";
    };

    sendBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

function addComment(form, text) {
  const card = form.closest(".post-card");
  const list = card.querySelector(".comment-list");
  const countEl = card.querySelector(".comment-count");

  const item = document.createElement("div");
  item.className = "comment-item";
  item.innerHTML = `
    <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80" alt="You" />
    <div class="comment-bubble">
      <div class="comment-author">You</div>
      <div class="comment-text">${escapeHtml(text)}</div>
      <div class="comment-meta"><span>Just now</span> <button type="button">Like</button> <button type="button">Reply</button></div>
    </div>
  `;
  list.appendChild(item);

  if (countEl) {
    const current = parseInt(countEl.textContent.replace(/,/g, ""), 10) || 0;
    countEl.textContent = current + 1;
  }

  // TODO: backend lagne ke baad:
  // fetch(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ text }) })
}

/* ---------- Feed search (home.html search box filters posts) ---------- */
function initFeedSearch() {
  const searchInput = document.querySelector("[data-feed-search]");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const posts = document.querySelectorAll("[data-feed] .post-card");

    posts.forEach((post) => {
      const author = post.querySelector(".post-author-name")?.textContent.toLowerCase() || "";
      const text = post.querySelector(".post-text")?.textContent.toLowerCase() || "";
      const matches = !query || author.includes(query) || text.includes(query);
      post.style.display = matches ? "" : "none";
    });
  });
}

/* ---------- Settings toggles + save button ---------- */
function initSettingsToggles() {
  const saveBtn = document.querySelector("[data-settings-save]");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", () => {
    // TODO: backend lagne ke baad:
    // fetch("/api/users/me/settings", { method: "PATCH", body: JSON.stringify({...}) })
    showToast("Settings saved");
  });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------- Messages page (conversation switching + send demo reply) ---------- */
function initMessages() {
  const convItems = document.querySelectorAll(".conv-item");
  if (!convItems.length) return;

  convItems.forEach((item) => {
    item.addEventListener("click", () => {
      convItems.forEach((c) => c.classList.remove("active"));
      item.classList.add("active");

      const name = item.querySelector(".conv-name").textContent;
      const avatar = item.querySelector("img").src;
      document.querySelector(".chat-header .conv-name").textContent = name;
      document.querySelector(".chat-header img").src = avatar;

      // Demo conversation reset
      const chatBox = document.querySelector(".chat-messages");
      chatBox.innerHTML = `<div class="chat-bubble theirs">Hey! Just saw your latest post, looks amazing.</div>`;
    });
  });

  const sendBtn = document.querySelector("[data-chat-send]");
  const chatInput = document.querySelector("[data-chat-input]");
  if (!sendBtn) return;

  const send = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const chatBox = document.querySelector(".chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble mine";
    bubble.textContent = text;
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    chatInput.value = "";

    // TODO: backend lagne ke baad:
    // fetch(`/api/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) })
  };

  sendBtn.addEventListener("click", send);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
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
        <button class="post-stat-btn comment-toggle">
          <span class="material-symbols-outlined">chat_bubble</span>
          <span class="comment-count">0</span>
        </button>
        <button class="post-stat-btn">
          <span class="material-symbols-outlined">share</span>
        </button>
      </div>
      <button class="post-save"><span class="material-symbols-outlined">bookmark</span></button>
    </div>
    <div class="comments-section">
      <div class="comment-list"></div>
      <div class="comment-form">
        <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80" alt="You" />
        <div class="comment-input-wrap">
          <input type="text" placeholder="Write a comment..." />
          <button type="button" data-comment-send><span class="material-symbols-outlined">send</span></button>
        </div>
      </div>
    </div>
  `;

  feed.prepend(card);
  // Naye elements pe listeners lagana zaroori hai (dobara call karne se
  // purane buttons skip ho jate hain kyunke unpe dataset.bound set ho chuka hai)
  initLikeButtons();
  initComments();
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