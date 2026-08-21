/* =========================================================
   ZOVARI - Premium Social App
   Shared front-end interactivity
   Ab backend (Express.js + MongoDB) lag chuka hai, is file ke
   fetch() calls neeche diye gaye API_BASE pe chal rahe backend
   ko hit karte hain (login, signup, feed, like, follow, comments).
   ========================================================= */

// Backend URL - agar server kisi doosri port/domain pe chal raha ho to yahan badal dein
const API_BASE = "http://localhost:5000/api";

/* ---------- Auth helpers (JWT token localStorage me store hota hai) ---------- */
function getToken() {
  return localStorage.getItem("zovari_token");
}
function getCurrentUser() {
  const raw = localStorage.getItem("zovari_user");
  return raw ? JSON.parse(raw) : null;
}
function saveSession(token, user) {
  localStorage.setItem("zovari_token", token);
  localStorage.setItem("zovari_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("zovari_token");
  localStorage.removeItem("zovari_user");
}

// Sab authenticated API calls ke liye ek helper - token header khud laga deta hai
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Something went wrong, please try again");
  }
  return data;
}

// Image file ko backend (Cloudinary) pe upload karta hai aur uska public URL wapis deta hai
async function uploadFile(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {}, // Content-Type manually mat lagana - browser boundary khud set karta hai
    body: formData,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Image upload failed");
  }
  return data.url;
}

// "5 minutes ago" jaisa time dikhane ke liye
function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

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
  initLogout();
  loadFeed(); // home page pe backend se real posts la kar dikhata hai
  loadProfile(); // profile page pe real user + posts la kar dikhata hai
  loadExplore(); // explore page pe real creators + popular posts
  loadNotifications(); // notifications page pe real notifications
  initPostMenus(); // post ke 3-dot menu (edit/delete/report/copy link)
});

/* ---------- Logout (sidebar ka "Logout" link) ---------- */
function initLogout() {
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    if (link.textContent.trim().toLowerCase().includes("logout")) {
      link.addEventListener("click", () => clearSession());
    }
  });
}

/* ---------- Home feed: backend se real posts fetch karna ---------- */
async function loadFeed() {
  const feed = document.querySelector("[data-feed]");
  if (!feed) return; // sirf index.html (home) pe chalega

  try {
    const posts = await apiFetch("/posts");
    feed.innerHTML = ""; // static/demo posts hata kar real posts dikhana
    posts.forEach((post) => feed.appendChild(buildPostCard(post)));
  } catch (err) {
    // Backend abhi chal nahi raha ya reachable nahi -> demo content hi rehne dein
    console.warn("Feed backend se load nahi ho saki:", err.message);
  }
}

/* ---------- Profile page: real user + posts backend se lana ---------- */
async function loadProfile() {
  const profileHead = document.querySelector(".profile-head");
  if (!profileHead) return; // sirf profile.html pe chalega

  const params = new URLSearchParams(window.location.search);
  const currentUser = getCurrentUser();
  const targetId = params.get("id") || (currentUser && currentUser._id);

  if (!targetId) {
    // Na URL me id hai na koi logged-in user - login karwa dete hain
    window.location.href = "login.html";
    return;
  }

  try {
    const { user, posts } = await apiFetch(`/users/${targetId}`);
    const isOwnProfile = currentUser && String(currentUser._id) === String(user._id);

    document.querySelectorAll(".profile-avatar").forEach((img) => (img.src = user.avatar));
    const nameEl = document.querySelector(".profile-name-row h2");
    if (nameEl) nameEl.textContent = user.name;
    const handleEl = document.querySelector(".profile-handle");
    if (handleEl) handleEl.textContent = "@" + user.name.toLowerCase().replace(/\s+/g, "");
    const bioEl = document.querySelector(".profile-bio");
    if (bioEl) bioEl.textContent = user.bio || "No bio yet.";
    const locationEl = document.querySelector(".profile-meta span");
    if (locationEl && user.location) {
      locationEl.innerHTML = `<span class="material-symbols-outlined">location_on</span> ${escapeHtml(user.location)}`;
    }
    const joinedEl = document.querySelectorAll(".profile-meta span")[2];
    if (joinedEl) {
      const joined = new Date(user.createdAt);
      joinedEl.innerHTML = `<span class="material-symbols-outlined">calendar_month</span> Joined ${joined.toLocaleString("default", { month: "long", year: "numeric" })}`;
    }

    const statsEl = document.querySelector(".profile-stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <span><b>${user.followingCount ?? user.following.length}</b> Following</span>
        <span><b>${user.followersCount ?? user.followers.length}</b> Followers</span>
      `;
    }

    // Follow button: khud ki profile pe hide, doosre ki profile pe real follow wire karna
    const followBtn = document.querySelector(".profile-head-actions .btn-follow");
    if (followBtn) {
      if (isOwnProfile) {
        followBtn.style.display = "none";
      } else {
        followBtn.dataset.userId = user._id;
        const isFollowing =
          currentUser && user.followers.some((id) => String(id) === String(currentUser._id));
        followBtn.classList.toggle("following", !!isFollowing);
        followBtn.textContent = isFollowing ? "Following" : "Follow";
      }
    }

    // "Message" icon button - doosre ki profile pe click karne se conversation start ho
    const mailBtn = document.querySelector(".profile-head-actions .icon-btn:nth-child(2)");
    if (mailBtn && !isOwnProfile) {
      mailBtn.addEventListener("click", async () => {
        if (!getToken()) {
          window.location.href = "login.html";
          return;
        }
        try {
          const conv = await apiFetch("/conversations", {
            method: "POST",
            body: JSON.stringify({ userId: user._id }),
          });
          window.location.href = `messages.html?conv=${conv._id}`;
        } catch (err) {
          showToast(err.message);
        }
      });
    }

    // Posts tab - real posts render karna
    const postsPanel = document.getElementById("tab-posts");
    if (postsPanel) {
      const mediaGrid = postsPanel.querySelector(".media-grid");
      postsPanel.innerHTML = "";
      if (mediaGrid) postsPanel.appendChild(mediaGrid);
      if (posts.length === 0) {
        const empty = document.createElement("p");
        empty.style.cssText = "color:var(--color-text-muted); padding:24px 0; text-align:center;";
        empty.textContent = "No posts yet.";
        postsPanel.appendChild(empty);
      } else {
        posts.forEach((post) => postsPanel.appendChild(buildPostCard(post)));
      }
    }
  } catch (err) {
    console.warn("Profile load nahi hui:", err.message);
  }
}

/* ---------- Explore page: real creators + popular posts backend se lana ---------- */
async function loadExplore() {
  const creatorGrid = document.querySelector(".creator-grid");
  const discoverGrid = document.querySelector(".discover-grid");
  if (!creatorGrid && !discoverGrid) return; // sirf explore.html pe chalega

  if (creatorGrid) {
    try {
      const users = await apiFetch("/users?limit=4");
      if (users.length) {
        creatorGrid.innerHTML = "";
        users.forEach((user) => {
          const card = document.createElement("div");
          card.className = "creator-card";
          card.innerHTML = `
            <a href="profile.html?id=${user._id}">
              <img src="${user.avatar}" alt="${escapeHtml(user.name)}" />
            </a>
            <div class="creator-name">${escapeHtml(user.name)}</div>
            <div class="creator-field">${escapeHtml(user.bio || "Zovari member")}</div>
            <button class="btn btn-secondary btn-pill btn-follow" data-user-id="${user._id}">Follow</button>
          `;
          creatorGrid.appendChild(card);
        });
        initFollowButtons();
      }
    } catch (err) {
      console.warn("Creators load nahi huay:", err.message);
    }
  }

  if (discoverGrid) {
    try {
      const posts = await apiFetch("/posts?sort=popular&limit=5");
      if (posts.length) {
        discoverGrid.innerHTML = "";
        posts.forEach((post) => {
          const author = post.author || {};
          const item = document.createElement("div");
          item.className = "discover-item";
          item.innerHTML = `
            <a href="index.html">
              <img src="${author.avatar || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"}" alt="${escapeHtml(post.text.slice(0, 40))}" />
            </a>
            <div class="discover-caption">
              <div class="discover-title">${escapeHtml(post.text.slice(0, 60))}${post.text.length > 60 ? "…" : ""}</div>
              <div class="discover-author">
                <img src="${author.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(author.name || "User")}" />
                ${escapeHtml(author.name || "User")}
              </div>
            </div>
          `;
          discoverGrid.appendChild(item);
        });
      }
    } catch (err) {
      console.warn("Popular posts load nahi huay:", err.message);
    }
  }
}

/* ---------- Notifications page: real notifications backend se lana ---------- */
async function loadNotifications() {
  const notifList = document.querySelector(".notif-list");
  if (!notifList) return; // sirf notifications.html pe chalega

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const notifications = await apiFetch("/notifications");
    if (!notifications.length) {
      notifList.innerHTML = `<p style="color:var(--color-text-muted); padding:24px 0; text-align:center;">No notifications yet.</p>`;
      return;
    }

    const icons = {
      like: { cls: "like", icon: "favorite", filled: true },
      comment: { cls: "comment", icon: "chat_bubble", filled: false },
      follow: { cls: "follow", icon: "person_add", filled: false },
    };
    const verbs = {
      like: "liked your post",
      comment: "commented on your post",
      follow: "started following you",
    };

    notifList.innerHTML = "";
    notifications.forEach((n) => {
      const meta = icons[n.type] || icons.like;
      const sender = n.sender || {};
      const item = document.createElement("div");
      item.className = `notif-item${n.read ? "" : " unread"}`;
      item.innerHTML = `
        <div class="notif-icon ${meta.cls}"><span class="material-symbols-outlined${meta.filled ? " icon-filled" : ""}">${meta.icon}</span></div>
        <div class="notif-body">
          <div class="notif-text"><b>${escapeHtml(sender.name || "Someone")}</b> ${verbs[n.type] || ""}</div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
      `;
      notifList.appendChild(item);
    });

    // Sab dekh li gaien hain, backend me read mark kar do
    apiFetch("/notifications/read-all", { method: "PATCH" }).catch(() => {});
  } catch (err) {
    console.warn("Notifications load nahi huien:", err.message);
  }
}

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

/* ---------- Like button (real backend call) ---------- */
function initLikeButtons() {
  const likeButtons = document.querySelectorAll(".like-btn");

  likeButtons.forEach((btn) => {
    if (btn.dataset.bound) return; // dobara listener na lagay
    btn.dataset.bound = "true";

    btn.addEventListener("click", async () => {
      const card = btn.closest("[data-post-id]");
      const postId = card ? card.dataset.postId : null;
      const countEl = btn.querySelector(".like-count");

      if (!postId) {
        // Purane demo card (backend ke bagair) - sirf visual toggle
        const isLiked = btn.classList.toggle("liked");
        let count = parseInt(countEl.textContent.replace(/,/g, ""), 10);
        countEl.textContent = (isLiked ? count + 1 : count - 1).toLocaleString();
        return;
      }

      if (!getToken()) {
        showToast("Please log in to like posts");
        window.location.href = "login.html";
        return;
      }

      try {
        const result = await apiFetch(`/posts/${postId}/like`, { method: "POST" });
        btn.classList.toggle("liked", result.liked);
        countEl.textContent = result.likesCount.toLocaleString();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

/* ---------- Follow button (real backend call) ---------- */
function initFollowButtons() {
  const followButtons = document.querySelectorAll(".btn-follow");

  followButtons.forEach((btn) => {
    if (btn.dataset.bound) return; // dobara listener na lagay
    btn.dataset.bound = "true";

    btn.addEventListener("click", async () => {
      const userId = btn.dataset.userId;

      if (!userId) {
        // Purana demo button (real user ke bagair) - sirf visual toggle
        const following = btn.classList.toggle("following");
        btn.textContent = following ? "Following" : "Follow";
        return;
      }

      if (!getToken()) {
        showToast("Please log in to follow users");
        window.location.href = "login.html";
        return;
      }

      try {
        const result = await apiFetch(`/users/${userId}/follow`, { method: "POST" });
        btn.classList.toggle("following", result.following);
        btn.textContent = result.following ? "Following" : "Follow";
      } catch (err) {
        showToast(err.message);
      }
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

    btn.addEventListener("click", async () => {
      const card = btn.closest(".post-card");
      const section = card.querySelector(".comments-section");
      const isOpen = section.classList.toggle("open");
      btn.classList.toggle("active", isOpen);

      if (isOpen) {
        const input = section.querySelector(".comment-input-wrap input");
        input.focus();

        // Real comments backend se load karo (sirf ek dafa, jab pehli baar khule)
        const postId = card.dataset.postId;
        if (postId && !section.dataset.loaded) {
          section.dataset.loaded = "true";
          try {
            const comments = await apiFetch(`/posts/${postId}/comments`);
            const list = section.querySelector(".comment-list");
            list.innerHTML = "";
            comments.forEach((c) => list.appendChild(buildCommentItem(c)));
          } catch (err) {
            console.warn("Comments load nahi huay:", err.message);
          }
        }
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

function buildCommentItem(comment) {
  const item = document.createElement("div");
  item.className = "comment-item";
  const author = comment.author || {};
  item.innerHTML = `
    <img src="${author.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(author.name || "User")}" />
    <div class="comment-bubble">
      <div class="comment-author">${escapeHtml(author.name || "User")}</div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      <div class="comment-meta"><span>${timeAgo(comment.createdAt)}</span> <button type="button">Like</button> <button type="button">Reply</button></div>
    </div>
  `;
  return item;
}

async function addComment(form, text) {
  const card = form.closest(".post-card");
  const list = card.querySelector(".comment-list");
  const countEl = card.querySelector(".comment-count");
  const postId = card.dataset.postId;

  if (!postId) {
    // Purana demo card - backend ke bagair sirf visual
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
    if (countEl) countEl.textContent = (parseInt(countEl.textContent.replace(/,/g, ""), 10) || 0) + 1;
    return;
  }

  if (!getToken()) {
    showToast("Please log in to comment");
    window.location.href = "login.html";
    return;
  }

  try {
    const comment = await apiFetch(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    list.appendChild(buildCommentItem(comment));
    if (countEl) countEl.textContent = (parseInt(countEl.textContent.replace(/,/g, ""), 10) || 0) + 1;
  } catch (err) {
    showToast(err.message);
  }
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

/* ---------- Settings: current user data load karna + save button real backend call ---------- */
function initSettingsToggles() {
  const saveBtn = document.querySelector("[data-settings-save]");
  if (!saveBtn) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  // Page load hote hi apni current details fields me bhar dena
  const currentUser = getCurrentUser();
  if (currentUser) {
    const nameInput = document.getElementById("set-name");
    const emailInput = document.getElementById("set-email");
    if (nameInput) nameInput.value = currentUser.name || "";
    if (emailInput) emailInput.value = currentUser.email || "";
  }

  const avatarPreview = document.querySelector("[data-settings-avatar-preview]");
  const avatarInput = document.querySelector("[data-settings-avatar-input]");
  const avatarBtn = document.querySelector("[data-settings-avatar-btn]");
  let selectedAvatarFile = null;
  let uploadedAvatarUrl = "";

  apiFetch(`/users/${currentUser?._id}`)
    .then(({ user }) => {
      const bioInput = document.getElementById("set-bio");
      const locationInput = document.getElementById("set-location");
      if (bioInput) bioInput.value = user.bio || "";
      if (locationInput) locationInput.value = user.location || "";
      if (avatarPreview && user.avatar) avatarPreview.src = user.avatar;
    })
    .catch((err) => console.warn("Could not load settings:", err.message));

  if (avatarBtn && avatarInput) {
    avatarBtn.addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file");
        avatarInput.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be under 5MB");
        avatarInput.value = "";
        return;
      }

      selectedAvatarFile = file;
      avatarPreview.src = URL.createObjectURL(file);
    });
  }

  saveBtn.addEventListener("click", async () => {
    const name = document.getElementById("set-name")?.value.trim();
    const bio = document.getElementById("set-bio")?.value.trim();
    const location = document.getElementById("set-location")?.value.trim();

    try {
      saveBtn.disabled = true;

      if (selectedAvatarFile) {
        saveBtn.textContent = "Uploading photo...";
        uploadedAvatarUrl = await uploadFile(selectedAvatarFile);
        selectedAvatarFile = null;
      }

      saveBtn.textContent = "Save changes";
      const payload = { name, bio, location };
      if (uploadedAvatarUrl) payload.avatar = uploadedAvatarUrl;

      const updatedUser = await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // localStorage me bhi naya naam/avatar update kar dena taake baqi pages sahi dikhein
      const session = getCurrentUser();
      if (session) {
        saveSession(getToken(), {
          ...session,
          name: updatedUser.name,
          bio: updatedUser.bio,
          avatar: updatedUser.avatar,
        });
      }
      showToast("Settings saved");
    } catch (err) {
      showToast(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
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

/* ---------- Messages page (real conversations + messages backend se) ---------- */
async function initMessages() {
  const convList = document.querySelector(".conv-list");
  if (!convList) return; // sirf messages.html pe chalega

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const conversations = await apiFetch("/conversations");
    const params = new URLSearchParams(window.location.search);
    const targetConvId = params.get("conv");

    if (conversations.length === 0) {
      convList.innerHTML = `<h3>Messages</h3><p style="color:var(--color-text-muted); font-size:14px; padding:12px 0;">No conversations yet. Visit someone's profile and tap the message icon to start one.</p>`;
      const chatBox = document.querySelector(".chat-messages");
      if (chatBox) chatBox.innerHTML = "";
      return;
    }

    renderConvList(conversations, targetConvId || conversations[0]._id);
  } catch (err) {
    console.warn("Conversations load nahi huien:", err.message);
  }
}

function renderConvList(conversations, activeId) {
  const convList = document.querySelector(".conv-list");
  convList.innerHTML = "<h3>Messages</h3>";

  conversations.forEach((conv) => {
    const other = conv.otherUser || {};
    const item = document.createElement("div");
    item.className = "conv-item" + (conv._id === activeId ? " active" : "");
    item.dataset.convId = conv._id;
    item.innerHTML = `
      <img src="${other.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(other.name || "User")}" />
      <div>
        <div class="conv-name">${escapeHtml(other.name || "User")}</div>
        <div class="conv-preview">${escapeHtml(conv.lastMessage || "Say hi 👋")}</div>
      </div>
    `;
    item.addEventListener("click", () => openConversation(conv._id, other));
    convList.appendChild(item);
  });

  const activeConv = conversations.find((c) => c._id === activeId) || conversations[0];
  openConversation(activeConv._id, activeConv.otherUser || {});
}

async function openConversation(convId, otherUser) {
  document.querySelectorAll(".conv-item").forEach((c) => {
    c.classList.toggle("active", c.dataset.convId === convId);
  });

  const header = document.querySelector(".chat-header");
  if (header) {
    header.querySelector(".conv-name").textContent = otherUser.name || "User";
    header.querySelector("img").src =
      otherUser.avatar ||
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80";
  }

  const chatBox = document.querySelector(".chat-messages");
  if (!chatBox) return;
  chatBox.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); font-size:13px;">Loading...</p>`;

  try {
    const messages = await apiFetch(`/conversations/${convId}/messages`);
    const currentUser = getCurrentUser();
    chatBox.innerHTML = "";
    if (messages.length === 0) {
      chatBox.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); font-size:13px;">Say hi 👋 to start the conversation.</p>`;
    } else {
      messages.forEach((m) => {
        const mine = currentUser && String(m.sender._id) === String(currentUser._id);
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${mine ? "mine" : "theirs"}`;
        bubble.textContent = m.text;
        chatBox.appendChild(bubble);
      });
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    chatBox.innerHTML = "";
    console.warn("Messages load nahi huay:", err.message);
  }

  bindChatSend(convId, chatBox);
}

function bindChatSend(convId, chatBox) {
  const sendBtn = document.querySelector("[data-chat-send]");
  const chatInput = document.querySelector("[data-chat-input]");
  if (!sendBtn || !chatInput) return;

  // Purana listener hata kar naya laga dete hain taake har baar sahi convId use ho
  const freshSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(freshSendBtn, sendBtn);
  const freshChatInput = chatInput.cloneNode(true);
  chatInput.parentNode.replaceChild(freshChatInput, chatInput);

  const send = async () => {
    const text = freshChatInput.value.trim();
    if (!text) return;

    try {
      const message = await apiFetch(`/conversations/${convId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (chatBox.querySelector("p")) chatBox.innerHTML = ""; // "Say hi" wala placeholder hata dena
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble mine";
      bubble.textContent = message.text;
      chatBox.appendChild(bubble);
      chatBox.scrollTop = chatBox.scrollHeight;
      freshChatInput.value = "";
    } catch (err) {
      showToast(err.message);
    }
  };

  freshSendBtn.addEventListener("click", send);
  freshChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}

/* ---------- Post composer ("What's on your mind?") ---------- */
function initComposer() {
  const postBtn = document.querySelector("[data-composer-post]");
  if (!postBtn) return;

  const textarea = document.querySelector("[data-composer-input]");
  const imageBtn = document.querySelector("[data-composer-image-btn]");
  const fileInput = document.querySelector("[data-composer-file-input]");
  const previewBox = document.querySelector("[data-composer-preview]");
  const previewImg = document.querySelector("[data-composer-preview-img]");
  const removeImageBtn = document.querySelector("[data-composer-remove-image]");
  let selectedFile = null;

  if (imageBtn && fileInput) {
    imageBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file");
        fileInput.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be under 5MB");
        fileInput.value = "";
        return;
      }

      selectedFile = file;
      previewImg.src = URL.createObjectURL(file);
      previewBox.style.display = "block";
    });
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      previewBox.style.display = "none";
    });
  }

  postBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text && !selectedFile) {
      showToast("Write something or add an image first");
      textarea.focus();
      return;
    }

    if (!getToken()) {
      showToast("Please log in to post");
      window.location.href = "login.html";
      return;
    }

    try {
      postBtn.disabled = true;

      let imageUrl = "";
      if (selectedFile) {
        postBtn.textContent = "Uploading...";
        imageUrl = await uploadFile(selectedFile);
      }

      postBtn.textContent = "Post";
      const post = await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({ text, image: imageUrl }),
      });
      const feed = document.querySelector("[data-feed]");
      feed.prepend(buildPostCard(post));

      textarea.value = "";
      selectedFile = null;
      if (fileInput) fileInput.value = "";
      if (previewBox) previewBox.style.display = "none";
    } catch (err) {
      showToast(err.message);
    } finally {
      postBtn.disabled = false;
      postBtn.textContent = "Post";
    }
  });
}

// Backend se aaye post object (author, text, likes, createdAt) se ek post-card DOM element banata hai
/* ---------- Post 3-dot menu: Edit/Delete (apna post) ya Copy link/Report (kisi aur ka post) ---------- */
function initPostMenus() {
  if (document.body.dataset.postMenuBound) return; // event delegation - sirf ek dafa bind karna hai
  document.body.dataset.postMenuBound = "true";

  document.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest("[data-post-menu-toggle]");
    if (toggleBtn) {
      const menu = toggleBtn.nextElementSibling;
      const wasOpen = menu.classList.contains("open");
      document.querySelectorAll(".post-menu.open").forEach((m) => m.classList.remove("open"));
      if (!wasOpen) menu.classList.add("open");
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const card = actionBtn.closest("[data-post-id]");
      const menu = actionBtn.closest(".post-menu");
      if (menu) menu.classList.remove("open");
      const postId = card ? card.dataset.postId : null;

      if (actionBtn.dataset.action === "edit") startPostEdit(card);
      else if (actionBtn.dataset.action === "delete") await deletePostCard(card, postId);
      else if (actionBtn.dataset.action === "copy-link") copyPostLink(postId);
      else if (actionBtn.dataset.action === "report") showToast("Post reported. Thanks for letting us know.");
      return;
    }

    // Kahin aur click hua (menu ke bahar) - sab khule menu band kar do
    if (!e.target.closest(".post-menu")) {
      document.querySelectorAll(".post-menu.open").forEach((m) => m.classList.remove("open"));
    }
  });
}

// Post ko inline edit karne ke liye textarea box dikhana
function startPostEdit(card) {
  if (!card || card.querySelector(".post-edit-box")) return;

  const textEl = card.querySelector(".post-text");
  const currentText = textEl ? textEl.textContent : "";

  const editBox = document.createElement("div");
  editBox.className = "post-edit-box";
  editBox.innerHTML = `
    <textarea>${escapeHtml(currentText)}</textarea>
    <div class="post-edit-actions">
      <button type="button" class="btn btn-secondary btn-pill" data-edit-cancel>Cancel</button>
      <button type="button" class="btn btn-primary btn-pill" data-edit-save>Save</button>
    </div>
  `;

  if (textEl) {
    textEl.style.display = "none";
    textEl.insertAdjacentElement("afterend", editBox);
  } else {
    card.querySelector(".post-header").insertAdjacentElement("afterend", editBox);
  }

  const textarea = editBox.querySelector("textarea");
  textarea.focus();

  editBox.querySelector("[data-edit-cancel]").addEventListener("click", () => {
    editBox.remove();
    if (textEl) textEl.style.display = "";
  });

  editBox.querySelector("[data-edit-save]").addEventListener("click", async () => {
    const newText = textarea.value.trim();
    const hasImage = !!card.querySelector(".post-media");
    if (!newText && !hasImage) {
      showToast("Post needs some text or an image");
      return;
    }

    try {
      const updated = await apiFetch(`/posts/${card.dataset.postId}`, {
        method: "PATCH",
        body: JSON.stringify({ text: newText }),
      });
      editBox.remove();

      if (textEl) {
        if (updated.text) {
          textEl.textContent = updated.text;
          textEl.style.display = "";
        } else {
          textEl.remove(); // text hata diya, sirf image reh gayi
        }
      } else if (updated.text) {
        const p = document.createElement("p");
        p.className = "post-text";
        p.textContent = updated.text;
        card.querySelector(".post-header").insertAdjacentElement("afterend", p);
      }
      showToast("Post updated");
    } catch (err) {
      showToast(err.message);
    }
  });
}

// Post delete karne se pehle confirm karna
async function deletePostCard(card, postId) {
  if (!card || !postId) return;
  if (!window.confirm("Delete this post? This cannot be undone.")) return;

  try {
    await apiFetch(`/posts/${postId}`, { method: "DELETE" });
    card.remove();
    showToast("Post deleted");
  } catch (err) {
    showToast(err.message);
  }
}

// Post ka link clipboard me copy karna
function copyPostLink(postId) {
  const basePath = window.location.pathname.replace(/[^/]*$/, "");
  const url = `${window.location.origin}${basePath}index.html?post=${postId}`;
  navigator.clipboard.writeText(url).then(
    () => showToast("Link copied"),
    () => showToast("Could not copy link")
  );
}

function buildPostCard(post) {
  const author = post.author || {};
  const currentUser = getCurrentUser();
  const alreadyLiked =
    currentUser && Array.isArray(post.likes) && post.likes.some((id) => String(id) === String(currentUser._id));
  const isOwnPost = currentUser && author._id && String(currentUser._id) === String(author._id);

  const menuItemsHtml = isOwnPost
    ? `
      <button class="post-menu-item" data-action="edit">
        <span class="material-symbols-outlined">edit</span> Edit post
      </button>
      <button class="post-menu-item danger" data-action="delete">
        <span class="material-symbols-outlined">delete</span> Delete post
      </button>
    `
    : `
      <button class="post-menu-item" data-action="copy-link">
        <span class="material-symbols-outlined">link</span> Copy link
      </button>
      <button class="post-menu-item danger" data-action="report">
        <span class="material-symbols-outlined">flag</span> Report post
      </button>
    `;

  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.postId = post._id;
  card.innerHTML = `
    <div class="post-header">
      <a href="profile.html?id=${author._id}">
        <img src="${author.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(author.name || "User")}" />
      </a>
      <div class="post-author">
        <a href="profile.html?id=${author._id}" style="text-decoration:none; color:inherit;">
          <div class="post-author-name">${escapeHtml(author.name || "User")}</div>
        </a>
        <div class="post-author-meta">${timeAgo(post.createdAt)}</div>
      </div>
      <button class="post-more" data-post-menu-toggle><span class="material-symbols-outlined">more_horiz</span></button>
      <div class="post-menu" data-post-menu>${menuItemsHtml}</div>
    </div>
    ${post.text ? `<p class="post-text">${escapeHtml(post.text)}</p>` : ""}
    ${post.image ? `<img class="post-media" src="${post.image}" alt="Post image" />` : ""}
    <div class="post-footer">
      <div class="post-stats">
        <button class="post-stat-btn like-btn${alreadyLiked ? " liked" : ""}">
          <span class="material-symbols-outlined">favorite</span>
          <span class="like-count">${(post.likesCount ?? (post.likes ? post.likes.length : 0)).toLocaleString()}</span>
        </button>
        <button class="post-stat-btn comment-toggle">
          <span class="material-symbols-outlined">chat_bubble</span>
          <span class="comment-count">${post.commentsCount || 0}</span>
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

  // Naye card ke apne like/comment listeners lagana (dataset.bound guard ki wajah se
  // purane cards ke listeners dobara nahi lagtay, sirf yeh naya card cover hota hai)
  initLikeButtons();
  initComments();
  initPostMenus();
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Login form (real backend call) ---------- */
async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("login-error");
  const submitBtn = event.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    errorBox.textContent = "Email and password are both required.";
    errorBox.classList.add("show");
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(data.token, data.user);
    errorBox.classList.remove("show");
    window.location.href = "index.html";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Signup form (real backend call) ---------- */
async function handleSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("signup-error");
  const submitBtn = event.target.querySelector('button[type="submit"]');

  if (!name || !email || password.length < 6) {
    errorBox.textContent = "Please fill in your name, email correctly, and use a password of 6+ characters.";
    errorBox.classList.add("show");
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    const data = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveSession(data.token, data.user);
    errorBox.classList.remove("show");
    window.location.href = "index.html";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}