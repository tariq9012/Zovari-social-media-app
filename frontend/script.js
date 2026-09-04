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
  initExploreTabs(); // For You / Trending / News / Architecture / Tech tabs
  loadNotifications(); // notifications page pe real notifications
  loadSavedPosts(); // saved.html pe user ki saved posts
  loadHashtagPage(); // hashtag.html pe us tag ki posts
  initPostMenus(); // post ke 3-dot menu (edit/delete/report/copy link)
  initVerifyBanner(); // email verify reminder banner (home page)
  initStoriesBar(); // home page pe Stories bar (24-ghante wali disappearing posts)
  initStoryViewerControls(); // story viewer modal ke controls - har us page pe jahan modal maujood ho
  initReelsPage(); // reels.html pe vertical short-video feed
  initMobileTopbar(); // mobile/tablet top bar - logo, messages, search, 3-dot menu
  injectCallUI(); // voice/video call overlays - har page pe (incoming call kahin bhi aa sakti hai)
  injectPostInsightsModal(); // post insights panel - har page pe jahan posts render ho sakte hain
  initSocketConnection(); // real-time messages + notifications (Socket.io)
  refreshUnreadBadges(); // fallback: socket na chal saka to bhi REST se badge count aa jaye
});

/* =========================================================
   MOBILE TOP BAR - logo, messages, search toggle, 3-dot menu
   (Settings, Saved, Login/Logout - jo cheezain mobile pe sidebar
   hide hone ki wajah se ghayab ho jati thin)
   ========================================================= */
function initMobileTopbar() {
  const topbar = document.querySelector(".mobile-topbar");
  if (!topbar) return;

  const searchBtn = document.querySelector("[data-mobile-search-btn]");
  const searchCloseBtn = document.querySelector("[data-mobile-search-close]");
  const mainRow = document.querySelector("[data-mobile-topbar-main]");
  const searchRow = document.querySelector("[data-mobile-search-row]");
  const menuBtn = document.querySelector("[data-mobile-menu-btn]");
  const dropdown = document.querySelector("[data-mobile-topbar-dropdown]");

  searchBtn.addEventListener("click", () => {
    mainRow.style.display = "none";
    searchRow.style.display = "flex";
    searchRow.querySelector("[data-global-search]").focus();
  });

  searchCloseBtn.addEventListener("click", () => {
    searchRow.style.display = "none";
    mainRow.style.display = "flex";
    const input = searchRow.querySelector("[data-global-search]");
    input.value = "";
    searchRow.querySelector("[data-search-results]").classList.remove("open");
  });

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === "block";
    if (isOpen) {
      dropdown.style.display = "none";
      return;
    }

    const loggedIn = Boolean(getToken());
    dropdown.innerHTML = `
      <a href="settings.html" class="mobile-topbar-dropdown-item">
        <span class="material-symbols-outlined">settings</span><span>Settings</span>
      </a>
      <a href="saved.html" class="mobile-topbar-dropdown-item">
        <span class="material-symbols-outlined">bookmark</span><span>Saved</span>
      </a>
      ${
        loggedIn
          ? '<div class="mobile-topbar-dropdown-item" data-mobile-logout><span class="material-symbols-outlined">logout</span><span>Logout</span></div>'
          : '<a href="login.html" class="mobile-topbar-dropdown-item"><span class="material-symbols-outlined">login</span><span>Login</span></a>'
      }
    `;
    dropdown.style.display = "block";

    const logoutItem = dropdown.querySelector("[data-mobile-logout]");
    if (logoutItem) {
      logoutItem.addEventListener("click", () => {
        if (socket) socket.disconnect(); // real-time connection bhi band kar dena
        clearSession();
        window.location.href = "login.html";
      });
    }

    // Bahar kahin bhi click ho to dropdown band ho jaye
    setTimeout(() => document.addEventListener("click", () => (dropdown.style.display = "none"), { once: true }), 0);
  });
}

/* =========================================================
   REAL-TIME (Socket.io) - messages + notifications
   Ab in dono ke liye page refresh/reopen karne ki zaroorat nahi;
   naya message ya notification aate hi live update ho jata hai.
   ========================================================= */
let socket = null;
let currentConversationId = null; // messages.html pe abhi kaunsi conversation khuli hai
let currentConversationIsGroup = false;
let currentConversationParticipants = []; // group modal/info ke liye
let currentConversationAdminId = null; // group ka admin kaun hai (3-dot menu ke options ke liye)
let currentConversationOtherUser = null; // 1-to-1 chat me doosra banda (Block/Mute/Profile menu ke liye)
let currentConversationIsMuted = false; // is conversation ki notifications mute hain ya nahi

function initSocketConnection() {
  if (!getToken()) return; // login nahi hai to connect karne ka koi fayda nahi
  if (typeof io === "undefined") {
    console.warn("Socket.io client load nahi hui - real-time updates kaam nahi karenge");
    return;
  }
  if (socket) return; // pehle se connected hai

  const socketBase = API_BASE.replace(/\/api\/?$/, ""); // http://localhost:5000/api -> http://localhost:5000

  socket = io(socketBase, {
    auth: { token: getToken() },
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect nahi ho saka:", err.message);
  });

  refreshUnreadBadges(); // login/reconnect hote hi turant sahi count dikhana
  bindCallSocketEvents(); // voice/video call ke signaling events (kisi bhi page se kaam karta hai)

  // ---- Naya message aya ----
  socket.on("newMessage", (message) => {
    const isOpenConversation =
      currentConversationId && String(message.conversation) === String(currentConversationId);

    if (isOpenConversation) {
      const chatBox = document.querySelector(".chat-messages");
      if (chatBox) {
        if (chatBox.querySelector("p")) chatBox.innerHTML = ""; // "Say hi" placeholder hata dena
        chatBox.appendChild(buildChatBubble(message, false, message.isGroup));
        chatBox.scrollTop = chatBox.scrollHeight;
      }
      const typingEl = document.querySelector("[data-chat-typing]");
      if (typingEl) typingEl.style.display = "none"; // message aa gaya to "typing..." hata dena
    } else {
      // Agar ye conversation mute hai to toast bhi chup rehta hai (sirf badge/list update hota hai)
      const convItem = document.querySelector(`.conv-item[data-conv-id="${message.conversation}"]`);
      const isMuted = convItem?.dataset.muted === "true";
      if (!isMuted) showToast(`New message from ${message.sender?.name || "someone"}`);
    }

    // Messages.html khula ho to sidebar list bhi refresh (latest message + order update)
    if (document.querySelector(".conv-list")) {
      initMessages();
    }

    if (!isOpenConversation) refreshUnreadBadges(); // khuli hui conversation ka badge nahi barhta
  });

  // ---- Group ban gaya / rename hua / member add-remove hua ----
  socket.on("groupUpdated", () => {
    if (document.querySelector(".conv-list")) initMessages();
  });

  // ---- "typing..." indicator ----
  socket.on("typing", ({ conversationId }) => {
    if (currentConversationId && conversationId === currentConversationId) {
      const typingEl = document.querySelector("[data-chat-typing]");
      if (typingEl) typingEl.style.display = "block";
    }
  });
  socket.on("stopTyping", ({ conversationId }) => {
    if (currentConversationId && conversationId === currentConversationId) {
      const typingEl = document.querySelector("[data-chat-typing]");
      if (typingEl) typingEl.style.display = "none";
    }
  });

  // ---- Nayi notification ----
  socket.on("newNotification", (notification) => {
    const notifList = document.querySelector(".notif-list");
    if (notifList) {
      if (notifList.querySelector("p")) notifList.innerHTML = ""; // "No notifications yet" hata dena
      notifList.prepend(buildNotifItem({ ...notification, read: true })); // page khuli hai to turant "read" maan lete hain
    }
    const verb = NOTIF_VERBS[notification.type] || "sent you a notification";
    showToast(`${notification.sender?.name || "Someone"} ${verb}`);
    refreshUnreadBadges();
  });

  // Isi user ne kisi doosre tab me sab notifications "read" kar dien
  socket.on("notificationsRead", () => {
    setBadgeCount("[data-notif-badge], [data-notif-badge-mobile]", 0);
  });
}

/* ---------- Notifications + Messages badge (red circle, real-time) ---------- */
async function refreshUnreadBadges() {
  if (!getToken()) return;
  try {
    const [notifRes, convRes] = await Promise.all([
      apiFetch("/notifications/unread-count"),
      apiFetch("/conversations/unread-count"),
    ]);
    setBadgeCount("[data-notif-badge], [data-notif-badge-mobile]", notifRes.count);
    setBadgeCount("[data-msg-badge], [data-msg-badge-mobile]", convRes.count);
  } catch (err) {
    console.warn("Unread badges load nahi hue:", err.message);
  }
}

function setBadgeCount(selector, count) {
  document.querySelectorAll(selector).forEach((el) => {
    if (count > 0) {
      el.textContent = count > 99 ? "99+" : String(count);
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  });
}

/* ---------- Logout (sidebar ka "Logout" link) ---------- */
function initLogout() {
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    if (link.textContent.trim().toLowerCase().includes("logout")) {
      link.addEventListener("click", () => {
        if (socket) socket.disconnect(); // real-time connection bhi band kar dena
        clearSession();
      });
    }
  });
}

/* ---------- Home feed: backend se real posts fetch karna ---------- */
const FEED_PAGE_SIZE = 10;
let feedPage = 1;
let feedHasMore = true;
let feedLoadingMore = false;

/* ---------- Email verify reminder banner (home page) ---------- */
function initVerifyBanner() {
  const banner = document.querySelector("[data-verify-banner]");
  if (!banner) return; // sirf index.html pe hai

  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.isEmailVerified) return; // already verified ya login nahi

  banner.style.display = "flex";

  const resendBtn = banner.querySelector("[data-resend-verify-btn]");
  resendBtn.addEventListener("click", async () => {
    try {
      resendBtn.disabled = true;
      resendBtn.textContent = "Sending...";
      const data = await apiFetch("/auth/resend-verification", { method: "POST" });
      showToast(data.message);
    } catch (err) {
      showToast(err.message);
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend email";
    }
  });
}

async function loadFeed() {
  const feed = document.querySelector("[data-feed]");
  if (!feed) return; // sirf index.html (home) pe chalega

  feedPage = 1;
  feedHasMore = true;

  try {
    const [posts] = await Promise.all([
      apiFetch(`/posts?page=1&limit=${FEED_PAGE_SIZE}`),
      ensureSavedPostIdsLoaded(),
    ]);
    feed.innerHTML = ""; // static/demo posts hata kar real posts dikhana
    posts.forEach((post) => feed.appendChild(buildPostCard(post)));
    if (posts.length < FEED_PAGE_SIZE) feedHasMore = false;
    highlightLinkedPost();
    initFeedInfiniteScroll(feed);
  } catch (err) {
    // Backend abhi chal nahi raha ya reachable nahi -> demo content hi rehne dein
    console.warn("Feed backend se load nahi ho saki:", err.message);
  }
}

// Scroll kar ke neeche pahunchte hi automatically agli posts load karna
function initFeedInfiniteScroll(feed) {
  const sentinel = document.querySelector("[data-feed-sentinel]");
  if (!sentinel) return;

  if (window.zovariFeedObserver) window.zovariFeedObserver.disconnect();

  window.zovariFeedObserver = new IntersectionObserver(
    async (entries) => {
      if (!entries[0].isIntersecting || !feedHasMore || feedLoadingMore) return;

      feedLoadingMore = true;
      sentinel.textContent = "Loading more posts...";

      try {
        feedPage += 1;
        const morePosts = await apiFetch(`/posts?page=${feedPage}&limit=${FEED_PAGE_SIZE}`);
        morePosts.forEach((post) => feed.appendChild(buildPostCard(post)));
        if (morePosts.length < FEED_PAGE_SIZE) feedHasMore = false;
      } catch (err) {
        console.warn("Aur posts load nahi ho sakin:", err.message);
      } finally {
        feedLoadingMore = false;
        sentinel.textContent = feedHasMore ? "" : "You're all caught up";
      }
    },
    { rootMargin: "200px" } // neeche pahunchne se thoda pehle hi load shuru ho jaye
  );

  window.zovariFeedObserver.observe(sentinel);
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
    await ensureSavedPostIdsLoaded();
    const {
      user,
      posts,
      isPrivateLocked,
      isBlocked,
      iBlockedThem,
      theyBlockedMe,
      iMutedThem,
      hasRequestedFollow,
    } =
      await apiFetch(`/users/${targetId}`);
    const isOwnProfile = currentUser && String(currentUser._id) === String(user._id);

    document.querySelectorAll(".profile-avatar").forEach((img) => (img.src = user.avatar));

    const coverEl = document.querySelector(".profile-cover");
    if (coverEl && user.coverImage) coverEl.src = user.coverImage;

    // Apni profile ho to cover/avatar/bio edit karne wale buttons dikhana
    if (isOwnProfile) {
      const coverEditBtn = document.querySelector("[data-profile-cover-edit-btn]");
      const avatarEditBtn = document.querySelector("[data-profile-avatar-edit-btn]");
      const bioEditBtn = document.querySelector("[data-profile-bio-edit-btn]");
      if (coverEditBtn) coverEditBtn.style.display = "flex";
      if (avatarEditBtn) avatarEditBtn.style.display = "flex";
      if (bioEditBtn) bioEditBtn.style.display = "flex";
      initProfileEditControls(user);
    }

    // Cover photo pe click karne se poori size me dikh jaye - sab profiles pe (apni ho ya kisi aur ki)
    const coverImgEl = document.querySelector("[data-profile-cover-img]");
    if (coverImgEl && !isOwnProfile) {
      coverImgEl.style.cursor = "pointer";
      coverImgEl.onclick = () => openPhotoViewer(coverImgEl.src);
    }

    // Profile pic ke gird story ring - agar is user ki koi active (24h wali) story hai
    const avatarWrap = document.querySelector("[data-profile-avatar-wrap]");
    if (avatarWrap && getToken()) {
      try {
        const stories = await apiFetch(`/stories/user/${user._id}`);
        if (stories.length > 0) {
          avatarWrap.classList.add("has-story");
          avatarWrap.onclick = () => {
            storyGroups = [{ author: user, stories, hasUnseen: false }];
            openStoryViewer(0, 0);
          };
        } else if (!isOwnProfile) {
          // Koi active story nahi - avatar pe click karne se seedha photo bari dikh jaye
          avatarWrap.style.cursor = "pointer";
          avatarWrap.onclick = () => openPhotoViewer(document.querySelector("[data-profile-avatar-img]").src);
        }
      } catch (err) {
        console.warn("Profile stories load nahi ho sakin:", err.message);
      }
    }

    const nameEl = document.querySelector(".profile-name-row h2");
    if (nameEl) nameEl.textContent = user.name;
    const badgeEl = document.querySelector(".profile-name-row .verified-badge");
    if (badgeEl) badgeEl.style.display = user.isVerified ? "inline-block" : "none";
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
        setFollowButtonState(followBtn, isFollowing ? "following" : hasRequestedFollow ? "requested" : "not-following");
      }
    }

    // "Message" icon button - doosre ki profile pe click karne se conversation start ho
    const mailBtn = document.querySelector("[data-profile-message-btn]");
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

    // "..." more menu - Block/Unblock, Mute/Unmute (sirf doosre ki profile pe)
    const moreBtn = document.querySelector("[data-profile-more-btn]");
    if (moreBtn) {
      if (isOwnProfile) {
        document.querySelector(".profile-more-wrap").style.display = "none";
      } else {
        moreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleProfileMoreMenu(user, iBlockedThem, iMutedThem);
        });
      }
    }

    // Block ho (kisi bhi taraf se) to profile restricted dikhati hai - posts/follow/message sab band
    const blockedBanner = document.querySelector("[data-profile-blocked-banner]");
    if (isBlocked && !isOwnProfile) {
      if (blockedBanner) {
        blockedBanner.style.display = "flex";
        blockedBanner.innerHTML = `<span class="material-symbols-outlined">block</span><span>${
          theyBlockedMe ? "You can't view this profile." : "You have blocked this user."
        }</span>`;
      }
      if (followBtn) followBtn.style.display = "none";
      if (mailBtn) mailBtn.style.display = "none";

      const postsPanel = document.getElementById("tab-posts");
      if (postsPanel) postsPanel.innerHTML = "";
      return; // aage posts/media/likes load karne ki zaroorat nahi
    }
    if (blockedBanner) blockedBanner.style.display = "none";

    // Posts tab - real posts render karna
    const postsPanel = document.getElementById("tab-posts");
    const mediaPanel = document.getElementById("tab-media");
    const likesPanel = document.getElementById("tab-likes");

    if (isPrivateLocked) {
      // Private account aur hum follower nahi hain - posts/media/likes kuch nahi dikhega
      const lockMsg = `<p style="color:var(--color-text-muted); padding:32px 0; text-align:center;">
        <span class="material-symbols-outlined" style="font-size:32px; display:block; margin-bottom:8px;">lock</span>
        This account is private. Follow ${escapeHtml(user.name)} to see their posts.
      </p>`;
      if (postsPanel) postsPanel.innerHTML = lockMsg;
      if (mediaPanel) mediaPanel.innerHTML = "";
      if (likesPanel) likesPanel.innerHTML = "";
      return;
    }

    if (postsPanel) {
      postsPanel.innerHTML = "";
      if (posts.length === 0) {
        const empty = document.createElement("p");
        empty.style.cssText = "color:var(--color-text-muted); padding:24px 0; text-align:center;";
        empty.textContent = "No posts yet.";
        postsPanel.appendChild(empty);
      } else {
        posts.forEach((post) => postsPanel.appendChild(buildPostCard(post)));
      }
    }

    // Media tab - inhi posts me se sirf woh jinke sath image hai
    if (mediaPanel) {
      const mediaPosts = posts.filter((post) => post.image);
      if (mediaPosts.length === 0) {
        mediaPanel.innerHTML = `<p style="color:var(--color-text-muted); padding:24px 0; text-align:center;">No media yet.</p>`;
      } else {
        const grid = document.createElement("div");
        grid.className = "media-grid";
        mediaPosts.forEach((post) => {
          const img = document.createElement("img");
          img.src = post.image;
          img.alt = "Post image";
          grid.appendChild(img);
        });
        mediaPanel.innerHTML = "";
        mediaPanel.appendChild(grid);
      }
    }

    // Likes tab - is user ne jo posts like ki hain
    if (likesPanel) {
      likesPanel.innerHTML = `<p style="color:var(--color-text-muted); padding:24px 0; text-align:center;">Loading...</p>`;
      apiFetch(`/users/${user._id}/liked`)
        .then((likedPosts) => {
          likesPanel.innerHTML = "";
          if (likedPosts.length === 0) {
            likesPanel.innerHTML = `<p style="color:var(--color-text-muted); padding:24px 0; text-align:center;">No liked posts yet.</p>`;
          } else {
            likedPosts.forEach((post) => likesPanel.appendChild(buildPostCard(post)));
          }
        })
        .catch((err) => console.warn("Liked posts load nahi huay:", err.message));
    }
  } catch (err) {
    console.warn("Profile load nahi hui:", err.message);
  }
}

/* ---------- Apni profile pe: cover/avatar/bio seedha edit karna (Settings pe jaye bagair) ---------- */
function initProfileEditControls(user) {
  const coverWrap = document.querySelector("[data-profile-cover-wrap]");
  if (coverWrap && !coverWrap.dataset.bound) {
    coverWrap.dataset.bound = "true";

    const coverInput = document.querySelector("[data-profile-cover-input]");
    const coverDropdown = document.querySelector("[data-profile-cover-dropdown]");

    document.querySelector("[data-profile-cover-edit-btn]").addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = coverDropdown.style.display === "block";
      closeAllProfilePhotoDropdowns();
      coverDropdown.style.display = isOpen ? "none" : "block";
    });
    document.querySelector("[data-profile-cover-view]").addEventListener("click", () => {
      closeAllProfilePhotoDropdowns();
      openPhotoViewer(document.querySelector("[data-profile-cover-img]").src);
    });
    document.querySelector("[data-profile-cover-change]").addEventListener("click", () => {
      closeAllProfilePhotoDropdowns();
      coverInput.click();
    });

    coverInput.addEventListener("change", async () => {
      const file = coverInput.files[0];
      coverInput.value = "";
      if (!file) return;
      showUploadingBanner("Your cover photo is uploading...");
      try {
        const coverImage = await uploadFile(file);
        await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ coverImage }) });
        document.querySelector("[data-profile-cover-img]").src = coverImage;
        showToast("Cover photo updated");
      } catch (err) {
        showToast(err.message || "Cover photo update nahi ho saki");
      } finally {
        hideUploadingBanner();
      }
    });

    // Cover pe seedha click karne se bhi photo bari dikh jaye (Facebook jaisa)
    document.querySelector("[data-profile-cover-img]").addEventListener("click", () => {
      openPhotoViewer(document.querySelector("[data-profile-cover-img]").src);
    });
  }

  const avatarWrap = document.querySelector("[data-profile-avatar-wrap]");
  if (avatarWrap && !avatarWrap.dataset.editBound) {
    avatarWrap.dataset.editBound = "true";

    const avatarInput = document.querySelector("[data-profile-avatar-input]");
    const avatarDropdown = document.querySelector("[data-profile-avatar-dropdown]");

    document.querySelector("[data-profile-avatar-edit-btn]").addEventListener("click", (e) => {
      e.stopPropagation(); // story-ring ke click se takra na jaye
      const isOpen = avatarDropdown.style.display === "block";
      closeAllProfilePhotoDropdowns();
      avatarDropdown.style.display = isOpen ? "none" : "block";
    });
    document.querySelector("[data-profile-avatar-view]").addEventListener("click", () => {
      closeAllProfilePhotoDropdowns();
      openPhotoViewer(document.querySelector("[data-profile-avatar-img]").src);
    });
    document.querySelector("[data-profile-avatar-change]").addEventListener("click", () => {
      closeAllProfilePhotoDropdowns();
      avatarInput.click();
    });

    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      avatarInput.value = "";
      if (!file) return;
      showUploadingBanner("Your profile photo is uploading...");
      try {
        const avatar = await uploadFile(file);
        await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ avatar }) });
        document.querySelectorAll(".profile-avatar").forEach((img) => (img.src = avatar));
        const session = getCurrentUser();
        if (session) saveSession(getToken(), { ...session, avatar });
        showToast("Profile photo updated");
      } catch (err) {
        showToast(err.message || "Profile photo update nahi ho saki");
      } finally {
        hideUploadingBanner();
      }
    });
  }

  if (!document.body.dataset.profilePhotoDropdownBound) {
    document.body.dataset.profilePhotoDropdownBound = "true";
    document.addEventListener("click", closeAllProfilePhotoDropdowns);
  }

  const bioEditBtn = document.querySelector("[data-profile-bio-edit-btn]");
  if (bioEditBtn && !bioEditBtn.dataset.bound) {
    bioEditBtn.dataset.bound = "true";

    const bioRow = document.querySelector("[data-profile-bio-row]");
    const bioEditBox = document.querySelector("[data-profile-bio-edit-box]");
    const bioInput = document.querySelector("[data-profile-bio-input]");
    const bioTextEl = document.querySelector(".profile-bio");

    bioEditBtn.addEventListener("click", () => {
      bioInput.value = user.bio || "";
      bioRow.style.display = "none";
      bioEditBox.style.display = "block";
      bioInput.focus();
    });

    document.querySelector("[data-profile-bio-cancel]").addEventListener("click", () => {
      bioEditBox.style.display = "none";
      bioRow.style.display = "flex";
    });

    document.querySelector("[data-profile-bio-save]").addEventListener("click", async () => {
      const newBio = bioInput.value.trim();
      try {
        await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ bio: newBio }) });
        bioTextEl.textContent = newBio || "No bio yet.";
        user.bio = newBio;
        bioEditBox.style.display = "none";
        bioRow.style.display = "flex";
        showToast("Bio updated");
      } catch (err) {
        showToast(err.message || "Bio update nahi ho saka");
      }
    });
  }
}

function closeAllProfilePhotoDropdowns() {
  document.querySelectorAll(".profile-photo-dropdown").forEach((d) => (d.style.display = "none"));
}

/* ---------- Photo viewer (View Profile Picture / View Cover Photo) ---------- */
function openPhotoViewer(src) {
  const viewer = document.querySelector("[data-photo-viewer]");
  if (!viewer) return;
  document.querySelector("[data-photo-viewer-img]").src = src;
  viewer.style.display = "flex";

  if (!viewer.dataset.bound) {
    viewer.dataset.bound = "true";
    document.querySelector("[data-photo-viewer-close]").addEventListener("click", closePhotoViewer);
    viewer.addEventListener("click", (e) => {
      if (e.target === viewer) closePhotoViewer(); // bahar (overlay) click ho to band ho jaye
    });
  }
}

function closePhotoViewer() {
  const viewer = document.querySelector("[data-photo-viewer]");
  if (viewer) viewer.style.display = "none";
}

/* ---------- Upload progress banner (Facebook jaisa "Your photo is uploading...") ---------- */
function showUploadingBanner(message) {
  const banner = document.querySelector("[data-upload-progress-banner]");
  if (!banner) return;
  document.querySelector("[data-upload-progress-text]").textContent = message || "Your photo is uploading...";
  banner.style.display = "flex";
}

function hideUploadingBanner() {
  const banner = document.querySelector("[data-upload-progress-banner]");
  if (banner) banner.style.display = "none";
}

/* ---------- Explore page: real creators + popular posts backend se lana ---------- */
/* ---------- Profile "..." menu: Block/Unblock, Mute/Unmute ---------- */
function toggleProfileMoreMenu(user, iBlockedThem, iMutedThem) {
  const dropdown = document.querySelector("[data-profile-more-dropdown]");
  const isOpen = dropdown.style.display === "block";
  if (isOpen) {
    dropdown.style.display = "none";
    return;
  }

  const items = [
    {
      icon: iMutedThem ? "volume_up" : "volume_off",
      label: iMutedThem ? "Unmute" : "Mute",
      action: () => handleToggleMuteUser(user._id, iMutedThem),
    },
    {
      icon: "block",
      label: iBlockedThem ? "Unblock" : "Block",
      action: () => handleToggleBlockUser(user._id, user.name, iBlockedThem),
      danger: !iBlockedThem,
    },
  ];

  dropdown.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "profile-more-item" + (item.danger ? " danger" : "");
    row.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span><span>${item.label}</span>`;
    row.addEventListener("click", () => {
      dropdown.style.display = "none";
      item.action();
    });
    dropdown.appendChild(row);
  });

  dropdown.style.display = "block";
  setTimeout(() => document.addEventListener("click", () => (dropdown.style.display = "none"), { once: true }), 0);
}

async function handleToggleMuteUser(userId, currentlyMuted) {
  try {
    await apiFetch(`/users/${userId}/mute`, { method: "POST" });
    showToast(currentlyMuted ? "Unmuted" : "Muted - their posts won't show in your feed");
    loadProfile(); // dropdown label update karne ke liye
  } catch (err) {
    showToast(err.message || "Could not update mute setting");
  }
}

async function handleToggleMuteConversation(convId) {
  try {
    const { muted } = await apiFetch(`/conversations/${convId}/mute`, { method: "PATCH" });
    currentConversationIsMuted = muted;
    showToast(muted ? "Notifications muted for this chat" : "Notifications unmuted");
  } catch (err) {
    showToast(err.message || "Could not update mute setting");
  }
}

async function handleToggleBlockUser(userId, userName, currentlyBlocked) {
  const confirmMsg = currentlyBlocked
    ? `Unblock ${userName}?`
    : `Block ${userName}? They won't be able to message, call, or find your profile.`;
  if (!confirm(confirmMsg)) return;

  try {
    await apiFetch(`/users/${userId}/block`, { method: "POST" });
    showToast(currentlyBlocked ? "Unblocked" : "Blocked");
    loadProfile(); // profile ko turant restricted/normal view me refresh karna
    loadBlockedAccountsList(); // settings page pe khuli ho to wo bhi refresh
  } catch (err) {
    showToast(err.message || "Could not update block setting");
  }
}

/* ---------- Settings: Follow requests list (pending, private account) ---------- */
async function loadFollowRequestsList() {
  const list = document.querySelector("[data-follow-requests-list]");
  if (!list) return; // sirf settings.html pe chalega

  try {
    const requests = await apiFetch("/users/me/follow-requests");
    if (requests.length === 0) {
      list.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">No pending follow requests.</p>`;
      return;
    }

    list.innerHTML = "";
    requests.forEach((u) => {
      const row = document.createElement("div");
      row.className = "blocked-item";
      row.innerHTML = `
        <img src="${u.avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(u.name)}" />
        <span class="blocked-name">${escapeHtml(u.name)}</span>
        <button type="button" class="btn btn-primary" data-fr-accept-btn>Accept</button>
        <button type="button" class="btn btn-secondary" data-fr-decline-btn>Decline</button>
      `;
      row.querySelector("[data-fr-accept-btn]").addEventListener("click", async () => {
        try {
          await apiFetch(`/users/${u._id}/follow-request/accept`, { method: "POST" });
          showToast(`Accepted ${u.name}`);
          loadFollowRequestsList();
        } catch (err) {
          showToast(err.message || "Could not accept request");
        }
      });
      row.querySelector("[data-fr-decline-btn]").addEventListener("click", async () => {
        try {
          await apiFetch(`/users/${u._id}/follow-request/reject`, { method: "POST" });
          showToast("Request declined");
          loadFollowRequestsList();
        } catch (err) {
          showToast(err.message || "Could not decline request");
        }
      });
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<p style="color:var(--color-error); font-size:13px;">${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- Settings: Blocked accounts list ---------- */
async function loadBlockedAccountsList() {
  const list = document.querySelector("[data-blocked-list]");
  if (!list) return; // sirf settings.html pe chalega

  try {
    const blockedUsers = await apiFetch("/users/me/blocked");
    if (blockedUsers.length === 0) {
      list.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">You haven't blocked anyone.</p>`;
      return;
    }

    list.innerHTML = "";
    blockedUsers.forEach((u) => {
      const row = document.createElement("div");
      row.className = "blocked-item";
      row.innerHTML = `
        <img src="${u.avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(u.name)}" />
        <span class="blocked-name">${escapeHtml(u.name)}</span>
        <button type="button" class="btn btn-secondary" data-unblock-btn>Unblock</button>
      `;
      row.querySelector("[data-unblock-btn]").addEventListener("click", async () => {
        try {
          await apiFetch(`/users/${u._id}/block`, { method: "POST" });
          showToast("Unblocked");
          loadBlockedAccountsList();
        } catch (err) {
          showToast(err.message || "Could not unblock");
        }
      });
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<p style="color:var(--color-error); font-size:13px;">${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- Settings: Verification (paid badge) ---------- */
let selectedVerificationPlan = "monthly";

function initVerificationSection() {
  const card = document.querySelector(".verification-card");
  if (!card || card.dataset.bound) return;
  card.dataset.bound = "true";

  loadVerificationStatus();

  // Plan select karna
  document.querySelectorAll(".verification-plan-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".verification-plan-option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedVerificationPlan = btn.dataset.plan;
    });
  });

  document.querySelector("[data-verification-subscribe-btn]").addEventListener("click", openCheckoutModal);
  document.querySelector("[data-verification-cancel-btn]").addEventListener("click", handleCancelVerification);
  document.querySelector("[data-checkout-close]").addEventListener("click", closeCheckoutModal);
  document.querySelector("[data-checkout-pay-btn]").addEventListener("click", handleCheckoutPay);

  // Card number ko "1234 5678 9012 3456" jaisa format karna jab type ho
  const cardInput = document.querySelector("[data-checkout-card-number]");
  cardInput.addEventListener("input", () => {
    const digits = cardInput.value.replace(/\D/g, "").slice(0, 19);
    cardInput.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });

  // Expiry ko "MM/YY" jaisa khud format karna
  const expiryInput = document.querySelector("[data-checkout-expiry]");
  expiryInput.addEventListener("input", () => {
    let digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) digits = digits.slice(0, 2) + "/" + digits.slice(2);
    expiryInput.value = digits;
  });

  const cvvInput = document.querySelector("[data-checkout-cvv]");
  cvvInput.addEventListener("input", () => {
    cvvInput.value = cvvInput.value.replace(/\D/g, "").slice(0, 4);
  });
}

async function loadVerificationStatus() {
  const activeView = document.querySelector("[data-verification-active]");
  const inactiveView = document.querySelector("[data-verification-inactive]");

  try {
    const currentUser = getCurrentUser();
    const { user } = await apiFetch(`/users/${currentUser._id}`);

    if (user.isVerified) {
      activeView.style.display = "block";
      inactiveView.style.display = "none";

      const planLabel = user.verificationPlan === "yearly" ? "Yearly plan" : "Monthly plan";
      const since = user.verifiedSince
        ? new Date(user.verifiedSince).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : "";
      document.querySelector("[data-verification-status-sub]").textContent = `${planLabel} · Verified since ${since}`;

      // localStorage me bhi turant update taake baqi pages (feed, comments) badge sahi dikhayen
      saveSession(getToken(), { ...currentUser, isVerified: true });
    } else {
      activeView.style.display = "none";
      inactiveView.style.display = "block";
      saveSession(getToken(), { ...currentUser, isVerified: false });
    }
  } catch (err) {
    console.warn("Verification status load nahi ho saka:", err.message);
  }
}

function openCheckoutModal() {
  const price = selectedVerificationPlan === "yearly" ? "$99.99/year" : "$11.99/month";
  document.querySelector("[data-checkout-summary]").innerHTML =
    `<span>${selectedVerificationPlan === "yearly" ? "Yearly" : "Monthly"} plan</span><span>${price}</span>`;
  document.querySelector("[data-checkout-modal]").style.display = "flex";
}

function closeCheckoutModal() {
  document.querySelector("[data-checkout-modal]").style.display = "none";
}

async function handleCheckoutPay() {
  const payBtn = document.querySelector("[data-checkout-pay-btn]");
  const cardNumber = document.querySelector("[data-checkout-card-number]").value;
  const cardName = document.querySelector("[data-checkout-card-name]").value;
  const expiry = document.querySelector("[data-checkout-expiry]").value;
  const cvv = document.querySelector("[data-checkout-cvv]").value;

  payBtn.disabled = true;
  payBtn.textContent = "Processing...";

  try {
    await apiFetch("/users/me/verify", {
      method: "POST",
      body: JSON.stringify({ plan: selectedVerificationPlan, cardNumber, cardName, expiry, cvv }),
    });
    showToast("You're verified! 🎉");
    closeCheckoutModal();
    document.querySelector("[data-checkout-card-number]").value = "";
    document.querySelector("[data-checkout-card-name]").value = "";
    document.querySelector("[data-checkout-expiry]").value = "";
    document.querySelector("[data-checkout-cvv]").value = "";
    loadVerificationStatus();
  } catch (err) {
    showToast(err.message || "Payment failed");
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = "Pay & Subscribe";
  }
}

async function handleCancelVerification() {
  if (!confirm("Cancel your verification subscription? Your badge will be removed.")) return;
  try {
    await apiFetch("/users/me/verify", { method: "DELETE" });
    showToast("Subscription cancelled");
    loadVerificationStatus();
  } catch (err) {
    showToast(err.message || "Could not cancel subscription");
  }
}

async function loadExplore(hashtag) {
  const creatorGrid = document.querySelector(".creator-grid");
  const discoverGrid = document.querySelector(".discover-grid");
  if (!creatorGrid && !discoverGrid) return; // sirf explore.html pe chalega

  // Creators sirf ek hi baar load hote hain (tabs unhe change nahi karte)
  if (creatorGrid && !creatorGrid.dataset.loaded) {
    creatorGrid.dataset.loaded = "true";
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
            <div class="creator-name">${escapeHtml(user.name)}${verifiedBadgeHtml(user.isVerified)}</div>
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
    // "Trending" tab #general dikhata hai, "News"/"Architecture"/"Tech" apna hashtag filter karte hain
    const query = hashtag ? `?hashtag=${encodeURIComponent(hashtag)}&limit=8` : "?sort=popular&limit=8";
    discoverGrid.innerHTML = `<p style="color:var(--color-text-muted); padding:20px 0;">Loading...</p>`;

    try {
      const [posts] = await Promise.all([apiFetch(`/posts${query}`), ensureSavedPostIdsLoaded()]);
      if (posts.length === 0) {
        discoverGrid.innerHTML = `<p style="color:var(--color-text-muted); padding:20px 0;">No posts yet${hashtag ? ` for #${escapeHtml(hashtag)}` : ""}. Check back later!</p>`;
        return;
      }

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
              ${escapeHtml(author.name || "User")}${verifiedBadgeHtml(author.isVerified)}
            </div>
          </div>
        `;
        discoverGrid.appendChild(item);
      });
    } catch (err) {
      console.warn("Posts load nahi huay:", err.message);
      discoverGrid.innerHTML = `<p style="color:var(--color-error); padding:20px 0;">Could not load posts.</p>`;
    }
  }
}

/* ---------- Explore page ke tabs (For You / Trending / News / Architecture / Tech) ---------- */
function initExploreTabs() {
  const tabs = document.querySelectorAll(".explore-tabs .tab-chip");
  if (!tabs.length || document.body.dataset.exploreTabsBound) return;
  document.body.dataset.exploreTabsBound = "true";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const label = tab.textContent.trim();
      // "For You" aur "Trending" dono general (unfiltered) posts dikhate hain,
      // baaki tabs apne naam ke hashtag se filter karte hain
      const hashtag = label === "For You" || label === "Trending" ? null : label.toLowerCase();
      loadExplore(hashtag);
    });
  });
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

    notifList.innerHTML = "";
    notifications.forEach((n) => notifList.appendChild(buildNotifItem(n)));

    // Sab dekh li gaien hain, backend me read mark kar do
    apiFetch("/notifications/read-all", { method: "PATCH" })
      .then(() => refreshUnreadBadges())
      .catch(() => {});
  } catch (err) {
    console.warn("Notifications load nahi huien:", err.message);
    // Purani static demo notifications ki jagah asal error dikhana - taake pata chale
    // k kya masla hai, warna fake "Sarah Jenkins liked your post" wagera dikhti rehti thi
    notifList.innerHTML = `<p style="color:var(--color-error); padding:24px 0; text-align:center;">Notifications load nahi ho sakin: ${escapeHtml(err.message)}</p>`;
  }
}

const NOTIF_ICONS = {
  like: { cls: "like", icon: "favorite", filled: true },
  comment: { cls: "comment", icon: "chat_bubble", filled: false },
  follow: { cls: "follow", icon: "person_add", filled: false },
  follow_request: { cls: "follow", icon: "person_add", filled: false },
  follow_accept: { cls: "follow", icon: "how_to_reg", filled: false },
  mention: { cls: "mention", icon: "alternate_email", filled: false },
};
const NOTIF_VERBS = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  follow_request: "requested to follow you",
  follow_accept: "accepted your follow request",
  mention: "mentioned you in a post",
};

function buildNotifItem(n) {
  const meta = NOTIF_ICONS[n.type] || NOTIF_ICONS.like;
  const sender = n.sender || {};

  // Follow ke ilawa har notification kisi post se related hoti hai - us post ka ek chhota
  // sa preview bhi dikha dete hain taake pata chale "kis post per" like/comment/mention hua
  let postPreview = "";
  if (n.post && n.post.text) {
    const snippet = n.post.text.length > 40 ? n.post.text.slice(0, 40) + "…" : n.post.text;
    postPreview = ` "${escapeHtml(snippet)}"`;
  }

  const isFollowRequest = n.type === "follow_request";

  // Follow request wali notification ke liye poora item click-navigate nahi karta (kyunke
  // usme apne Accept/Decline buttons hain) - baqi sab notifications jaisi pehle thin waisi hi
  const item = document.createElement(isFollowRequest ? "div" : "a");
  if (!isFollowRequest) item.href = `profile.html?id=${sender._id || ""}`;
  item.style.textDecoration = "none";
  item.style.color = "inherit";
  item.className = `notif-item${n.read ? "" : " unread"}`;

  if (!isFollowRequest) {
    item.innerHTML = `
      <div class="notif-icon ${meta.cls}"><span class="material-symbols-outlined${meta.filled ? " icon-filled" : ""}">${meta.icon}</span></div>
      <div class="notif-body">
        <div class="notif-text"><b>${escapeHtml(sender.name || "Someone")}${verifiedBadgeHtml(sender.isVerified)}</b> ${NOTIF_VERBS[n.type] || ""}${postPreview}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
    `;
    return item;
  }

  // Follow request: avatar/naam profile pe le jate hain, lekin Accept/Decline
  // seedha yahin se ho jata hai - jaise Instagram/Facebook activity feed me hota hai
  item.innerHTML = `
    <a href="profile.html?id=${sender._id || ""}">
      <div class="notif-icon ${meta.cls}"><span class="material-symbols-outlined">${meta.icon}</span></div>
    </a>
    <div class="notif-body">
      <a href="profile.html?id=${sender._id || ""}" style="text-decoration:none; color:inherit;">
        <div class="notif-text"><b>${escapeHtml(sender.name || "Someone")}${verifiedBadgeHtml(sender.isVerified)}</b> ${NOTIF_VERBS[n.type] || ""}</div>
      </a>
      <div class="notif-time">${timeAgo(n.createdAt)}</div>
      <div class="notif-follow-actions">
        <button type="button" class="btn btn-primary btn-pill" data-fr-accept>Accept</button>
        <button type="button" class="btn btn-secondary btn-pill" data-fr-decline>Decline</button>
      </div>
    </div>
  `;

  if (sender._id) {
    const acceptBtn = item.querySelector("[data-fr-accept]");
    const declineBtn = item.querySelector("[data-fr-decline]");
    acceptBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await apiFetch(`/users/${sender._id}/follow-request/accept`, { method: "POST" });
        showToast(`You accepted ${sender.name}'s request`);
        const actions = item.querySelector(".notif-follow-actions");
        if (actions) actions.innerHTML = `<span class="notif-follow-done">Following each other</span>`;
      } catch (err) {
        showToast(err.message || "Could not accept request");
      }
    });
    declineBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await apiFetch(`/users/${sender._id}/follow-request/reject`, { method: "POST" });
        item.remove();
      } catch (err) {
        showToast(err.message || "Could not decline request");
      }
    });
  }

  return item;
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
  if (document.body.dataset.likeBound) return; // sirf ek dafa bind karna hai (event delegation)
  document.body.dataset.likeBound = "true";

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".like-btn");
    if (!btn) return;

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
}

/* ---------- Follow button (real backend call) ---------- */
// Teen states: "not-following" (Follow), "requested" (Requested - private account,
// pending), "following" (Following). Requested/Following dono hover pe "Unfollow"/
// "Cancel" dikhate hain taake user ko pata chale click karne se kya hoga.
function setFollowButtonState(btn, state) {
  btn.dataset.followState = state;
  btn.classList.toggle("following", state === "following");
  btn.classList.toggle("requested", state === "requested");
  if (state === "following") {
    btn.textContent = "Following";
  } else if (state === "requested") {
    btn.textContent = "Requested";
  } else {
    btn.textContent = "Follow";
  }
}

function initFollowButtons() {
  if (document.body.dataset.followBound) return; // sirf ek dafa bind karna hai (event delegation)
  document.body.dataset.followBound = "true";

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-follow");
    if (!btn) return;

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
      setFollowButtonState(
        btn,
        result.following ? "following" : result.requested ? "requested" : "not-following"
      );
      if (result.requested) showToast("Follow request sent");
    } catch (err) {
      showToast(err.message);
    }
  });

  // Requested/Following button pe hover karne se "Cancel" / "Unfollow" dikhna chahiye
  document.addEventListener("mouseover", (e) => {
    const btn = e.target.closest(".btn-follow.following, .btn-follow.requested");
    if (!btn) return;
    btn.textContent = btn.classList.contains("requested") ? "Cancel" : "Unfollow";
  });
  document.addEventListener("mouseout", (e) => {
    const btn = e.target.closest(".btn-follow.following, .btn-follow.requested");
    if (!btn) return;
    btn.textContent = btn.classList.contains("requested") ? "Requested" : "Following";
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

/* ---------- Comments (view + add) ---------- */
function initComments() {
  if (document.body.dataset.commentsBound) return; // sirf ek dafa bind karna hai (event delegation)
  document.body.dataset.commentsBound = "true";

  document.addEventListener("click", async (e) => {
    // 1) Comment section open/close karna
    const toggleBtn = e.target.closest(".comment-toggle");
    if (toggleBtn) {
      const card = toggleBtn.closest(".post-card");
      const section = card.querySelector(".comments-section");
      const isOpen = section.classList.toggle("open");
      toggleBtn.classList.toggle("active", isOpen);

      if (isOpen) {
        const input = section.querySelector(".comment-input-wrap input");
        input.focus();

        const postId = card.dataset.postId;
        if (postId && !section.dataset.loaded) {
          section.dataset.loaded = "true";
          try {
            const comments = await apiFetch(`/posts/${postId}/comments`);
            const list = section.querySelector(".comment-list");
            list.innerHTML = "";
            renderCommentTree(comments, list);
          } catch (err) {
            console.warn("Comments load nahi huay:", err.message);
          }
        }
      }
      return;
    }

    // 2) Naya top-level comment submit karna (send button)
    const sendBtn = e.target.closest("[data-comment-send]");
    if (sendBtn) {
      const form = sendBtn.closest(".comment-form");
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      addComment(form, text);
      input.value = "";
      return;
    }

    // 3) "Reply" button - us comment ke andar chhota reply-form dikhana/chhupana
    const replyBtn = e.target.closest("[data-comment-reply-btn]");
    if (replyBtn) {
      const item = replyBtn.closest(".comment-item");
      const replyForm = item.querySelector("[data-comment-reply-form]");
      const isHidden = replyForm.style.display === "none" || !replyForm.style.display;
      replyForm.style.display = isHidden ? "flex" : "none";
      if (isHidden) replyForm.querySelector("input").focus();
      return;
    }

    // 4) Reply submit karna
    const replySendBtn = e.target.closest("[data-reply-send]");
    if (replySendBtn) {
      const item = replySendBtn.closest(".comment-item");
      const input = replySendBtn.closest("[data-comment-reply-form]").querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      addReply(item, text);
      input.value = "";
      return;
    }

    // 5) Comment ko like karna
    const likeBtn = e.target.closest("[data-comment-like-btn]");
    if (likeBtn) {
      const item = likeBtn.closest(".comment-item");
      const commentId = item.dataset.commentId;
      if (!commentId) return; // demo/fallback comment - backend id nahi hai

      if (!getToken()) {
        showToast("Please log in to like comments");
        window.location.href = "login.html";
        return;
      }

      try {
        const result = await apiFetch(`/comments/${commentId}/like`, { method: "POST" });
        likeBtn.classList.toggle("liked", result.liked);
        likeBtn.querySelector("[data-like-label]").textContent = result.liked ? "Liked" : "Like";
        const countEl = likeBtn.querySelector("[data-like-count]");
        countEl.textContent = result.likesCount > 0 ? ` · ${result.likesCount}` : "";
      } catch (err) {
        showToast(err.message);
      }
      return;
    }
  });

  // Enter key se top-level comment ya reply dono submit ho sakein
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const replyInput = e.target.closest("[data-comment-reply-form] input");
    if (replyInput) {
      const item = replyInput.closest(".comment-item");
      const text = replyInput.value.trim();
      if (!text) return;
      addReply(item, text);
      replyInput.value = "";
      return;
    }

    const input = e.target.closest(".comment-form input");
    if (!input) return;
    const form = input.closest(".comment-form");
    const text = input.value.trim();
    if (!text) return;
    addComment(form, text);
    input.value = "";
  });
}

// Flat comments array (har comment me parentComment field hoti hai) ko nested tree ki tarah render karta hai
function renderCommentTree(comments, container) {
  const byParent = {};
  comments.forEach((c) => {
    const key = c.parentComment ? String(c.parentComment) : "root";
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(c);
  });

  const renderLevel = (parentKey, targetContainer) => {
    (byParent[parentKey] || []).forEach((c) => {
      const item = buildCommentItem(c);
      targetContainer.appendChild(item);
      renderLevel(String(c._id), item.querySelector("[data-comment-replies]"));
    });
  };

  renderLevel("root", container);
}

function buildCommentItem(comment) {
  const item = document.createElement("div");
  item.className = "comment-item";
  item.dataset.commentId = comment._id;

  const author = comment.author || {};
  const currentUser = getCurrentUser();
  const alreadyLiked =
    currentUser && Array.isArray(comment.likes) && comment.likes.some((id) => String(id) === String(currentUser._id));
  const likesCount = comment.likesCount || 0;

  item.innerHTML = `
    <a href="profile.html?id=${author._id}">
      <img src="${author.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(author.name || "User")}" />
    </a>
    <div class="comment-body">
      <div class="comment-bubble">
        <a href="profile.html?id=${author._id}" style="text-decoration:none; color:inherit;">
          <div class="comment-author">${escapeHtml(author.name || "User")}${verifiedBadgeHtml(author.isVerified)}</div>
        </a>
        <div class="comment-text">${linkifyText(comment.text)}</div>
      </div>
      <div class="comment-meta">
        <span>${timeAgo(comment.createdAt)}</span>
        <button type="button" class="comment-like-btn${alreadyLiked ? " liked" : ""}" data-comment-like-btn>
          <span data-like-label>${alreadyLiked ? "Liked" : "Like"}</span><span data-like-count>${likesCount > 0 ? ` · ${likesCount}` : ""}</span>
        </button>
        <button type="button" data-comment-reply-btn>Reply</button>
      </div>
      <div class="comment-reply-form" data-comment-reply-form>
        <input type="text" placeholder="Write a reply..." />
        <button type="button" data-reply-send><span class="material-symbols-outlined">send</span></button>
      </div>
      <div class="comment-replies" data-comment-replies></div>
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
      <div class="comment-body">
        <div class="comment-bubble">
          <div class="comment-author">You</div>
          <div class="comment-text">${linkifyText(text)}</div>
        </div>
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

// Kisi comment ke reply-form se reply submit karna
async function addReply(parentItem, text) {
  const card = parentItem.closest(".post-card");
  const countEl = card.querySelector(".comment-count");
  const postId = card.dataset.postId;
  const parentId = parentItem.dataset.commentId;
  const repliesContainer = parentItem.querySelector("[data-comment-replies]");
  const replyForm = parentItem.querySelector("[data-comment-reply-form]");

  if (!postId || !parentId) return; // demo/fallback comment - reply karne layak nahi

  if (!getToken()) {
    showToast("Please log in to reply");
    window.location.href = "login.html";
    return;
  }

  try {
    const reply = await apiFetch(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text, parentComment: parentId }),
    });
    repliesContainer.appendChild(buildCommentItem(reply));
    replyForm.style.display = "none";
    if (countEl) countEl.textContent = (parseInt(countEl.textContent.replace(/,/g, ""), 10) || 0) + 1;
  } catch (err) {
    showToast(err.message);
  }
}

/* ---------- Global search (Home aur Explore, dono ki search box) ---------- */
function initFeedSearch() {
  if (document.body.dataset.searchBound) return; // sirf ek dafa bind karna hai (event delegation)
  document.body.dataset.searchBound = "true";

  let debounceTimer = null;

  document.addEventListener("input", (e) => {
    const input = e.target.closest("[data-global-search]");
    if (!input) return;

    const box = input.closest(".search-box");
    const resultsPanel = box ? box.querySelector("[data-search-results]") : null;
    if (!resultsPanel) return;

    const query = input.value.trim();
    clearTimeout(debounceTimer);

    if (!query) {
      resultsPanel.classList.remove("open");
      resultsPanel.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const { users, posts } = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
        renderSearchResults(resultsPanel, users, posts);
      } catch (err) {
        console.warn("Search failed:", err.message);
      }
    }, 300);
  });

  // Kahin aur click hone pe dropdown band ho jaye
  document.addEventListener("click", (e) => {
    if (e.target.closest(".search-box")) return;
    document.querySelectorAll(".search-results.open").forEach((panel) => panel.classList.remove("open"));
  });

  // Escape dabane se bhi band ho jaye
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".search-results.open").forEach((panel) => panel.classList.remove("open"));
  });
}

function renderSearchResults(panel, users, posts) {
  if (users.length === 0 && posts.length === 0) {
    panel.innerHTML = `<div class="search-results-empty">No results found</div>`;
    panel.classList.add("open");
    return;
  }

  let html = "";

  if (users.length > 0) {
    html += `<div class="search-results-section-label">People</div>`;
    html += users
      .map(
        (u) => `
      <a class="search-result-item" href="profile.html?id=${u._id}">
        <img src="${u.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(u.name)}" />
        <div>
          <div class="search-result-name">${escapeHtml(u.name)}${verifiedBadgeHtml(u.isVerified)}</div>
          ${u.bio ? `<div class="search-result-sub">${escapeHtml(u.bio)}</div>` : ""}
        </div>
      </a>
    `
      )
      .join("");
  }

  if (posts.length > 0) {
    html += `<div class="search-results-section-label">Posts</div>`;
    html += posts
      .map((p) => {
        const author = p.author || {};
        return `
      <a class="search-result-item" href="index.html?post=${p._id}">
        <img src="${author.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80"}" alt="${escapeHtml(author.name || "User")}" />
        <div>
          <div class="search-result-name">${escapeHtml(author.name || "User")}${verifiedBadgeHtml(author.isVerified)}</div>
          <div class="search-result-sub">${escapeHtml(p.text || "")}</div>
        </div>
      </a>
    `;
      })
      .join("");
  }

  panel.innerHTML = html;
  panel.classList.add("open");
}

// Search se ya link se kisi post pe seedha aaya ho to us post ko dhoondh kar highlight/scroll karna
function highlightLinkedPost() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("post");
  if (!postId) return;

  const tryHighlight = () => {
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (!card) return false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.style.outline = "2px solid var(--color-primary)";
    setTimeout(() => (card.style.outline = ""), 2000);
    return true;
  };

  // Feed load hone me thoda waqt lagta hai, is liye thodi der try karte hain
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (tryHighlight() || attempts > 20) clearInterval(interval);
  }, 200);
}

/* ---------- Settings: current user data load karna + save button real backend call ---------- */
function initSettingsToggles() {
  const saveBtn = document.querySelector("[data-settings-save]");
  if (!saveBtn) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  loadFollowRequestsList();
  loadBlockedAccountsList();
  initVerificationSection();

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

      // Privacy/notification toggles ko current saved values ke mutabiq set karna
      const toggleIds = {
        "set-private": user.isPrivate,
        "set-activity-status": user.showActivityStatus,
        "set-notify-likes": user.notifyOnLikes,
        "set-notify-comments": user.notifyOnComments,
        "set-notify-follows": user.notifyOnFollows,
        "set-notify-mentions": user.notifyOnMentions,
      };
      Object.entries(toggleIds).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.checked = value;
      });
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
    const isPrivate = document.getElementById("set-private")?.checked;
    const showActivityStatus = document.getElementById("set-activity-status")?.checked;
    const notifyOnLikes = document.getElementById("set-notify-likes")?.checked;
    const notifyOnComments = document.getElementById("set-notify-comments")?.checked;
    const notifyOnFollows = document.getElementById("set-notify-follows")?.checked;
    const notifyOnMentions = document.getElementById("set-notify-mentions")?.checked;

    try {
      saveBtn.disabled = true;

      if (selectedAvatarFile) {
        saveBtn.textContent = "Uploading photo...";
        uploadedAvatarUrl = await uploadFile(selectedAvatarFile);
        selectedAvatarFile = null;
      }

      saveBtn.textContent = "Save changes";
      const payload = {
        name,
        bio,
        location,
        isPrivate,
        showActivityStatus,
        notifyOnLikes,
        notifyOnComments,
        notifyOnFollows,
        notifyOnMentions,
      };
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
  const convItems = document.querySelector("[data-conv-items]");
  if (!convItems) return; // sirf messages.html pe chalega

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const conversations = await apiFetch("/conversations");
    const params = new URLSearchParams(window.location.search);
    const targetConvId = params.get("conv");

    if (conversations.length === 0) {
      convItems.innerHTML = `<p style="color:var(--color-text-muted); font-size:14px; padding:12px 16px;">No conversations yet. Visit someone's profile and tap the message icon to start one, ya naya group banao.</p>`;
      const chatBox = document.querySelector(".chat-messages");
      if (chatBox) chatBox.innerHTML = "";
      return;
    }

    // Mobile pe list hi pehle dikhti hai (jaise WhatsApp) - chat sirf tab khulti hai jab
    // koi conversation tap kare, ya seedha kisi ke profile se "message" bata kar aaya ho (?conv=)
    const isMobile = window.innerWidth <= 720;
    const shouldAutoOpen = Boolean(targetConvId) || !isMobile;

    renderConvList(conversations, targetConvId || conversations[0]._id, shouldAutoOpen);
  } catch (err) {
    console.warn("Conversations load nahi huien:", err.message);
  }

  initGroupModals(); // ek hi baar bind hote hain (guarded andar)
  initChatBackButton(); // ek hi baar bind hota hai (guarded andar)
}

const DEFAULT_GROUP_AVATAR =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=facearea&facepad=2&w=200&h=200&q=80";
const DEFAULT_USER_AVATAR =
  "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80";

function initChatBackButton() {
  const backBtn = document.querySelector("[data-chat-back-btn]");
  if (!backBtn || backBtn.dataset.bound) return;
  backBtn.dataset.bound = "true";
  backBtn.addEventListener("click", () => {
    document.querySelector(".messages-shell")?.classList.remove("mobile-chat-open");
    if (socket && currentConversationId) socket.emit("leaveConversation", currentConversationId);
    currentConversationId = null;
  });
}

function renderConvList(conversations, activeId, shouldAutoOpen = true) {
  const convItems = document.querySelector("[data-conv-items]");
  convItems.innerHTML = "";

  conversations.forEach((conv) => {
    const isGroup = conv.isGroup;
    const displayName = isGroup ? conv.groupName : conv.otherUser?.name || "User";
    const displayAvatar = isGroup ? conv.groupAvatar || DEFAULT_GROUP_AVATAR : conv.otherUser?.avatar || DEFAULT_USER_AVATAR;

    const item = document.createElement("div");
    item.className = "conv-item" + (conv._id === activeId ? " active" : "");
    item.dataset.convId = conv._id;
    item.dataset.muted = conv.isMuted ? "true" : "false";
    item.innerHTML = `
      <img src="${displayAvatar}" alt="${escapeHtml(displayName)}" />
      <div>
        <div class="conv-name">${escapeHtml(displayName)}${!isGroup ? verifiedBadgeHtml(conv.otherUser?.isVerified) : ""}${isGroup ? ` <span style="font-weight:400;color:var(--color-text-muted);font-size:12px;">(${conv.memberCount} members)</span>` : ""}${conv.isMuted ? ' <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:var(--color-text-muted);">notifications_off</span>' : ""}</div>
        <div class="conv-preview">${escapeHtml(conv.lastMessage || "Say hi 👋")}</div>
      </div>
      ${conv.hasUnread ? '<span class="conv-unread-dot"></span>' : ""}
    `;
    item.addEventListener("click", () => openConversation(conv));
    convItems.appendChild(item);
  });

  if (!shouldAutoOpen) return; // mobile pe list hi dikhi rehti hai jab tak tap na ho

  const activeConv = conversations.find((c) => c._id === activeId) || conversations[0];
  openConversation(activeConv);
}

// Ek chat bubble DOM node banata hai - group chats me "theirs" bubble ke upar sender ka naam bhi dikhata hai
function buildChatBubble(message, mine, isGroup) {
  // Call-log message (voice/video call ka record) - normal bubble se alag dikhta hai
  if (message.type === "call") {
    return buildCallLogBubble(message, mine);
  }

  const wrap = document.createElement("div");
  wrap.className = `chat-bubble-wrap ${mine ? "mine" : "theirs"}`;

  let html = "";
  if (!mine && isGroup) {
    html += `<div class="chat-bubble-sender">${escapeHtml(message.sender?.name || "Someone")}${verifiedBadgeHtml(message.sender?.isVerified)}</div>`;
  }
  html += `<div class="chat-bubble ${mine ? "mine" : "theirs"}"></div>`;
  wrap.innerHTML = html;
  wrap.querySelector(".chat-bubble").textContent = message.text; // XSS-safe (textContent)
  return wrap;
}

function buildCallLogBubble(message, mine) {
  const { callType, status, duration } = message.callInfo || {};
  const icon = callType === "video" ? "videocam" : "call";

  const labels = {
    completed: `${callType === "video" ? "Video" : "Voice"} call · ${formatCallDuration(duration)}`,
    missed: `Missed ${callType === "video" ? "video" : "voice"} call`,
    rejected: mine ? "Call declined" : "You declined this call",
    cancelled: "Call cancelled",
  };

  const wrap = document.createElement("div");
  wrap.className = "chat-call-log";
  wrap.innerHTML = `
    <span class="material-symbols-outlined${status === "missed" || status === "rejected" ? " missed" : ""}">${icon}</span>
    <span>${labels[status] || "Call"}</span>
  `;
  return wrap;
}

function formatCallDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

async function openConversation(conv) {
  const convId = conv._id;
  const isGroup = conv.isGroup;
  const otherUser = conv.otherUser || {};

  // Purani conversation ka socket room chhod kar nayi wali join karna
  // (taake "typing..." sirf sahi conversation ke liye receive ho)
  if (socket && currentConversationId && currentConversationId !== convId) {
    socket.emit("leaveConversation", currentConversationId);
  }
  currentConversationId = convId;
  currentConversationIsGroup = isGroup;
  currentConversationParticipants = conv.participants || [];
  currentConversationAdminId = isGroup ? conv.groupAdmin : null;
  currentConversationOtherUser = isGroup ? null : otherUser;
  currentConversationIsMuted = Boolean(conv.isMuted);
  if (socket) socket.emit("joinConversation", convId);

  // Mobile pe chat panel ko full-screen dikhana (list hide ho jati hai) - desktop pe
  // is class ka koi asar nahi padta, CSS sirf mobile media query ke andar isko istemal karta hai
  document.querySelector(".messages-shell")?.classList.add("mobile-chat-open");

  // Ye conversation khol li, backend + apna badge count dono clear kar do
  apiFetch(`/conversations/${convId}/read`, { method: "PATCH" }).catch(() => {});
  const convItem = document.querySelector(`.conv-item[data-conv-id="${convId}"]`);
  if (convItem) convItem.querySelector(".conv-unread-dot")?.remove();
  refreshUnreadBadges();

  document.querySelectorAll(".conv-item").forEach((c) => {
    c.classList.toggle("active", c.dataset.convId === convId);
  });

  const header = document.querySelector("[data-chat-header]");
  const headerSub = document.querySelector("[data-chat-header-sub]");
  const headerAvatar = document.querySelector("[data-chat-header-avatar]");
  const menuBtn = document.querySelector("[data-chat-menu-btn]");
  const callAudioBtn = document.querySelector("[data-chat-call-audio]");
  const callVideoBtn = document.querySelector("[data-chat-call-video]");

  if (header) {
    const displayName = isGroup ? conv.groupName : otherUser.name || "User";
    const displayAvatar = isGroup ? conv.groupAvatar || DEFAULT_GROUP_AVATAR : otherUser.avatar || DEFAULT_USER_AVATAR;

    header.querySelector(".conv-name").innerHTML = `${escapeHtml(displayName)}${!isGroup ? verifiedBadgeHtml(otherUser.isVerified) : ""}`;
    headerAvatar.src = displayAvatar;

    // 1-to-1 chat me normal call, group chat me group call - dono ke liye same buttons
    if (callAudioBtn && callVideoBtn) {
      callAudioBtn.style.display = "flex";
      callVideoBtn.style.display = "flex";
      if (isGroup) {
        callAudioBtn.onclick = () => startGroupCall(convId, "audio", displayName, conv.participants);
        callVideoBtn.onclick = () => startGroupCall(convId, "video", displayName, conv.participants);
      } else {
        callAudioBtn.onclick = () => startCall(otherUser._id, displayName, displayAvatar, "audio", convId);
        callVideoBtn.onclick = () => startCall(otherUser._id, displayName, displayAvatar, "video", convId);
      }
    }

    if (isGroup) {
      headerSub.textContent = `${conv.memberCount} members`;
      headerSub.style.display = "block";
      menuBtn.style.display = "flex";

      // Avatar pe click = group ki photo badalna (koi bhi member kar sakta hai)
      headerAvatar.onclick = () => document.querySelector("[data-group-avatar-input]").click();
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        toggleChatHeaderMenu(convId);
      };
    } else {
      headerSub.style.display = "none";
      menuBtn.style.display = "flex"; // 1-to-1 chat me bhi Mute/Block/Profile menu hota hai

      // 1-to-1 chat me avatar pe click = uski profile pe jana (jaisa pehle tha)
      headerAvatar.onclick = () => {
        if (otherUser._id) window.location.href = `profile.html?id=${otherUser._id}`;
      };
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        toggleChatHeaderMenu(convId);
      };
    }
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
        chatBox.appendChild(buildChatBubble(m, mine, isGroup));
      });
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    chatBox.innerHTML = "";
    console.warn("Messages load nahi huay:", err.message);
  }

  bindChatSend(convId, chatBox, isGroup);
  bindGroupAvatarUpload(convId);
}

function bindChatSend(convId, chatBox, isGroup) {
  const sendBtn = document.querySelector("[data-chat-send]");
  const chatInput = document.querySelector("[data-chat-input]");
  if (!sendBtn || !chatInput) return;

  // Purana listener hata kar naya laga dete hain taake har baar sahi convId use ho
  const freshSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(freshSendBtn, sendBtn);
  const freshChatInput = chatInput.cloneNode(true);
  chatInput.parentNode.replaceChild(freshChatInput, chatInput);

  let typingTimeout = null;
  freshChatInput.addEventListener("input", () => {
    if (!socket) return;
    socket.emit("typing", { conversationId: convId });
    clearTimeout(typingTimeout);
    // 2 second tak kuch na type ho to "typing..." khud band kar dena
    typingTimeout = setTimeout(() => socket.emit("stopTyping", { conversationId: convId }), 2000);
  });

  const send = async () => {
    const text = freshChatInput.value.trim();
    if (!text) return;

    clearTimeout(typingTimeout);
    if (socket) socket.emit("stopTyping", { conversationId: convId });

    try {
      const message = await apiFetch(`/conversations/${convId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (chatBox.querySelector("p")) chatBox.innerHTML = ""; // "Say hi" wala placeholder hata dena
      chatBox.appendChild(buildChatBubble(message, true, isGroup));
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

/* ---------- Group chat photo (avatar click se) ---------- */
function bindGroupAvatarUpload(convId) {
  const input = document.querySelector("[data-group-avatar-input]");
  if (!input) return;

  // Purana listener hata kar naya laga dete hain taake har baar sahi convId use ho
  const freshInput = input.cloneNode(true);
  input.parentNode.replaceChild(freshInput, input);

  freshInput.addEventListener("change", async () => {
    const file = freshInput.files[0];
    freshInput.value = "";
    if (!file) return;

    try {
      const groupAvatar = await uploadFile(file);
      await apiFetch(`/conversations/${convId}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ groupAvatar }),
      });
      document.querySelector("[data-chat-header-avatar]").src = groupAvatar;
      initMessages(); // sidebar me bhi nayi photo dikhe
    } catch (err) {
      showToast(err.message || "Group photo update nahi ho saki");
    }
  });
}

/* ---------- Chat header ka 3-dot menu (admin aur member ke alag options) ---------- */
function toggleChatHeaderMenu(convId) {
  const dropdown = document.querySelector("[data-chat-header-dropdown]");
  const isOpen = dropdown.style.display === "block";
  if (isOpen) {
    closeChatHeaderMenu();
    return;
  }

  const currentUser = getCurrentUser();
  let items;

  if (currentConversationIsGroup) {
    const isAdmin = currentUser && String(currentConversationAdminId) === String(currentUser._id);
    items = isAdmin
      ? [
          { icon: "info", label: "Group Info", action: () => openGroupInfoModal(convId) },
          { icon: "person_add", label: "Add Members", action: () => openGroupModal("add", convId) },
          { icon: currentConversationIsMuted ? "notifications" : "notifications_off", label: currentConversationIsMuted ? "Unmute Notifications" : "Mute Notifications", action: () => handleToggleMuteConversation(convId), divider: true },
          { icon: "logout", label: "Leave Group", action: () => promptLeaveGroup(convId) },
          { icon: "delete", label: "Delete Group", action: () => promptDeleteGroup(convId), danger: true },
        ]
      : [
          { icon: "info", label: "Group Info", action: () => openGroupInfoModal(convId) },
          { icon: "person_add", label: "Add Members", action: () => openGroupModal("add", convId) },
          { icon: currentConversationIsMuted ? "notifications" : "notifications_off", label: currentConversationIsMuted ? "Unmute Notifications" : "Mute Notifications", action: () => handleToggleMuteConversation(convId), divider: true },
          { icon: "logout", label: "Leave Group", action: () => promptLeaveGroup(convId), danger: true },
        ];
  } else {
    const otherUser = currentConversationOtherUser || {};
    items = [
      { icon: "person", label: "View Profile", action: () => (window.location.href = `profile.html?id=${otherUser._id}`) },
      { icon: currentConversationIsMuted ? "notifications" : "notifications_off", label: currentConversationIsMuted ? "Unmute Notifications" : "Mute Notifications", action: () => handleToggleMuteConversation(convId), divider: true },
      { icon: "block", label: "Block User", action: () => handleToggleBlockUser(otherUser._id, otherUser.name, false), danger: true },
    ];
  }

  dropdown.innerHTML = "";
  items.forEach((item) => {
    if (item.divider) {
      const hr = document.createElement("div");
      hr.className = "chat-header-dropdown-divider";
      dropdown.appendChild(hr);
    }
    const row = document.createElement("div");
    row.className = "chat-header-dropdown-item" + (item.danger ? " danger" : "");
    row.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span><span>${item.label}</span>`;
    row.addEventListener("click", () => {
      closeChatHeaderMenu();
      item.action();
    });
    dropdown.appendChild(row);
  });

  dropdown.style.display = "block";

  // Bahar kahin bhi click ho to menu band ho jaye
  setTimeout(() => document.addEventListener("click", closeChatHeaderMenu, { once: true }), 0);
}

function closeChatHeaderMenu() {
  const dropdown = document.querySelector("[data-chat-header-dropdown]");
  if (dropdown) dropdown.style.display = "none";
}

function promptLeaveGroup(convId) {
  if (!confirm("Kya tum is group ko chorna chahte ho?")) return;
  const currentUser = getCurrentUser();
  apiFetch(`/conversations/${convId}/members/${currentUser._id}`, { method: "DELETE" })
    .then(() => {
      window.location.href = "messages.html";
    })
    .catch((err) => showToast(err.message || "Group chor nahi sake"));
}

function promptDeleteGroup(convId) {
  if (!confirm("Ye group hamesha ke liye delete ho jayega, sab members ke liye. Confirm karo?")) return;
  apiFetch(`/conversations/${convId}/group`, { method: "DELETE" })
    .then(() => {
      window.location.href = "messages.html";
    })
    .catch((err) => showToast(err.message || "Group delete nahi ho saka"));
}

/* =========================================================
   GROUP CHATS - create group, add members, group info panel
   ========================================================= */
let groupModalMode = "create"; // "create" ya "add"
let groupModalTargetConvId = null; // "add" mode me kis conversation me add karna hai
let groupModalSelectedUsers = []; // [{_id, name, avatar}]
let groupModalSearchTimeout = null;

function initGroupModals() {
  const modal = document.querySelector("[data-group-modal]");
  if (!modal || modal.dataset.bound) return; // ek hi baar bind karna hai
  modal.dataset.bound = "true";

  document.querySelector("[data-new-group-btn]").addEventListener("click", () => openGroupModal("create"));
  document.querySelector("[data-group-modal-close]").addEventListener("click", closeGroupModal);

  const searchInput = document.querySelector("[data-group-modal-search]");
  searchInput.addEventListener("input", () => {
    clearTimeout(groupModalSearchTimeout);
    const q = searchInput.value.trim();
    if (!q) {
      document.querySelector("[data-group-modal-results]").innerHTML = "";
      return;
    }
    groupModalSearchTimeout = setTimeout(() => searchPeopleForGroup(q), 300); // typing rukne ka thoda intezar
  });

  document.querySelector("[data-group-modal-submit]").addEventListener("click", submitGroupModal);

  // ---- Group info modal ----
  document.querySelector("[data-group-info-close]").addEventListener("click", closeGroupInfoModal);
  document.querySelector("[data-group-info-rename-save]").addEventListener("click", saveGroupRename);
  document.querySelector("[data-group-info-add-btn]").addEventListener("click", () => {
    closeGroupInfoModal();
    openGroupModal("add", currentConversationId);
  });
  document.querySelector("[data-group-info-leave-btn]").addEventListener("click", leaveCurrentGroup);
}

function openGroupModal(mode, targetConvId) {
  groupModalMode = mode;
  groupModalTargetConvId = targetConvId || null;
  groupModalSelectedUsers = [];

  const modal = document.querySelector("[data-group-modal]");
  const nameInput = document.querySelector("[data-group-modal-name]");
  const title = document.querySelector("[data-group-modal-title]");
  const submitBtn = document.querySelector("[data-group-modal-submit]");

  if (mode === "create") {
    title.textContent = "New Group";
    nameInput.style.display = "block";
    nameInput.value = "";
    submitBtn.textContent = "Create Group";
  } else {
    title.textContent = "Add Members";
    nameInput.style.display = "none"; // add-members mode me group ka naam badalna nahi
    submitBtn.textContent = "Add Members";
  }

  document.querySelector("[data-group-modal-search]").value = "";
  document.querySelector("[data-group-modal-results]").innerHTML = "";
  renderGroupModalSelectedChips();

  modal.style.display = "flex";
}

function closeGroupModal() {
  document.querySelector("[data-group-modal]").style.display = "none";
}

async function searchPeopleForGroup(q) {
  const resultsBox = document.querySelector("[data-group-modal-results]");
  try {
    const { users } = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
    const currentUser = getCurrentUser();
    const alreadyInGroup =
      groupModalMode === "add" ? currentConversationParticipants.map((p) => String(p._id)) : [];

    resultsBox.innerHTML = "";
    users
      .filter((u) => currentUser && String(u._id) !== String(currentUser._id))
      .forEach((u) => {
        const isSelected = groupModalSelectedUsers.some((s) => s._id === u._id);
        const isAlreadyMember = alreadyInGroup.includes(String(u._id));
        const item = document.createElement("div");
        item.className = "group-modal-result-item" + (isAlreadyMember ? " added" : "");
        item.innerHTML = `
          <img src="${u.avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(u.name)}" />
          <span>${escapeHtml(u.name)}</span>
          ${isAlreadyMember ? '<span style="margin-left:auto;font-size:11px;color:var(--color-text-muted);">Already in group</span>' : ""}
        `;
        if (!isAlreadyMember && !isSelected) {
          item.addEventListener("click", () => {
            groupModalSelectedUsers.push({ _id: u._id, name: u.name, avatar: u.avatar });
            renderGroupModalSelectedChips();
            item.remove();
          });
        }
        resultsBox.appendChild(item);
      });
  } catch (err) {
    console.warn("People search fail:", err.message);
  }
}

function renderGroupModalSelectedChips() {
  const box = document.querySelector("[data-group-modal-selected]");
  box.innerHTML = "";
  groupModalSelectedUsers.forEach((u) => {
    const chip = document.createElement("div");
    chip.className = "group-modal-chip";
    chip.innerHTML = `<span>${escapeHtml(u.name)}</span><button type="button"><span class="material-symbols-outlined" style="font-size:14px;">close</span></button>`;
    chip.querySelector("button").addEventListener("click", () => {
      groupModalSelectedUsers = groupModalSelectedUsers.filter((s) => s._id !== u._id);
      renderGroupModalSelectedChips();
    });
    box.appendChild(chip);
  });
}

async function submitGroupModal() {
  const submitBtn = document.querySelector("[data-group-modal-submit]");

  if (groupModalMode === "create") {
    const name = document.querySelector("[data-group-modal-name]").value.trim();
    if (!name) return showToast("Group ka naam likho");
    if (groupModalSelectedUsers.length < 2) return showToast("Kam se kam 2 aur log select karo");

    submitBtn.disabled = true;
    try {
      const conv = await apiFetch("/conversations/group", {
        method: "POST",
        body: JSON.stringify({ name, userIds: groupModalSelectedUsers.map((u) => u._id) }),
      });
      closeGroupModal();
      await initMessages();
      // Naya group hi khula rahe
      const item = document.querySelector(`.conv-item[data-conv-id="${conv._id}"]`);
      if (item) item.click();
    } catch (err) {
      showToast(err.message || "Group nahi ban saka");
    } finally {
      submitBtn.disabled = false;
    }
  } else {
    if (groupModalSelectedUsers.length === 0) return showToast("Kam se kam ek banda select karo");

    submitBtn.disabled = true;
    try {
      await apiFetch(`/conversations/${groupModalTargetConvId}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds: groupModalSelectedUsers.map((u) => u._id) }),
      });
      closeGroupModal();
      await initMessages();
    } catch (err) {
      showToast(err.message || "Members add nahi ho sake");
    } finally {
      submitBtn.disabled = false;
    }
  }
}

/* ---------- Group info panel ---------- */
async function openGroupInfoModal(convId) {
  const modal = document.querySelector("[data-group-info-modal]");
  const nameInput = document.querySelector("[data-group-info-name-input]");
  const saveBtn = document.querySelector("[data-group-info-rename-save]");
  const membersBox = document.querySelector("[data-group-info-members]");

  membersBox.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Loading...</p>`;
  modal.style.display = "flex";
  modal.dataset.convId = convId;

  try {
    const conv = await apiFetch(`/conversations/${convId}`);
    const currentUser = getCurrentUser();
    const isAdmin = currentUser && String(conv.groupAdmin) === String(currentUser._id);

    nameInput.value = conv.groupName;
    nameInput.disabled = !isAdmin;
    saveBtn.style.display = isAdmin ? "block" : "none";

    membersBox.innerHTML = "";
    conv.participants.forEach((p) => {
      const isThisAdmin = String(p._id) === String(conv.groupAdmin);
      const row = document.createElement("div");
      row.className = "group-info-member-item";
      row.innerHTML = `
        <img src="${p.avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(p.name)}" />
        <span class="member-name">${escapeHtml(p.name)}${verifiedBadgeHtml(p.isVerified)}</span>
        ${isThisAdmin ? '<span class="member-admin-tag">Admin</span>' : ""}
        ${isAdmin && !isThisAdmin ? '<button type="button" class="member-remove-btn" title="Remove"><span class="material-symbols-outlined">person_remove</span></button>' : ""}
      `;
      const removeBtn = row.querySelector(".member-remove-btn");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => removeGroupMember(convId, p._id, p.name));
      }
      membersBox.appendChild(row);
    });
  } catch (err) {
    membersBox.innerHTML = `<p style="color:var(--color-error); font-size:13px;">${escapeHtml(err.message)}</p>`;
  }
}

function closeGroupInfoModal() {
  document.querySelector("[data-group-info-modal]").style.display = "none";
}

async function saveGroupRename() {
  const modal = document.querySelector("[data-group-info-modal]");
  const convId = modal.dataset.convId;
  const newName = document.querySelector("[data-group-info-name-input]").value.trim();
  if (!newName) return showToast("Group ka naam khali nahi ho sakta");

  try {
    await apiFetch(`/conversations/${convId}/group`, {
      method: "PATCH",
      body: JSON.stringify({ groupName: newName }),
    });
    showToast("Group ka naam badal gaya");
    initMessages();
  } catch (err) {
    showToast(err.message || "Rename nahi ho saka");
  }
}

async function removeGroupMember(convId, userId, userName) {
  if (!confirm(`${userName} ko group se nikaal dein?`)) return;
  try {
    await apiFetch(`/conversations/${convId}/members/${userId}`, { method: "DELETE" });
    openGroupInfoModal(convId); // list refresh
    initMessages();
  } catch (err) {
    showToast(err.message || "Remove nahi ho saka");
  }
}

async function leaveCurrentGroup() {
  const modal = document.querySelector("[data-group-info-modal]");
  const convId = modal.dataset.convId;
  const currentUser = getCurrentUser();
  if (!confirm("Kya tum is group ko chorna chahte ho?")) return;

  try {
    await apiFetch(`/conversations/${convId}/members/${currentUser._id}`, { method: "DELETE" });
    closeGroupInfoModal();
    window.location.href = "messages.html";
  } catch (err) {
    showToast(err.message || "Group chor nahi sake");
  }
}

/* ---------- Post composer ("What's on your mind?") ---------- */
/* ---------- Emoji picker (composer ke "Add emoji" button) ---------- */
const EMOJI_LIST = [
  "😀", "😂", "🥰", "😎", "😊", "😍", "🤔", "😢", "😭", "😡",
  "👍", "👎", "🙌", "👏", "🙏", "💪", "🤝", "✌️", "🤞", "👋",
  "❤️", "🔥", "✨", "🎉", "🎊", "💯", "⭐", "🌟", "💡", "🚀",
  "😅", "😴", "🥳", "😇", "🤩", "😜", "🤗", "😬", "🙄", "😏",
  "☕", "🍕", "🎮", "📸", "🎵", "🏆", "🌈", "☀️", "🌙", "⚡",
];

function initEmojiPicker(textarea) {
  const btn = document.querySelector("[data-emoji-btn]");
  const picker = document.querySelector("[data-emoji-picker]");
  if (!btn || !picker || !textarea) return;
  if (btn.dataset.bound) return; // dobara init na ho
  btn.dataset.bound = "true";

  // Emoji grid ek hi baar bana lete hain
  picker.innerHTML = EMOJI_LIST.map((emoji) => `<button type="button">${emoji}</button>`).join("");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    picker.classList.toggle("open");
  });

  picker.addEventListener("click", (e) => {
    const emojiBtn = e.target.closest("button");
    if (!emojiBtn) return;

    // Cursor jahan tha wahin emoji insert karna (sirf end me chipka mat dena)
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const emoji = emojiBtn.textContent;
    textarea.value = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);

    const newPos = start + emoji.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);

    picker.classList.remove("open");
  });

  // Kahin aur click hone pe picker band ho jaye
  document.addEventListener("click", (e) => {
    if (!picker.classList.contains("open")) return;
    if (!e.target.closest(".emoji-picker-wrap")) {
      picker.classList.remove("open");
    }
  });
}

/* ---------- Link picker (composer ke "Add link" button) ---------- */
function initLinkPicker(textarea) {
  const btn = document.querySelector("[data-link-btn]");
  const picker = document.querySelector("[data-link-picker]");
  const input = document.querySelector("[data-link-input]");
  const addBtn = document.querySelector("[data-link-add]");
  if (!btn || !picker || !input || !addBtn || !textarea) return;
  if (btn.dataset.bound) return; // dobara init na ho
  btn.dataset.bound = "true";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    picker.classList.toggle("open");
    if (picker.classList.contains("open")) input.focus();
  });

  const insertLink = () => {
    let url = input.value.trim();
    if (!url) return;

    // Agar http:// ya https:// nahi likha to khud https:// laga dena
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const spacer = start > 0 && !/\s$/.test(textarea.value.slice(0, start)) ? " " : "";
    textarea.value = textarea.value.slice(0, start) + spacer + url + " " + textarea.value.slice(end);

    const newPos = start + spacer.length + url.length + 1;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);

    input.value = "";
    picker.classList.remove("open");
  };

  addBtn.addEventListener("click", insertLink);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      insertLink();
    }
  });

  // Kahin aur click hone pe picker band ho jaye
  document.addEventListener("click", (e) => {
    if (!picker.classList.contains("open")) return;
    if (!e.target.closest(".link-picker-wrap")) {
      picker.classList.remove("open");
    }
  });
}

function initComposer() {
  const postBtn = document.querySelector("[data-composer-post]");
  if (!postBtn) return;

  const textarea = document.querySelector("[data-composer-input]");
  initEmojiPicker(textarea);
  initLinkPicker(textarea);

  const imageBtn = document.querySelector("[data-composer-image-btn]");
  const fileInput = document.querySelector("[data-composer-file-input]");
  const videoBtn = document.querySelector("[data-composer-video-btn]");
  const videoInput = document.querySelector("[data-composer-video-input]");
  const previewBox = document.querySelector("[data-composer-preview]");

  let selectedImages = []; // File objects, max 4
  let selectedVideo = null; // ek File ya null

  function renderPreview() {
    previewBox.innerHTML = "";

    if (selectedVideo) {
      const thumb = document.createElement("div");
      thumb.className = "composer-thumb";
      thumb.innerHTML = `<video src="${URL.createObjectURL(selectedVideo)}" muted></video><button type="button">&times;</button>`;
      thumb.querySelector("button").addEventListener("click", () => {
        selectedVideo = null;
        videoInput.value = "";
        renderPreview();
      });
      previewBox.appendChild(thumb);
    }

    selectedImages.forEach((file, index) => {
      const thumb = document.createElement("div");
      thumb.className = "composer-thumb";
      thumb.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected image" /><button type="button">&times;</button>`;
      thumb.querySelector("button").addEventListener("click", () => {
        selectedImages.splice(index, 1);
        renderPreview();
      });
      previewBox.appendChild(thumb);
    });

    previewBox.classList.toggle("open", selectedImages.length > 0 || !!selectedVideo);
  }

  if (imageBtn && fileInput) {
    imageBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = "";
      if (files.length === 0) return;

      const invalid = files.find((f) => !f.type.startsWith("image/"));
      if (invalid) {
        showToast("Please select image files only");
        return;
      }
      const tooBig = files.find((f) => f.size > 5 * 1024 * 1024);
      if (tooBig) {
        showToast("Each image must be under 5MB");
        return;
      }

      // Video aur images ek sath nahi ho saktay - naya image select karne se video hat jata hai
      selectedVideo = null;
      videoInput.value = "";

      selectedImages = [...selectedImages, ...files].slice(0, 4);
      if (selectedImages.length + files.length > 4) {
        showToast("Maximum 4 images per post");
      }
      renderPreview();
    });
  }

  if (videoBtn && videoInput) {
    videoBtn.addEventListener("click", () => videoInput.click());

    videoInput.addEventListener("change", () => {
      const file = videoInput.files[0];
      videoInput.value = "";
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        showToast("Please select a video file");
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        showToast("Video must be under 30MB");
        return;
      }

      // Image aur video ek sath nahi ho saktay
      selectedImages = [];
      if (fileInput) fileInput.value = "";
      selectedVideo = file;
      renderPreview();
    });
  }

  postBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text && selectedImages.length === 0 && !selectedVideo) {
      showToast("Write something, or add an image/video first");
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
      const payload = { text };

      if (selectedVideo) {
        postBtn.textContent = "Uploading video...";
        payload.video = await uploadFile(selectedVideo);
      } else if (selectedImages.length > 0) {
        postBtn.textContent = `Uploading 0/${selectedImages.length}...`;
        const urls = [];
        for (let i = 0; i < selectedImages.length; i++) {
          urls.push(await uploadFile(selectedImages[i]));
          postBtn.textContent = `Uploading ${i + 1}/${selectedImages.length}...`;
        }
        payload.images = urls;
      }

      postBtn.textContent = "Post";
      const post = await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const feed = document.querySelector("[data-feed]");
      feed.prepend(buildPostCard(post));

      textarea.value = "";
      selectedImages = [];
      selectedVideo = null;
      renderPreview();
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
      else if (actionBtn.dataset.action === "insights") openPostInsights(postId);
      else if (actionBtn.dataset.action === "report") showToast("Post reported. Thanks for letting us know.");
      else if (actionBtn.dataset.action === "mute-user") {
        await handleToggleMuteUser(actionBtn.dataset.authorId, false);
        card?.remove(); // mute hote hi feed se turant hata dena
      } else if (actionBtn.dataset.action === "block-user") {
        await handleToggleBlockUser(actionBtn.dataset.authorId, actionBtn.dataset.authorName, false);
        document
          .querySelectorAll(`.post-card [data-author-id="${actionBtn.dataset.authorId}"]`)
          .forEach((el) => el.closest(".post-card")?.remove()); // block hote hi is author ki sab posts feed se hata dena
      }
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

function registerPostShare(postId) {
  if (!postId) return;
  apiFetch(`/posts/${postId}/share`, { method: "POST" }).catch(() => {});
}

/* ---------- Post views (Reach/Impressions) - IntersectionObserver se, ek baar per session ---------- */
const viewedPostIds = new Set();
let sharedPostViewObserver = null;

function getPostViewObserver() {
  if (sharedPostViewObserver) return sharedPostViewObserver;
  sharedPostViewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const postId = entry.target.dataset.postId;
        if (postId && !viewedPostIds.has(postId)) {
          viewedPostIds.add(postId);
          apiFetch(`/posts/${postId}/view`, { method: "POST" }).catch(() => {});
        }
        sharedPostViewObserver.unobserve(entry.target); // ek baar count ho gaya to dobara zaroorat nahi
      });
    },
    { threshold: [0.5] } // aadhi se zyada post screen pe aaye tab hi "dekha gaya" mana jaye
  );
  return sharedPostViewObserver;
}

/* ---------- Post Insights (Facebook Insights jaisa panel) ---------- */
function injectPostInsightsModal() {
  if (document.querySelector("[data-post-insights-modal]")) return; // ek hi baar

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="post-insights-modal" data-post-insights-modal style="display:none;">
      <div class="post-insights-box">
        <div class="post-insights-header">
          <h3>Post Insights</h3>
          <button type="button" data-post-insights-close><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="post-insights-body" data-post-insights-body></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  document.querySelector("[data-post-insights-close]").addEventListener("click", closePostInsights);
  document.querySelector("[data-post-insights-modal]").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closePostInsights();
  });
}

async function openPostInsights(postId) {
  const modal = document.querySelector("[data-post-insights-modal]");
  const body = document.querySelector("[data-post-insights-body]");
  if (!modal || !body) return;

  modal.style.display = "flex";
  body.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); padding:30px 0;">Loading...</p>`;

  try {
    const data = await apiFetch(`/posts/${postId}/analytics`);
    const maxViews = Math.max(1, ...data.viewsOverTime.map((d) => d.count));

    body.innerHTML = `
      <div class="insights-stats-grid">
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">visibility</span>
          <div class="insights-stat-value">${data.reach}</div>
          <div class="insights-stat-label">Reach</div>
        </div>
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">bar_chart</span>
          <div class="insights-stat-value">${data.impressions}</div>
          <div class="insights-stat-label">Impressions</div>
        </div>
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">favorite</span>
          <div class="insights-stat-value">${data.likesCount}</div>
          <div class="insights-stat-label">Likes</div>
        </div>
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">chat_bubble</span>
          <div class="insights-stat-value">${data.commentsCount}</div>
          <div class="insights-stat-label">Comments</div>
        </div>
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">share</span>
          <div class="insights-stat-value">${data.sharesCount}</div>
          <div class="insights-stat-label">Shares</div>
        </div>
        <div class="insights-stat-card">
          <span class="material-symbols-outlined">trending_up</span>
          <div class="insights-stat-value">${data.engagementRate}%</div>
          <div class="insights-stat-label">Engagement rate</div>
        </div>
      </div>

      <div class="insights-chart-section">
        <h4>Views - last 7 days</h4>
        <div class="insights-chart">
          ${data.viewsOverTime
            .map(
              (d) => `
            <div class="insights-bar-col">
              <div class="insights-bar-value">${d.count}</div>
              <div class="insights-bar" style="height:${Math.max(4, (d.count / maxViews) * 90)}px;"></div>
              <div class="insights-bar-label">${d.label}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      ${
        data.likedBy.length > 0
          ? `
        <div class="insights-liked-section">
          <h4>Liked by</h4>
          <div class="insights-liked-avatars">
            ${data.likedBy
              .map(
                (u) => `
              <a href="profile.html?id=${u._id}" title="${escapeHtml(u.name)}">
                <img src="${u.avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(u.name)}" />
              </a>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    `;
  } catch (err) {
    body.innerHTML = `<p style="text-align:center; color:var(--color-error); padding:30px 0;">${escapeHtml(err.message)}</p>`;
  }
}

function closePostInsights() {
  const modal = document.querySelector("[data-post-insights-modal]");
  if (modal) modal.style.display = "none";
}

/* ---------- Saved posts (bookmark) - ab server pe (User.savedPosts) save hote hain, is
   liye doosre device pe login karne pe bhi wahi saved posts dikhte hain. Har page load pe
   ek dafa IDs cache kar lete hain taake har post-card render pe naya request na jaye. ---------- */
let savedPostIdsCache = null;

async function ensureSavedPostIdsLoaded() {
  if (!getToken()) {
    savedPostIdsCache = [];
    return savedPostIdsCache;
  }
  if (savedPostIdsCache) return savedPostIdsCache; // is session me pehle hi la chuke hain

  try {
    savedPostIdsCache = await apiFetch("/posts/saved/ids");
  } catch (err) {
    console.warn("Saved post ids load nahi ho sakin:", err.message);
    savedPostIdsCache = [];
  }
  return savedPostIdsCache;
}

function getSavedPostIds() {
  return savedPostIdsCache || [];
}

async function toggleSavedPost(postId) {
  const result = await apiFetch(`/posts/${postId}/save`, { method: "POST" });
  // Local cache ko turant naye state ke mutabiq update karna - taake baqi khuli cards
  // (feed, profile, explore wagera) bhi bina refresh ke sahi state dikhayein
  if (!savedPostIdsCache) savedPostIdsCache = [];
  if (result.saved) {
    if (!savedPostIdsCache.includes(postId)) savedPostIdsCache.push(postId);
  } else {
    savedPostIdsCache = savedPostIdsCache.filter((id) => id !== postId);
  }
  return result.saved;
}

/* ---------- Saved posts page (saved.html) ---------- */
async function loadSavedPosts() {
  const feed = document.querySelector("[data-saved-feed]");
  if (!feed) return; // sirf saved.html pe chalega

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const [posts] = await Promise.all([apiFetch("/posts/saved/me"), ensureSavedPostIdsLoaded()]);
    feed.innerHTML = "";
    if (posts.length === 0) {
      feed.innerHTML = `<p style="color:var(--color-text-muted); padding:32px 0; text-align:center;">No saved posts yet. Tap the bookmark icon on any post to save it here.</p>`;
      return;
    }
    posts.forEach((post) => feed.appendChild(buildPostCard(post)));
  } catch (err) {
    console.warn("Saved posts load nahi huay:", err.message);
    feed.innerHTML = `<p style="color:var(--color-error); padding:32px 0; text-align:center;">Saved posts load nahi ho sakin: ${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- Hashtag page (hashtag.html?tag=coding) ---------- */
async function loadHashtagPage() {
  const feed = document.querySelector("[data-hashtag-feed]");
  if (!feed) return; // sirf hashtag.html pe chalega

  const params = new URLSearchParams(window.location.search);
  const tag = (params.get("tag") || "").trim();

  const titleEl = document.querySelector("[data-hashtag-title]");
  if (titleEl) titleEl.textContent = tag ? `#${tag}` : "Hashtag";

  if (!tag) {
    feed.innerHTML = `<p style="color:var(--color-text-muted); padding:32px 0; text-align:center;">No hashtag specified.</p>`;
    return;
  }

  try {
    const [posts] = await Promise.all([
      apiFetch(`/posts?hashtag=${encodeURIComponent(tag)}`),
      ensureSavedPostIdsLoaded(),
    ]);
    feed.innerHTML = "";
    if (posts.length === 0) {
      feed.innerHTML = `<p style="color:var(--color-text-muted); padding:32px 0; text-align:center;">No posts found for #${escapeHtml(tag)} yet.</p>`;
      return;
    }
    posts.forEach((post) => feed.appendChild(buildPostCard(post)));
  } catch (err) {
    console.warn("Hashtag posts load nahi huay:", err.message);
  }
}

/* ---------- Share aur Save buttons ---------- */
function initShareSaveButtons() {
  if (document.body.dataset.shareSaveBound) return; // sirf ek dafa bind karna hai (event delegation)
  document.body.dataset.shareSaveBound = "true";

  document.addEventListener("click", async (e) => {
    const shareBtn = e.target.closest("[data-share-btn]");
    if (shareBtn) {
      const card = shareBtn.closest("[data-post-id]");
      const postId = card ? card.dataset.postId : null;
      if (!postId) return;

      const basePath = window.location.pathname.replace(/[^/]*$/, "");
      const url = `${window.location.origin}${basePath}index.html?post=${postId}`;

      if (navigator.share) {
        try {
          await navigator.share({ title: "Zovari post", url });
          registerPostShare(postId); // share sheet se successfully share hua tabhi count karna
        } catch (err) {
          // User ne share sheet cancel kar di - count nahi karna
        }
      } else {
        navigator.clipboard.writeText(url).then(
          () => {
            showToast("Link copied");
            registerPostShare(postId); // link copy karna bhi ek share maana jata hai
          },
          () => showToast("Could not copy link")
        );
      }
      return;
    }

    const saveBtn = e.target.closest("[data-save-btn]");
    if (saveBtn) {
      const card = saveBtn.closest("[data-post-id]");
      const postId = card ? card.dataset.postId : null;
      if (!postId) return;

      if (!getToken()) {
        showToast("Please log in to save posts");
        window.location.href = "login.html";
        return;
      }

      try {
        const nowSaved = await toggleSavedPost(postId);
        saveBtn.classList.toggle("saved", nowSaved);
        const icon = saveBtn.querySelector(".material-symbols-outlined");
        if (icon) icon.classList.toggle("icon-filled", nowSaved);
        showToast(nowSaved ? "Post saved" : "Post removed from saved");
      } catch (err) {
        showToast(err.message || "Could not update saved post");
      }
    }
  });
}

// Post ka media render karta hai - video, ya (naye) multiple images ka grid, ya (purane) ek single image
function renderPostMedia(post) {
  if (post.video) {
    return `<video class="post-video" src="${post.video}" controls></video>`;
  }

  const images = Array.isArray(post.images) && post.images.length > 0 ? post.images : post.image ? [post.image] : [];
  if (images.length === 0) return "";

  if (images.length === 1) {
    return `<img class="post-media" src="${images[0]}" alt="Post image" />`;
  }

  const imgs = images
    .slice(0, 4)
    .map((src) => `<img src="${src}" alt="Post image" />`)
    .join("");
  return `<div class="post-media-grid count-${images.length}">${imgs}</div>`;
}

function buildPostCard(post) {
  const author = post.author || {};
  const currentUser = getCurrentUser();
  const alreadyLiked =
    currentUser && Array.isArray(post.likes) && post.likes.some((id) => String(id) === String(currentUser._id));
  const isOwnPost = currentUser && author._id && String(currentUser._id) === String(author._id);
  const isSaved = getSavedPostIds().some((id) => String(id) === String(post._id));

  const menuItemsHtml = isOwnPost
    ? `
      <button class="post-menu-item" data-action="insights">
        <span class="material-symbols-outlined">bar_chart</span> View insights
      </button>
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
      <button class="post-menu-item" data-action="mute-user" data-author-id="${author._id}" data-author-name="${escapeHtml(author.name || "User")}">
        <span class="material-symbols-outlined">volume_off</span> Mute ${escapeHtml(author.name || "user")}
      </button>
      <button class="post-menu-item danger" data-action="block-user" data-author-id="${author._id}" data-author-name="${escapeHtml(author.name || "User")}">
        <span class="material-symbols-outlined">block</span> Block ${escapeHtml(author.name || "user")}
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
          <div class="post-author-name">${escapeHtml(author.name || "User")}${verifiedBadgeHtml(author.isVerified)}</div>
        </a>
        <div class="post-author-meta">${timeAgo(post.createdAt)}</div>
      </div>
      <button class="post-more" data-post-menu-toggle><span class="material-symbols-outlined">more_horiz</span></button>
      <div class="post-menu" data-post-menu>${menuItemsHtml}</div>
    </div>
    ${post.text ? `<p class="post-text">${linkifyText(post.text)}</p>` : ""}
    ${renderPostMedia(post)}
    <div class="post-footer">
      <div class="post-stats">
        <button class="post-stat-btn like-btn${alreadyLiked ? " liked" : ""}" type="button">
          <span class="material-symbols-outlined">favorite</span>
          <span class="like-count">${(post.likesCount ?? (post.likes ? post.likes.length : 0)).toLocaleString()}</span>
        </button>
        <button class="post-stat-btn comment-toggle" type="button">
          <span class="material-symbols-outlined">chat_bubble</span>
          <span class="comment-count">${post.commentsCount || 0}</span>
        </button>
        <button class="post-stat-btn" data-share-btn type="button">
          <span class="material-symbols-outlined">share</span>
        </button>
      </div>
      <button class="post-save${isSaved ? " saved" : ""}" data-save-btn type="button"><span class="material-symbols-outlined${isSaved ? " icon-filled" : ""}">bookmark</span></button>
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
  initShareSaveButtons();
  getPostViewObserver().observe(card); // reach/impressions track karne ke liye
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Naam ke bagal me lagane wala nila verified badge - poore app me har jagah reuse hota hai
function verifiedBadgeHtml(isVerified) {
  return isVerified
    ? '<span class="material-symbols-outlined icon-filled verified-badge-inline" title="Verified">verified</span>'
    : "";
}

// Post text ke andar http(s):// wale URLs ko dhoondh kar clickable <a> tag me badalta hai,
// baaki text ko escape kar ke safe rakhta hai (koi HTML injection nahi ho sakti)
function linkifyText(text) {
  const combinedRegex = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
  return text
    .split(combinedRegex)
    .map((part) => {
      if (/^https?:\/\//i.test(part)) {
        return `<a href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`;
      }
      if (/^#[a-zA-Z0-9_]+$/.test(part)) {
        const tag = part.slice(1);
        return `<a href="hashtag.html?tag=${encodeURIComponent(tag)}" class="hashtag-link">${escapeHtml(part)}</a>`;
      }
      if (/^@[a-zA-Z0-9_]+$/.test(part)) {
        const username = part.slice(1);
        return `<a href="profile.html?id=${encodeURIComponent(username)}" class="mention-link">${escapeHtml(part)}</a>`;
      }
      return escapeHtml(part);
    })
    .join("");
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
/* ---------- Forgot password form (real backend call) ---------- */
async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const errorBox = document.getElementById("forgot-error");
  const successBox = document.getElementById("forgot-success");
  const submitBtn = event.target.querySelector('button[type="submit"]');

  if (!email) {
    errorBox.textContent = "Email is required.";
    errorBox.classList.add("show");
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    const data = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    errorBox.classList.remove("show");
    successBox.textContent = data.message;
    successBox.style.display = "block";
    event.target.reset();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Reset password form (real backend call) ---------- */
async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const errorBox = document.getElementById("reset-error");
  const submitBtn = event.target.querySelector('button[type="submit"]');

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    errorBox.textContent = "Reset link is missing a token. Please use the link from your email.";
    errorBox.classList.add("show");
    return;
  }
  if (password.length < 6) {
    errorBox.textContent = "Password must be at least 6 characters.";
    errorBox.classList.add("show");
    return;
  }
  if (password !== confirmPassword) {
    errorBox.textContent = "Passwords do not match.";
    errorBox.classList.add("show");
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    await apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    errorBox.classList.remove("show");
    showToast("Password reset successfully");
    window.location.href = "login.html";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Email verification page (auto-runs on load) ---------- */
async function initEmailVerification() {
  const titleEl = document.querySelector("[data-verify-title]");
  if (!titleEl) return; // sirf verify-email.html pe chalega

  const messageEl = document.querySelector("[data-verify-message]");
  const iconEl = document.querySelector("[data-verify-icon]");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    titleEl.textContent = "Invalid link";
    messageEl.textContent = "This verification link is missing a token.";
    iconEl.textContent = "error";
    iconEl.style.color = "var(--color-error)";
    return;
  }

  try {
    await apiFetch(`/auth/verify-email/${token}`);
    titleEl.textContent = "Email verified!";
    messageEl.textContent = "Your email has been verified. You can now sign in.";
    iconEl.textContent = "check_circle";
    iconEl.style.color = "#16a34a";
  } catch (err) {
    titleEl.textContent = "Verification failed";
    messageEl.textContent = err.message;
    iconEl.textContent = "error";
    iconEl.style.color = "var(--color-error)";
  }
}

document.addEventListener("DOMContentLoaded", initEmailVerification);

/* =========================================================
   STORIES (24-hour disappearing posts)
   ========================================================= */

let storyGroups = []; // backend se aya grouped data: [{ author, stories: [...], hasUnseen }]
let storyGroupIndex = 0; // ab kis user ki story dekh rahe hain
let storySlideIndex = 0; // us user ki kitni-vi story
let storyTimer = null;
const STORY_DURATION_MS = 5000; // har story 5 second dikhegi (video apni length use karti hai)

function initStoriesBar() {
  const bar = document.querySelector("[data-stories-bar]");
  if (!bar) return; // sirf home page pe

  const user = getCurrentUser();
  if (!user) return; // login na ho to stories bar dikhane ka koi fayda nahi

  loadStoriesBar();

  // "Your Story" click -> agar apni koi active story hai to wo khulegi, warna file picker
  bar.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add-story-item]");
    if (addBtn) {
      const myGroup = storyGroups.find((g) => String(g.author._id) === String(user._id));
      if (myGroup) {
        openStoryViewer(storyGroups.indexOf(myGroup), 0);
      } else {
        document.querySelector("[data-story-file-input]").click();
      }
      return;
    }
    const item = e.target.closest("[data-story-group-index]");
    if (item) {
      openStoryViewer(Number(item.dataset.storyGroupIndex), 0);
    }
  });

  // "+" icon pe alag se click ho to bhi seedha upload khule (chahe apni story ho ya na ho)
  bar.addEventListener("click", (e) => {
    if (e.target.closest("[data-add-story-plus]")) {
      e.stopPropagation();
      document.querySelector("[data-story-file-input]").click();
    }
  });

  const fileInput = document.querySelector("[data-story-file-input]");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    await handleStoryUpload(file);
  });
}

async function loadStoriesBar() {
  const bar = document.querySelector("[data-stories-bar]");
  if (!bar) return;

  const user = getCurrentUser();

  try {
    storyGroups = await apiFetch("/stories");
  } catch (err) {
    console.warn("Stories load nahi ho sakin:", err.message);
    storyGroups = [];
  }

  renderStoriesBar(user);
}

function renderStoriesBar(user) {
  const bar = document.querySelector("[data-stories-bar]");
  if (!bar) return;

  const myGroup = storyGroups.find((g) => String(g.author._id) === String(user._id));

  let html = `
    <div class="story-item" data-add-story-item>
      <div class="story-avatar-ring ${myGroup ? (myGroup.hasUnseen ? "story-unseen" : "") : ""}">
        <img src="${user.avatar}" alt="Your story" />
        <span class="story-add-icon material-symbols-outlined" data-add-story-plus>add_circle</span>
      </div>
      <span class="story-item-label">Your Story</span>
    </div>
  `;

  storyGroups.forEach((group, index) => {
    if (String(group.author._id) === String(user._id)) return; // "Your Story" already dikha diya upar
    html += `
      <div class="story-item" data-story-group-index="${index}">
        <div class="story-avatar-ring ${group.hasUnseen ? "story-unseen" : ""}">
          <img src="${group.author.avatar}" alt="${escapeHtml(group.author.name)}" />
        </div>
        <span class="story-item-label">${escapeHtml(group.author.name)}</span>
      </div>
    `;
  });

  bar.innerHTML = html;
}

async function handleStoryUpload(file) {
  const bar = document.querySelector("[data-stories-bar]");
  const originalHtml = bar.innerHTML;
  bar.style.opacity = "0.6"; // upload hote waqt halka feedback

  try {
    const mediaUrl = await uploadFile(file);
    const mediaType = file.type.startsWith("video/") ? "video" : "image";

    await apiFetch("/stories", {
      method: "POST",
      body: JSON.stringify({ mediaUrl, mediaType }),
    });

    await loadStoriesBar();
  } catch (err) {
    alert(err.message || "Story upload nahi ho saki");
    bar.innerHTML = originalHtml;
  } finally {
    bar.style.opacity = "1";
  }
}

/* ---------- Fullscreen viewer ---------- */

function initStoryViewerControls() {
  const viewer = document.querySelector("[data-story-viewer]");
  if (!viewer) return;

  document.querySelector("[data-story-viewer-close]").addEventListener("click", closeStoryViewer);
  document.querySelector("[data-story-next]").addEventListener("click", () => goToStorySlide(1));
  document.querySelector("[data-story-prev]").addEventListener("click", () => goToStorySlide(-1));
  document.querySelector("[data-story-viewer-delete]").addEventListener("click", deleteCurrentStory);

  document.addEventListener("keydown", (e) => {
    if (viewer.style.display === "none" || !viewer.style.display) return;
    if (e.key === "Escape") closeStoryViewer();
    if (e.key === "ArrowRight") goToStorySlide(1);
    if (e.key === "ArrowLeft") goToStorySlide(-1);
  });
}

function openStoryViewer(groupIndex, slideIndex) {
  storyGroupIndex = groupIndex;
  storySlideIndex = slideIndex;

  const viewer = document.querySelector("[data-story-viewer]");
  viewer.style.display = "flex";
  renderStorySlide();
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  const viewer = document.querySelector("[data-story-viewer]");
  viewer.style.display = "none";
  const content = document.querySelector("[data-story-viewer-content]");
  content.innerHTML = ""; // video ho to pause/unload ho jaye
  loadStoriesBar(); // rings ka "seen" state refresh ho jaye
}

// direction: +1 next story, -1 previous story (user ke andar; end pe agla/pichla user)
function goToStorySlide(direction) {
  const group = storyGroups[storyGroupIndex];
  if (!group) return closeStoryViewer();

  const nextSlide = storySlideIndex + direction;

  if (nextSlide >= group.stories.length) {
    // is user ki last story thi -> agle user pe chale jao
    if (storyGroupIndex + 1 < storyGroups.length) {
      storyGroupIndex += 1;
      storySlideIndex = 0;
      renderStorySlide();
    } else {
      closeStoryViewer();
    }
    return;
  }

  if (nextSlide < 0) {
    // pehli story se pehle -> pichle user ki last story
    if (storyGroupIndex - 1 >= 0) {
      storyGroupIndex -= 1;
      storySlideIndex = storyGroups[storyGroupIndex].stories.length - 1;
      renderStorySlide();
    }
    return;
  }

  storySlideIndex = nextSlide;
  renderStorySlide();
}

async function renderStorySlide() {
  clearTimeout(storyTimer);

  const group = storyGroups[storyGroupIndex];
  if (!group) return closeStoryViewer();
  const story = group.stories[storySlideIndex];
  const currentUser = getCurrentUser();
  const isMine = currentUser && String(group.author._id) === String(currentUser._id);

  // Header
  document.querySelector("[data-story-viewer-avatar]").src = group.author.avatar;
  document.querySelector("[data-story-viewer-name]").textContent = group.author.name;
  document.querySelector("[data-story-viewer-time]").textContent = timeAgo(story.createdAt);
  document.querySelector("[data-story-viewer-caption]").textContent = story.text || "";
  document.querySelector("[data-story-viewer-delete]").style.display = isMine ? "flex" : "none";
  document.querySelector("[data-story-viewer-delete]").dataset.storyId = story._id;

  // Progress bars - ek group ki har story ke liye ek track
  const progressRow = document.querySelector("[data-story-progress-row]");
  progressRow.innerHTML = group.stories
    .map((_, i) => {
      const state = i < storySlideIndex ? "filled" : i === storySlideIndex ? "animating" : "";
      return `<div class="story-progress-track"><div class="story-progress-fill ${state}"></div></div>`;
    })
    .join("");

  // Media
  const content = document.querySelector("[data-story-viewer-content]");
  content.innerHTML = "";
  if (story.mediaType === "video") {
    const video = document.createElement("video");
    video.src = story.mediaUrl;
    video.autoplay = true;
    video.playsInline = true;
    video.addEventListener("ended", () => goToStorySlide(1));
    content.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = story.mediaUrl;
    content.appendChild(img);
  }

  // Views count (sirf apni story pe dikhta hai)
  const viewsEl = document.querySelector("[data-story-viewer-views]");
  if (isMine) {
    viewsEl.style.display = "flex";
    viewsEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">visibility</span> ${story.viewersCount || 0}`;
  } else {
    viewsEl.style.display = "none";
  }

  // Auto-advance timer (image ke liye fixed duration; video apne "ended" event se aage barhti hai)
  const currentFill = progressRow.querySelectorAll(".story-progress-fill")[storySlideIndex];
  if (story.mediaType !== "video") {
    requestAnimationFrame(() => {
      currentFill.style.transition = `width ${STORY_DURATION_MS}ms linear`;
      currentFill.style.width = "100%";
    });
    storyTimer = setTimeout(() => goToStorySlide(1), STORY_DURATION_MS);
  }

  // Backend ko batana ke story dekh li (apni story ke liye backend khud skip kar deta hai)
  try {
    await apiFetch(`/stories/${story._id}/view`, { method: "POST" });
  } catch (err) {
    console.warn("Story view mark nahi ho saki:", err.message);
  }
}

async function deleteCurrentStory() {
  const btn = document.querySelector("[data-story-viewer-delete]");
  const storyId = btn.dataset.storyId;
  if (!storyId) return;
  if (!confirm("Delete this story?")) return;

  try {
    await apiFetch(`/stories/${storyId}`, { method: "DELETE" });
    const group = storyGroups[storyGroupIndex];
    group.stories.splice(storySlideIndex, 1);

    if (group.stories.length === 0) {
      closeStoryViewer();
    } else {
      if (storySlideIndex >= group.stories.length) storySlideIndex = group.stories.length - 1;
      renderStorySlide();
    }
  } catch (err) {
    alert(err.message || "Story delete nahi ho saki");
  }
}

/* =========================================================
   REELS (short vertical videos)
   ========================================================= */
let reelsPage = 1;
let reelsHasMore = true;
let reelsLoadingMore = false;
let reelsMuted = true; // TikTok/Reels ki tarah pehle muted start hota hai, tap se unmute
const viewedReelIds = new Set(); // ek reel ka view sirf ek baar count karna is session me
let reelPendingFile = null;

function initReelsPage() {
  const feed = document.querySelector("[data-reels-feed]");
  if (!feed) return; // sirf reels.html pe chalega

  loadReelsFeed();
  initReelUploadModal();
  initReelReactionPicker();
  initReelMenuDropdown();
  initReelCommentsSheet();

  feed.addEventListener("scroll", () => {
    if (!reelsHasMore || reelsLoadingMore) return;
    const nearBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 800;
    if (nearBottom) loadMoreReels();
  });
}

async function loadReelsFeed() {
  const feed = document.querySelector("[data-reels-feed]");
  const emptyState = document.querySelector("[data-reels-empty]");
  reelsPage = 1;
  reelsHasMore = true;

  try {
    const [reels] = await Promise.all([apiFetch(`/reels?page=1&limit=5`), ensureSavedReelIdsLoaded()]);
    feed.innerHTML = "";
    reels.forEach((reel) => feed.appendChild(buildReelCard(reel)));
    if (reels.length < 5) reelsHasMore = false;

    // Khali .reels-feed (0 reels) bhi apni width:100% ki wajah se jagah ghair leta tha,
    // jis se "No reels yet" wala message center ki bajaye side me chala jata tha -
    // is liye feed ko hi hide kar dete hain jab koi reel na ho
    const isEmpty = reels.length === 0;
    feed.style.display = isEmpty ? "none" : "block";
    emptyState.style.display = isEmpty ? "flex" : "none";
    initReelAutoplay(feed);
  } catch (err) {
    console.warn("Reels load nahi ho sakin:", err.message);
    feed.style.display = "none";
    emptyState.style.display = "flex";
  }
}

async function loadMoreReels() {
  const feed = document.querySelector("[data-reels-feed]");
  reelsLoadingMore = true;
  try {
    reelsPage += 1;
    const reels = await apiFetch(`/reels?page=${reelsPage}&limit=5`);
    reels.forEach((reel) => feed.appendChild(buildReelCard(reel)));
    if (reels.length < 5) reelsHasMore = false;
    initReelAutoplay(feed);
  } catch (err) {
    console.warn("Aur reels load nahi ho sakin:", err.message);
  } finally {
    reelsLoadingMore = false;
  }
}

function buildReelCard(reel) {
  const currentUser = getCurrentUser();
  const isMine = currentUser && String(reel.author._id) === String(currentUser._id);
  const myReaction = currentUser
    ? (reel.reactions || []).find((r) => String(r.user) === String(currentUser._id))?.type
    : null;
  const isSaved = getSavedReelIds().some((id) => String(id) === String(reel._id));
  const reactionsCount = reel.reactionsCount ?? (reel.reactions ? reel.reactions.length : 0);

  const card = document.createElement("div");
  card.className = "reel-card";
  card.dataset.reelId = reel._id;

  card.innerHTML = `
    <video src="${reel.videoUrl}" loop playsinline ${reelsMuted ? "muted" : ""}></video>
    <button type="button" class="reel-card-mute" data-reel-mute>
      <span class="material-symbols-outlined">${reelsMuted ? "volume_off" : "volume_up"}</span>
    </button>
    <div class="reel-card-overlay">
      <div class="reel-card-author" data-reel-author="${reel.author._id}">
        <img src="${reel.author.avatar}" alt="${escapeHtml(reel.author.name)}" />
        <span>${escapeHtml(reel.author.name)}${verifiedBadgeHtml(reel.author.isVerified)}</span>
      </div>
      ${reel.caption ? `<div class="reel-card-caption">${escapeHtml(reel.caption)}</div>` : ""}
    </div>
    <div class="reel-card-actions">
      <button type="button" class="reel-action-btn ${myReaction ? "reacted" : ""}" data-reel-react>
        ${myReaction ? `<span class="reaction-emoji">${REACTION_EMOJI[myReaction]}</span>` : `<span class="material-symbols-outlined">thumb_up</span>`}
        <span data-reel-reaction-count>${reactionsCount}</span>
      </button>
      <button type="button" class="reel-action-btn" data-reel-comment>
        <span class="material-symbols-outlined">chat_bubble</span>
        <span data-reel-comment-count>${reel.commentsCount ?? 0}</span>
      </button>
      <button type="button" class="reel-action-btn" data-reel-share>
        <span class="material-symbols-outlined">share</span>
      </button>
      <button type="button" class="reel-action-btn ${isSaved ? "saved" : ""}" data-reel-save>
        <span class="material-symbols-outlined${isSaved ? " icon-filled" : ""}">bookmark</span>
      </button>
      <button type="button" class="reel-action-btn" data-reel-menu>
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </div>
  `;

  card.querySelector("video").addEventListener("click", (e) => {
    const video = e.currentTarget;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  card.querySelector("[data-reel-mute]").addEventListener("click", () => {
    reelsMuted = !reelsMuted;
    document.querySelectorAll(".reel-card video").forEach((v) => (v.muted = reelsMuted));
    document.querySelectorAll("[data-reel-mute] .material-symbols-outlined").forEach((icon) => {
      icon.textContent = reelsMuted ? "volume_off" : "volume_up";
    });
  });

  card.querySelector("[data-reel-author]").addEventListener("click", () => {
    window.location.href = `profile.html?id=${reel.author._id}`;
  });

  /* ---- Reaction button: tap = quick "like" toggle, long-press = emoji picker ---- */
  const reactBtn = card.querySelector("[data-reel-react]");
  let reactionHoldTimer = null;
  let pickerOpenedByHold = false;

  const startHold = (e) => {
    pickerOpenedByHold = false;
    reactionHoldTimer = setTimeout(() => {
      pickerOpenedByHold = true;
      openReactionPicker(reel._id, reactBtn);
    }, 350);
  };
  const cancelHold = () => clearTimeout(reactionHoldTimer);

  reactBtn.addEventListener("mousedown", startHold);
  reactBtn.addEventListener("touchstart", startHold, { passive: true });
  reactBtn.addEventListener("mouseup", cancelHold);
  reactBtn.addEventListener("mouseleave", cancelHold);
  reactBtn.addEventListener("touchend", cancelHold);

  reactBtn.addEventListener("click", () => {
    if (pickerOpenedByHold) {
      pickerOpenedByHold = false; // long-press ke baad wala click ignore karo, picker khud handle karega
      return;
    }
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }
    sendReelReaction(reel._id, "like");
  });

  card.querySelector("[data-reel-comment]").addEventListener("click", () => {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }
    openReelComments(reel._id);
  });

  card.querySelector("[data-reel-share]").addEventListener("click", () => shareReel(reel));

  card.querySelector("[data-reel-save]").addEventListener("click", async (e) => {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }
    const btn = e.currentTarget;
    try {
      const nowSaved = await toggleSavedReel(reel._id);
      btn.classList.toggle("saved", nowSaved);
      btn.querySelector(".material-symbols-outlined").classList.toggle("icon-filled", nowSaved);
      showToast(nowSaved ? "Reel saved" : "Removed from saved");
    } catch (err) {
      showToast(err.message || "Could not update saved reel");
    }
  });

  card.querySelector("[data-reel-menu]").addEventListener("click", (e) => {
    e.stopPropagation();
    openReelMenu(reel, isMine, e.currentTarget);
  });

  return card;
}

const REACTION_EMOJI = { like: "👍", love: "❤️", haha: "😂", wow: "😮", sad: "😢", angry: "😡" };

async function sendReelReaction(reelId, type) {
  const card = document.querySelector(`.reel-card[data-reel-id="${reelId}"]`);
  if (!card) return;
  const btn = card.querySelector("[data-reel-react]");
  const countEl = card.querySelector("[data-reel-reaction-count]");

  try {
    const { myReaction, reactionsCount } = await apiFetch(`/reels/${reelId}/react`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    btn.classList.toggle("reacted", Boolean(myReaction));
    btn.innerHTML =
      (myReaction
        ? `<span class="reaction-emoji">${REACTION_EMOJI[myReaction]}</span>`
        : `<span class="material-symbols-outlined">thumb_up</span>`) +
      `<span data-reel-reaction-count>${reactionsCount}</span>`;
  } catch (err) {
    console.warn("Reel reaction fail:", err.message);
  }
}

/* ---- Reaction emoji picker (long-press) ---- */
function initReelReactionPicker() {
  const picker = document.querySelector("[data-reel-reaction-picker]");
  if (!picker) return;

  picker.querySelectorAll("button[data-reaction]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reelId = picker.dataset.reelId;
      if (reelId) sendReelReaction(reelId, btn.dataset.reaction);
      closeReactionPicker();
    });
  });

  document.addEventListener("click", (e) => {
    if (picker.style.display === "flex" && !picker.contains(e.target) && !e.target.closest("[data-reel-react]")) {
      closeReactionPicker();
    }
  });
}

function openReactionPicker(reelId, anchorBtn) {
  const picker = document.querySelector("[data-reel-reaction-picker]");
  picker.dataset.reelId = reelId;
  const rect = anchorBtn.getBoundingClientRect();
  picker.style.display = "flex";
  // Picker ki width abhi render hone ke baad milegi, is liye ek frame chorne ke baad position lagate hain
  requestAnimationFrame(() => {
    const pickerWidth = picker.offsetWidth;
    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
    picker.style.left = `${left}px`;
    picker.style.top = `${rect.top - picker.offsetHeight - 10}px`;
  });
}

function closeReactionPicker() {
  const picker = document.querySelector("[data-reel-reaction-picker]");
  if (picker) picker.style.display = "none";
}

/* ---- Share ---- */
async function shareReel(reel) {
  const url = `${window.location.origin}${window.location.pathname}?reel=${reel._id}`;
  const shareData = {
    title: "Zovari Reel",
    text: reel.caption || `Check out this reel by ${reel.author.name} on Zovari`,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // User ne share cancel kar diya - kuch karne ki zaroorat nahi
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch (err) {
      showToast("Could not copy link");
    }
  }
}

/* ---- Save (ab server pe - posts ki tarah, User.savedReels field, cross-device sync) ---- */
let savedReelIdsCache = null;

async function ensureSavedReelIdsLoaded() {
  if (!getToken()) {
    savedReelIdsCache = [];
    return savedReelIdsCache;
  }
  if (savedReelIdsCache) return savedReelIdsCache; // is session me pehle hi la chuke hain

  try {
    savedReelIdsCache = await apiFetch("/reels/saved/ids");
  } catch (err) {
    console.warn("Saved reel ids load nahi ho sakin:", err.message);
    savedReelIdsCache = [];
  }
  return savedReelIdsCache;
}

function getSavedReelIds() {
  return savedReelIdsCache || [];
}

async function toggleSavedReel(reelId) {
  const result = await apiFetch(`/reels/${reelId}/save`, { method: "POST" });
  if (!savedReelIdsCache) savedReelIdsCache = [];
  if (result.saved) {
    if (!savedReelIdsCache.includes(reelId)) savedReelIdsCache.push(reelId);
  } else {
    savedReelIdsCache = savedReelIdsCache.filter((id) => id !== reelId);
  }
  return result.saved;
}

/* ---- 3-dot menu (Copy Link / Report / Delete) ---- */
function initReelMenuDropdown() {
  const dropdown = document.querySelector("[data-reel-menu-dropdown]");
  if (!dropdown) return;
  document.addEventListener("click", (e) => {
    if (dropdown.style.display === "block" && !dropdown.contains(e.target) && !e.target.closest("[data-reel-menu]")) {
      dropdown.style.display = "none";
    }
  });
}

function openReelMenu(reel, isMine, anchorBtn) {
  const dropdown = document.querySelector("[data-reel-menu-dropdown]");

  const items = [
    { icon: "link", label: "Copy Link", action: () => copyReelLink(reel._id) },
    isMine
      ? { icon: "delete", label: "Delete Reel", action: () => deleteReelById(reel._id), danger: true }
      : { icon: "flag", label: "Report Reel", action: () => reportReelById(reel._id), danger: true },
  ];

  dropdown.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "reel-menu-item" + (item.danger ? " danger" : "");
    row.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span><span>${item.label}</span>`;
    row.addEventListener("click", () => {
      dropdown.style.display = "none";
      item.action();
    });
    dropdown.appendChild(row);
  });

  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.display = "block";
  requestAnimationFrame(() => {
    const dw = dropdown.offsetWidth;
    let left = rect.left - dw + rect.width;
    left = Math.max(8, Math.min(left, window.innerWidth - dw - 8));
    let top = rect.top - dropdown.offsetHeight - 8;
    if (top < 8) top = rect.bottom + 8; // upar jagah na ho to neeche dikha do
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  });
}

function copyReelLink(reelId) {
  const url = `${window.location.origin}${window.location.pathname}?reel=${reelId}`;
  navigator.clipboard
    .writeText(url)
    .then(() => showToast("Link copied to clipboard"))
    .catch(() => showToast("Could not copy link"));
}

async function reportReelById(reelId) {
  if (!confirm("Report this reel? Our team will review it.")) return;
  try {
    await apiFetch(`/reels/${reelId}/report`, { method: "POST", body: JSON.stringify({}) });
    showToast("Reel reported. Thanks for letting us know.");
  } catch (err) {
    showToast(err.message || "Could not report reel");
  }
}

async function deleteReelById(reelId) {
  if (!confirm("Delete this reel?")) return;
  try {
    await apiFetch(`/reels/${reelId}`, { method: "DELETE" });
    document.querySelector(`.reel-card[data-reel-id="${reelId}"]`)?.remove();
  } catch (err) {
    showToast(err.message || "Reel delete nahi ho saki");
  }
}

/* ---- Comments bottom sheet ---- */
function initReelCommentsSheet() {
  const sheet = document.querySelector("[data-reel-comments-sheet]");
  if (!sheet) return;

  document.querySelector("[data-reel-comments-close]").addEventListener("click", closeReelComments);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeReelComments(); // bahar (overlay) click ho to band ho jaye
  });

  const input = document.querySelector("[data-reel-comment-input]");
  const sendBtn = document.querySelector("[data-reel-comment-send]");

  const send = async () => {
    const text = input.value.trim();
    const reelId = sheet.dataset.reelId;
    if (!text || !reelId) return;

    try {
      const comment = await apiFetch(`/reels/${reelId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      input.value = "";
      const list = document.querySelector("[data-reel-comments-list]");
      if (list.querySelector("p")) list.innerHTML = "";
      list.appendChild(buildReelCommentItem(comment));
      list.scrollTop = list.scrollHeight;

      const countEl = document.querySelector(`.reel-card[data-reel-id="${reelId}"] [data-reel-comment-count]`);
      if (countEl) countEl.textContent = comment.commentsCount ?? Number(countEl.textContent || 0) + 1;
    } catch (err) {
      showToast(err.message || "Comment add nahi ho saka");
    }
  };

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}

async function openReelComments(reelId) {
  const sheet = document.querySelector("[data-reel-comments-sheet]");
  const list = document.querySelector("[data-reel-comments-list]");
  sheet.dataset.reelId = reelId;
  sheet.style.display = "flex";
  list.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); font-size:13px;">Loading...</p>`;

  try {
    const comments = await apiFetch(`/reels/${reelId}/comments`);
    list.innerHTML = "";
    if (comments.length === 0) {
      list.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); font-size:13px;">No comments yet. Say something 👋</p>`;
    } else {
      comments.forEach((c) => list.appendChild(buildReelCommentItem(c)));
      list.scrollTop = list.scrollHeight;
    }
  } catch (err) {
    list.innerHTML = `<p style="text-align:center; color:var(--color-error); font-size:13px;">${escapeHtml(err.message)}</p>`;
  }
}

function closeReelComments() {
  document.querySelector("[data-reel-comments-sheet]").style.display = "none";
}

function buildReelCommentItem(comment) {
  const item = document.createElement("div");
  item.className = "reel-comment-item";
  item.innerHTML = `
    <img src="${comment.author.avatar}" alt="${escapeHtml(comment.author.name)}" />
    <div>
      <div class="reel-comment-body"><b>${escapeHtml(comment.author.name)}${verifiedBadgeHtml(comment.author.isVerified)}</b>${escapeHtml(comment.text)}</div>
      <div class="reel-comment-time">${timeAgo(comment.createdAt)}</div>
    </div>
  `;
  return item;
}

// Scroll me jo reel card sab se zyada nazar aa raha ho usay play karo, baqi sab pause;
// har reel ka view backend ko ek hi baar (is session me) report hota hai
function initReelAutoplay(feed) {
  if (window.zovariReelObserver) window.zovariReelObserver.disconnect();

  window.zovariReelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector("video");
        if (!video) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {});
          const reelId = entry.target.dataset.reelId;
          if (!viewedReelIds.has(reelId)) {
            viewedReelIds.add(reelId);
            apiFetch(`/reels/${reelId}/view`, { method: "POST" }).catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    },
    { threshold: [0.6] }
  );

  feed.querySelectorAll(".reel-card").forEach((card) => window.zovariReelObserver.observe(card));
}

/* ---------- Upload Reel modal ---------- */
function initReelUploadModal() {
  const modal = document.querySelector("[data-reel-upload-modal]");
  if (!modal) return;

  document.querySelectorAll("[data-reel-upload-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!getToken()) {
        window.location.href = "login.html";
        return;
      }
      document.querySelector("[data-reel-file-input]").click();
    });
  });

  document.querySelector("[data-reel-file-input]").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    reelPendingFile = file;
    const preview = document.querySelector("[data-reel-upload-preview]");
    preview.src = URL.createObjectURL(file);
    document.querySelector("[data-reel-caption-input]").value = "";
    modal.style.display = "flex";
  });

  document.querySelector("[data-reel-upload-close]").addEventListener("click", () => {
    modal.style.display = "none";
    reelPendingFile = null;
  });

  document.querySelector("[data-reel-upload-submit]").addEventListener("click", async () => {
    if (!reelPendingFile) return;
    const submitBtn = document.querySelector("[data-reel-upload-submit]");
    const caption = document.querySelector("[data-reel-caption-input]").value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting...";

    try {
      const videoUrl = await uploadFile(reelPendingFile);
      const reel = await apiFetch("/reels", {
        method: "POST",
        body: JSON.stringify({ videoUrl, caption }),
      });

      const feed = document.querySelector("[data-reels-feed]");
      feed.style.display = "block"; // pehla reel upload hua ho to feed dobara dikhani hai
      feed.prepend(buildReelCard(reel));
      document.querySelector("[data-reels-empty]").style.display = "none";
      initReelAutoplay(feed);
      feed.scrollTo({ top: 0, behavior: "smooth" });

      modal.style.display = "none";
      reelPendingFile = null;
    } catch (err) {
      alert(err.message || "Reel upload nahi ho saki");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Reel";
    }
  });
}
/* =========================================================
   VOICE / VIDEO CALLS (WebRTC + Socket.io signaling)
   Kaam kisi bhi page se hota hai - UI JS se hi document.body me
   inject hoti hai, taake incoming call kahin bhi dikh sake.
   ========================================================= */
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let peerConnection = null;
let localStream = null;
let pendingIncomingCall = null; // { from, offer, type, conversationId, callerName, callerAvatar }
let activeCall = null; // { otherUserId, otherUserName, otherUserAvatar, conversationId, type, isCaller, connected, timeoutId }
let callTimerInterval = null;
let callStartedAt = null;
let pendingIceCandidates = []; // remote description set hone tak ICE candidates yahan rukte hain

// ---- Group call state ----
let groupCallState = null; // { conversationId, callType, groupName, peers: Map<userId, {name, avatar, pc}> }
let groupLocalStream = null;
let pendingIncomingGroupCall = null; // { from, callerName, callerAvatar, conversationId, callType }
let groupCallTimerInterval = null;
let groupCallStartedAt = null;
const groupIcePendingByPeer = new Map(); // userId -> [candidates] jab tak remote desc set na ho

function injectCallUI() {
  if (document.getElementById("call-incoming-overlay")) return; // ek hi baar inject hoti hai

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="call-incoming-overlay" class="call-overlay" style="display:none;">
      <div class="call-overlay-content">
        <img id="call-incoming-avatar" class="call-avatar pulsing" src="" alt="" />
        <div class="call-name" id="call-incoming-name"></div>
        <div class="call-status" id="call-incoming-type">Incoming call...</div>
        <div class="call-actions">
          <button type="button" class="call-btn decline" id="call-decline-btn" title="Decline">
            <span class="material-symbols-outlined">call_end</span>
          </button>
          <button type="button" class="call-btn accept" id="call-accept-btn" title="Accept">
            <span class="material-symbols-outlined">call</span>
          </button>
        </div>
      </div>
    </div>

    <div id="call-outgoing-overlay" class="call-overlay" style="display:none;">
      <div class="call-overlay-content">
        <img id="call-outgoing-avatar" class="call-avatar pulsing" src="" alt="" />
        <div class="call-name" id="call-outgoing-name"></div>
        <div class="call-status">Calling...</div>
        <div class="call-actions">
          <button type="button" class="call-btn decline" id="call-cancel-btn" title="Cancel">
            <span class="material-symbols-outlined">call_end</span>
          </button>
        </div>
      </div>
    </div>

    <div id="call-active-overlay" class="call-active-overlay" style="display:none;">
      <video id="call-remote-video" autoplay playsinline></video>
      <div id="call-audio-only-view" class="call-audio-only-view" style="display:none;">
        <img id="call-active-avatar" class="call-avatar" src="" alt="" />
        <div class="call-name" id="call-active-name"></div>
      </div>
      <video id="call-local-video" autoplay playsinline muted class="call-local-pip"></video>
      <div class="call-active-top">
        <div class="call-active-name-row" id="call-active-name-row"></div>
        <div class="call-timer" id="call-timer">00:00</div>
      </div>
      <div class="call-active-controls">
        <button type="button" class="call-control-btn" id="call-mute-btn" title="Mute">
          <span class="material-symbols-outlined">mic</span>
        </button>
        <button type="button" class="call-control-btn" id="call-camera-btn" title="Camera">
          <span class="material-symbols-outlined">videocam</span>
        </button>
        <button type="button" class="call-control-btn end" id="call-hangup-btn" title="End call">
          <span class="material-symbols-outlined">call_end</span>
        </button>
      </div>
    </div>

    <!-- Group call - incoming ring -->
    <div id="group-call-incoming-overlay" class="call-overlay" style="display:none;">
      <div class="call-overlay-content">
        <img id="group-call-incoming-avatar" class="call-avatar pulsing" src="" alt="" />
        <div class="call-name" id="group-call-incoming-name"></div>
        <div class="call-status" id="group-call-incoming-type">Incoming group call...</div>
        <div class="call-actions">
          <button type="button" class="call-btn decline" id="group-call-decline-btn" title="Decline">
            <span class="material-symbols-outlined">call_end</span>
          </button>
          <button type="button" class="call-btn accept" id="group-call-accept-btn" title="Accept">
            <span class="material-symbols-outlined">call</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Group call - active (grid of tiles) -->
    <div id="group-call-active-overlay" class="call-active-overlay group-call-active" style="display:none;">
      <div class="group-call-grid" id="group-call-grid"></div>
      <div class="call-active-top">
        <div class="call-active-name-row" id="group-call-title"></div>
        <div class="call-timer" id="group-call-timer">00:00</div>
      </div>
      <div class="call-active-controls">
        <button type="button" class="call-control-btn" id="group-call-mute-btn" title="Mute">
          <span class="material-symbols-outlined">mic</span>
        </button>
        <button type="button" class="call-control-btn" id="group-call-camera-btn" title="Camera">
          <span class="material-symbols-outlined">videocam</span>
        </button>
        <button type="button" class="call-control-btn end" id="group-call-leave-btn" title="Leave call">
          <span class="material-symbols-outlined">call_end</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById("call-accept-btn").addEventListener("click", acceptIncomingCall);
  document.getElementById("call-decline-btn").addEventListener("click", declineIncomingCall);
  document.getElementById("call-cancel-btn").addEventListener("click", () => endCall(true));
  document.getElementById("call-hangup-btn").addEventListener("click", () => endCall(true));
  document.getElementById("call-mute-btn").addEventListener("click", toggleMute);
  document.getElementById("call-camera-btn").addEventListener("click", toggleCamera);

  document.getElementById("group-call-accept-btn").addEventListener("click", acceptGroupCall);
  document.getElementById("group-call-decline-btn").addEventListener("click", declineGroupCall);
  document.getElementById("group-call-leave-btn").addEventListener("click", leaveGroupCall);
  document.getElementById("group-call-mute-btn").addEventListener("click", toggleGroupMute);
  document.getElementById("group-call-camera-btn").addEventListener("click", toggleGroupCamera);

  // Tab band ho ya page badle to chalti call gracefully khatam kar dena
  window.addEventListener("beforeunload", () => {
    if (activeCall && socket) socket.emit("endCall", { to: activeCall.otherUserId });
    if (groupCallState && socket) socket.emit("leaveGroupCall", { conversationId: groupCallState.conversationId });
  });
}

function bindCallSocketEvents() {
  if (!socket || socket._callEventsBound) return;
  socket._callEventsBound = true;

  socket.on("incomingCall", ({ from, offer, callType, conversationId, callerName, callerAvatar }) => {
    if (activeCall || pendingIncomingCall || groupCallState || pendingIncomingGroupCall) {
      socket.emit("rejectCall", { to: from }); // pehle se kisi aur call me busy hain
      return;
    }
    pendingIncomingCall = { from, offer, type: callType, conversationId, callerName, callerAvatar };
    showIncomingCallUI(callerName, callerAvatar, callType);
  });

  socket.on("callAnswered", async ({ answer }) => {
    if (!peerConnection || !activeCall) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingIceCandidates();
    hideOutgoingCallUI();
    showActiveCallUI();
  });

  socket.on("iceCandidate", async ({ candidate }) => {
    if (!peerConnection) return;
    if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("ICE candidate add nahi ho saka:", err.message);
      }
    } else {
      pendingIceCandidates.push(candidate); // remote description abhi set nahi hui, baad me lagayenge
    }
  });

  socket.on("callRejected", () => {
    showToast("Call declined");
    if (activeCall) logCallToChat(activeCall.conversationId, activeCall.type, "rejected", 0);
    cleanupCall();
  });

  socket.on("callEnded", () => {
    if (pendingIncomingCall) {
      // Caller ne accept hone se pehle hi hangup kar diya - unhone apni taraf se already
      // "cancelled"/"missed" log kar diya hoga, hum sirf apni incoming popup hata dete hain
      hideIncomingCallUI();
      pendingIncomingCall = null;
      return;
    }
    if (activeCall) {
      showToast("Call ended");
      cleanupCall(); // doosri taraf se end hui hai, wo already log kar chuke hain
    }
  });

  /* ---- Group call events ---- */

  socket.on("incomingGroupCall", ({ from, callerName, callerAvatar, conversationId, callType }) => {
    if (activeCall || pendingIncomingCall || groupCallState || pendingIncomingGroupCall) {
      socket.emit("declineGroupCall", { conversationId }); // busy - chup chaap decline
      return;
    }
    pendingIncomingGroupCall = { from, callerName, callerAvatar, conversationId, callType };
    showIncomingGroupCallUI(callerName, callType);
  });

  // Naye join hone wale ko batata hai kaun kaun pehle se call me hai - unhe offer bhejni hai
  socket.on("groupCallParticipants", async ({ conversationId, participants }) => {
    if (!groupCallState || groupCallState.conversationId !== conversationId) return;
    for (const p of participants) {
      await createOfferToGroupPeer(p.userId, p.userName, p.userAvatar);
    }
  });

  // Koi naya join hua - unka offer "groupCallOffer" event se khud aa jayega, yahan kuch nahi karna
  socket.on("userJoinedGroupCall", () => {});

  socket.on("groupCallOffer", async ({ from, offer, userName, userAvatar }) => {
    if (!groupCallState) return;
    const pc = createGroupPeerConnection(from);
    groupCallState.peers.set(from, { name: userName, avatar: userAvatar, pc });
    addGroupCallTile(from, userName, userAvatar);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushGroupIceCandidates(from);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("groupCallAnswer", { to: from, answer, conversationId: groupCallState.conversationId });
  });

  socket.on("groupCallAnswer", async ({ from, answer }) => {
    const peer = groupCallState?.peers.get(from);
    if (!peer) return;
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await flushGroupIceCandidates(from);
  });

  socket.on("groupCallIce", async ({ from, candidate }) => {
    const peer = groupCallState?.peers.get(from);
    if (peer && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Group call ICE candidate add nahi ho saka:", err.message);
      }
    } else {
      if (!groupIcePendingByPeer.has(from)) groupIcePendingByPeer.set(from, []);
      groupIcePendingByPeer.get(from).push(candidate);
    }
  });

  socket.on("userLeftGroupCall", ({ conversationId, userId }) => {
    if (!groupCallState || groupCallState.conversationId !== conversationId) return;
    const peer = groupCallState.peers.get(userId);
    if (peer) {
      peer.pc.close();
      groupCallState.peers.delete(userId);
      removeGroupCallTile(userId);
    }
  });
}

async function startCall(otherUserId, otherUserName, otherUserAvatar, type, conversationId) {
  if (!socket) {
    showToast("Real-time connection nahi hai - page refresh karke try karo");
    return;
  }
  if (activeCall || pendingIncomingCall || groupCallState || pendingIncomingGroupCall) {
    showToast("Aap pehle se kisi call me hain");
    return;
  }

  const permOk = await ensureMediaPermission(type);
  if (!permOk) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
  } catch (err) {
    handleMediaError(err);
    return;
  }

  activeCall = { otherUserId, otherUserName, otherUserAvatar, conversationId, type, isCaller: true, connected: false };
  showOutgoingCallUI(otherUserName, otherUserAvatar, type);

  peerConnection = createPeerConnection(otherUserId);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("callUser", { to: otherUserId, offer, callType: type, conversationId });

  // 30 second tak koi jawab na aya to khud hi "no answer" maan kar cancel kar dete hain
  activeCall.timeoutId = setTimeout(() => {
    if (activeCall && !activeCall.connected) {
      showToast("No answer");
      endCall(true, "missed");
    }
  }, 30000);
}

function createPeerConnection(otherUserId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (e) => {
    if (e.candidate && socket) socket.emit("iceCandidate", { to: otherUserId, candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    const remoteVideo = document.getElementById("call-remote-video");
    if (remoteVideo && remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
    }
  };

  return pc;
}

function showIncomingCallUI(name, avatar, type) {
  document.getElementById("call-incoming-avatar").src = avatar || DEFAULT_USER_AVATAR;
  document.getElementById("call-incoming-name").textContent = name;
  document.getElementById("call-incoming-type").textContent = `Incoming ${type === "video" ? "video" : "voice"} call...`;
  document.getElementById("call-incoming-overlay").style.display = "flex";

  // Mobile pe ghantee jaisa halka sa vibration - agar browser support kare
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
}

function hideIncomingCallUI() {
  const el = document.getElementById("call-incoming-overlay");
  if (el) el.style.display = "none";
}

async function acceptIncomingCall() {
  if (!pendingIncomingCall) return;
  const { from, offer, type, conversationId, callerName, callerAvatar } = pendingIncomingCall;

  const permOk = await ensureMediaPermission(type);
  if (!permOk) {
    socket.emit("rejectCall", { to: from });
    pendingIncomingCall = null;
    hideIncomingCallUI();
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
  } catch (err) {
    handleMediaError(err);
    socket.emit("rejectCall", { to: from });
    pendingIncomingCall = null;
    hideIncomingCallUI();
    return;
  }

  activeCall = { otherUserId: from, otherUserName: callerName, otherUserAvatar: callerAvatar, conversationId, type, isCaller: false, connected: false };
  hideIncomingCallUI();
  pendingIncomingCall = null;

  peerConnection = createPeerConnection(from);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  await flushPendingIceCandidates();

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answerCall", { to: from, answer });
  showActiveCallUI();
}

function declineIncomingCall() {
  if (!pendingIncomingCall) return;
  socket.emit("rejectCall", { to: pendingIncomingCall.from });
  cleanupCall();
}

async function flushPendingIceCandidates() {
  for (const candidate of pendingIceCandidates) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("Pending ICE candidate add nahi ho saka:", err.message);
    }
  }
  pendingIceCandidates = [];
}

function showOutgoingCallUI(name, avatar, type) {
  document.getElementById("call-outgoing-avatar").src = avatar || DEFAULT_USER_AVATAR;
  document.getElementById("call-outgoing-name").textContent = name;
  document.querySelector("#call-outgoing-overlay .call-status").textContent =
    `Calling${type === "video" ? " (video)" : ""}...`;
  document.getElementById("call-outgoing-overlay").style.display = "flex";
}

function hideOutgoingCallUI() {
  const el = document.getElementById("call-outgoing-overlay");
  if (el) el.style.display = "none";
}

function showActiveCallUI() {
  clearTimeout(activeCall?.timeoutId);
  activeCall.connected = true;
  callStartedAt = Date.now();

  const overlay = document.getElementById("call-active-overlay");
  const remoteVideo = document.getElementById("call-remote-video");
  const localVideo = document.getElementById("call-local-video");
  const audioOnlyView = document.getElementById("call-audio-only-view");

  document.getElementById("call-active-name-row").textContent = activeCall.otherUserName;

  if (activeCall.type === "video") {
    remoteVideo.style.display = "block";
    audioOnlyView.style.display = "none";
    localVideo.style.display = "block";
    localVideo.srcObject = localStream;
    document.getElementById("call-camera-btn").style.display = "flex";
  } else {
    remoteVideo.style.display = "none";
    localVideo.style.display = "none";
    audioOnlyView.style.display = "flex";
    document.getElementById("call-active-avatar").src = activeCall.otherUserAvatar || DEFAULT_USER_AVATAR;
    document.getElementById("call-active-name").textContent = activeCall.otherUserName;
    document.getElementById("call-camera-btn").style.display = "none";
  }

  overlay.style.display = "flex";

  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(updateCallTimer, 1000);
  updateCallTimer();
}

function updateCallTimer() {
  if (!callStartedAt) return;
  const secs = Math.floor((Date.now() - callStartedAt) / 1000);
  const el = document.getElementById("call-timer");
  if (el) el.textContent = formatCallDuration(secs);
}

function toggleMute() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  const btn = document.getElementById("call-mute-btn");
  btn.classList.toggle("active", !audioTrack.enabled);
  btn.querySelector(".material-symbols-outlined").textContent = audioTrack.enabled ? "mic" : "mic_off";
}

function toggleCamera() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  const btn = document.getElementById("call-camera-btn");
  btn.classList.toggle("active", !videoTrack.enabled);
  btn.querySelector(".material-symbols-outlined").textContent = videoTrack.enabled ? "videocam" : "videocam_off";
}

// forceEnd=true jab HUMNE khud call end ki (button/timeout) - hum socket event bhejte hain
// aur chat me record bhi save karte hain. Doosri taraf se aane wale "callEnded" pe forceEnd nahi hota.
function endCall(forceEnd, forcedStatus) {
  if (!activeCall && !pendingIncomingCall) return;

  const wasConnected = Boolean(activeCall && activeCall.connected);
  const target = activeCall?.otherUserId || pendingIncomingCall?.from;

  if (forceEnd && target && socket) {
    socket.emit("endCall", { to: target });
  }

  if (forceEnd && activeCall) {
    let status = forcedStatus;
    let duration = 0;
    if (wasConnected) {
      status = "completed";
      duration = Math.floor((Date.now() - callStartedAt) / 1000);
    } else if (!status) {
      status = "cancelled"; // caller ne answer se pehle hi hangup kar diya
    }
    logCallToChat(activeCall.conversationId, activeCall.type, status, duration);
  }

  cleanupCall();
}

function cleanupCall() {
  clearTimeout(activeCall?.timeoutId);
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  callStartedAt = null;

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  pendingIceCandidates = [];
  activeCall = null;
  pendingIncomingCall = null;

  hideIncomingCallUI();
  hideOutgoingCallUI();
  const activeOverlay = document.getElementById("call-active-overlay");
  if (activeOverlay) activeOverlay.style.display = "none";

  const remoteVideo = document.getElementById("call-remote-video");
  const localVideo = document.getElementById("call-local-video");
  if (remoteVideo) remoteVideo.srcObject = null;
  if (localVideo) localVideo.srcObject = null;

  const muteBtn = document.getElementById("call-mute-btn");
  if (muteBtn) {
    muteBtn.classList.remove("active");
    muteBtn.querySelector(".material-symbols-outlined").textContent = "mic";
  }
  const camBtn = document.getElementById("call-camera-btn");
  if (camBtn) {
    camBtn.classList.remove("active");
    camBtn.querySelector(".material-symbols-outlined").textContent = "videocam";
  }
}

async function logCallToChat(conversationId, callType, status, duration) {
  if (!conversationId) return;
  try {
    const message = await apiFetch(`/conversations/${conversationId}/call-log`, {
      method: "POST",
      body: JSON.stringify({ callType, status, duration }),
    });
    // Yehi conversation abhi khuli ho to bubble turant dikha dena
    if (currentConversationId === conversationId) {
      const chatBox = document.querySelector(".chat-messages");
      if (chatBox) {
        if (chatBox.querySelector("p")) chatBox.innerHTML = "";
        chatBox.appendChild(buildChatBubble(message, true, currentConversationIsGroup));
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }
  } catch (err) {
    console.warn("Call log save nahi ho saka:", err.message);
  }
}

/* ---------- Mic/Camera permission handling ----------
   Chrome jaise browsers me agar permission pehle "block" ho chuki ho, to
   getUserMedia() fail hoti hai aur user ko manually address-bar ke lock/i
   icon se allow karke page reload karni parti hai. Hum ye check pehle hi
   kar lete hain taake user ko seedha sahi instruction mil jaye, aur
   dobara try karna asaan ho. */
async function ensureMediaPermission(callType) {
  if (!navigator.permissions || !navigator.permissions.query) return true; // API na ho to seedha try karne dete hain

  try {
    const micStatus = await navigator.permissions.query({ name: "microphone" });
    if (micStatus.state === "denied") {
      showToast("Mic permission block hai. Address bar ke 🔒 icon se Microphone allow karo, phir page reload karo.");
      return false;
    }
    if (callType === "video") {
      const camStatus = await navigator.permissions.query({ name: "camera" });
      if (camStatus.state === "denied") {
        showToast("Camera permission block hai. Address bar ke 🔒 icon se Camera allow karo, phir page reload karo.");
        return false;
      }
    }
  } catch (err) {
    // Kuch browsers (jaise Firefox) "camera"/"microphone" naam se permission query support nahi karte -
    // is case me seedha getUserMedia try karne dete hain, wahi apna prompt dikha dega
  }
  return true;
}

function handleMediaError(err) {
  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    showToast("Mic/Camera permission nahi mili. Address bar ke 🔒 icon se allow karo, phir page reload karo.");
  } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
    showToast("Is device pe camera/mic nahi mila.");
  } else if (err.name === "NotReadableError") {
    showToast("Camera/Mic kisi doosri app me use ho raha hai.");
  } else {
    showToast(err.message || "Call start nahi ho saki");
  }
}

/* =========================================================
   GROUP CALLS - full-mesh WebRTC (har participant baqi sab se
   seedha peer-to-peer connect hota hai)
   ========================================================= */

async function startGroupCall(conversationId, callType, groupName, participants) {
  if (!socket) {
    showToast("Real-time connection nahi hai - page refresh karke try karo");
    return;
  }
  if (activeCall || pendingIncomingCall || groupCallState || pendingIncomingGroupCall) {
    showToast("Aap pehle se kisi call me hain");
    return;
  }

  const permOk = await ensureMediaPermission(callType);
  if (!permOk) return;

  try {
    groupLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
  } catch (err) {
    handleMediaError(err);
    return;
  }

  groupCallState = { conversationId, callType, groupName, peers: new Map() };

  const currentUser = getCurrentUser();
  const participantIds = (participants || [])
    .filter((p) => String(p._id) !== String(currentUser._id))
    .map((p) => String(p._id));

  socket.emit("startGroupCall", { conversationId, callType, participantIds });

  showGroupCallActiveUI();
  addGroupCallLocalTile();

  groupCallStartedAt = Date.now();
  clearInterval(groupCallTimerInterval);
  groupCallTimerInterval = setInterval(updateGroupCallTimer, 1000);
}

function showIncomingGroupCallUI(callerName, callType) {
  document.getElementById("group-call-incoming-avatar").src = DEFAULT_GROUP_AVATAR;
  document.getElementById("group-call-incoming-name").textContent = `${callerName} is calling the group`;
  document.getElementById("group-call-incoming-type").textContent = `Incoming ${callType === "video" ? "video" : "voice"} call...`;
  document.getElementById("group-call-incoming-overlay").style.display = "flex";
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
}

function hideIncomingGroupCallUI() {
  const el = document.getElementById("group-call-incoming-overlay");
  if (el) el.style.display = "none";
}

async function acceptGroupCall() {
  if (!pendingIncomingGroupCall) return;
  const { conversationId, callType } = pendingIncomingGroupCall;

  const permOk = await ensureMediaPermission(callType);
  if (!permOk) {
    pendingIncomingGroupCall = null;
    hideIncomingGroupCallUI();
    return;
  }

  try {
    groupLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
  } catch (err) {
    handleMediaError(err);
    pendingIncomingGroupCall = null;
    hideIncomingGroupCallUI();
    return;
  }

  // Group ka naam conversation list se nikal lete hain (agar available ho), warna generic label
  const convItem = document.querySelector(`.conv-item[data-conv-id="${conversationId}"] .conv-name`);
  const groupName = convItem ? convItem.textContent : "Group call";

  groupCallState = { conversationId, callType, groupName, peers: new Map() };
  hideIncomingGroupCallUI();
  pendingIncomingGroupCall = null;

  showGroupCallActiveUI();
  addGroupCallLocalTile();

  groupCallStartedAt = Date.now();
  clearInterval(groupCallTimerInterval);
  groupCallTimerInterval = setInterval(updateGroupCallTimer, 1000);

  socket.emit("joinGroupCall", { conversationId });
}

function declineGroupCall() {
  if (!pendingIncomingGroupCall) return;
  socket.emit("declineGroupCall", { conversationId: pendingIncomingGroupCall.conversationId });
  pendingIncomingGroupCall = null;
  hideIncomingGroupCallUI();
}

async function createOfferToGroupPeer(userId, name, avatar) {
  if (!groupCallState || groupCallState.peers.has(userId)) return;

  const pc = createGroupPeerConnection(userId);
  groupCallState.peers.set(userId, { name, avatar, pc });
  addGroupCallTile(userId, name, avatar);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("groupCallOffer", { to: userId, offer, conversationId: groupCallState.conversationId });
}

function createGroupPeerConnection(userId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  groupLocalStream.getTracks().forEach((track) => pc.addTrack(track, groupLocalStream));

  pc.onicecandidate = (e) => {
    if (e.candidate && socket) {
      socket.emit("groupCallIce", { to: userId, candidate: e.candidate, conversationId: groupCallState.conversationId });
    }
  };

  pc.ontrack = (e) => {
    const video = document.querySelector(`.group-call-tile[data-user-id="${userId}"] video`);
    if (video && video.srcObject !== e.streams[0]) video.srcObject = e.streams[0];
  };

  return pc;
}

async function flushGroupIceCandidates(userId) {
  const peer = groupCallState?.peers.get(userId);
  const queued = groupIcePendingByPeer.get(userId);
  if (!peer || !queued) return;
  for (const candidate of queued) {
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("Group ICE flush fail:", err.message);
    }
  }
  groupIcePendingByPeer.delete(userId);
}

function showGroupCallActiveUI() {
  document.getElementById("group-call-title").textContent = groupCallState.groupName;
  document.getElementById("group-call-camera-btn").style.display = groupCallState.callType === "video" ? "flex" : "none";
  document.getElementById("group-call-active-overlay").style.display = "flex";
}

function addGroupCallLocalTile() {
  const grid = document.getElementById("group-call-grid");
  const currentUser = getCurrentUser();
  const tile = document.createElement("div");
  tile.className = "group-call-tile";
  tile.dataset.userId = String(currentUser._id);

  if (groupCallState.callType === "video") {
    tile.innerHTML = `<video autoplay playsinline muted></video><div class="tile-name">You</div>`;
    grid.appendChild(tile);
    tile.querySelector("video").srcObject = groupLocalStream;
  } else {
    tile.innerHTML = `<img class="tile-avatar" src="${currentUser.avatar || DEFAULT_USER_AVATAR}" alt="You" /><div class="tile-name">You</div>`;
    grid.appendChild(tile);
  }
}

function addGroupCallTile(userId, name, avatar) {
  if (document.querySelector(`.group-call-tile[data-user-id="${userId}"]`)) return; // pehle se hai

  const grid = document.getElementById("group-call-grid");
  const tile = document.createElement("div");
  tile.className = "group-call-tile";
  tile.dataset.userId = String(userId);

  if (groupCallState.callType === "video") {
    tile.innerHTML = `<video autoplay playsinline></video><div class="tile-name" data-tile-name>${escapeHtml(name || "...")}</div>`;
  } else {
    tile.innerHTML = `<img class="tile-avatar" src="${avatar || DEFAULT_USER_AVATAR}" alt="${escapeHtml(name || "")}" /><div class="tile-name" data-tile-name>${escapeHtml(name || "...")}</div>`;
  }
  grid.appendChild(tile);
}

function removeGroupCallTile(userId) {
  document.querySelector(`.group-call-tile[data-user-id="${userId}"]`)?.remove();
}

function updateGroupCallTimer() {
  if (!groupCallStartedAt) return;
  const secs = Math.floor((Date.now() - groupCallStartedAt) / 1000);
  const el = document.getElementById("group-call-timer");
  if (el) el.textContent = formatCallDuration(secs);
}

function toggleGroupMute() {
  if (!groupLocalStream) return;
  const audioTrack = groupLocalStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  const btn = document.getElementById("group-call-mute-btn");
  btn.classList.toggle("active", !audioTrack.enabled);
  btn.querySelector(".material-symbols-outlined").textContent = audioTrack.enabled ? "mic" : "mic_off";
}

function toggleGroupCamera() {
  if (!groupLocalStream) return;
  const videoTrack = groupLocalStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  const btn = document.getElementById("group-call-camera-btn");
  btn.classList.toggle("active", !videoTrack.enabled);
  btn.querySelector(".material-symbols-outlined").textContent = videoTrack.enabled ? "videocam" : "videocam_off";
}

function leaveGroupCall() {
  if (!groupCallState) return;

  const { conversationId, callType } = groupCallState;
  const duration = groupCallStartedAt ? Math.floor((Date.now() - groupCallStartedAt) / 1000) : 0;

  if (socket) socket.emit("leaveGroupCall", { conversationId });

  // Kam se kam 4 second chali ho to "completed" mano, warna "cancelled" (kisi ne join hi nahi kiya)
  logCallToChat(conversationId, callType, duration >= 4 ? "completed" : "cancelled", duration);

  cleanupGroupCall();
}

function cleanupGroupCall() {
  if (groupCallState) {
    groupCallState.peers.forEach((peer) => peer.pc.close());
  }
  groupCallState = null;
  groupIcePendingByPeer.clear();

  clearInterval(groupCallTimerInterval);
  groupCallTimerInterval = null;
  groupCallStartedAt = null;

  if (groupLocalStream) {
    groupLocalStream.getTracks().forEach((t) => t.stop());
    groupLocalStream = null;
  }

  const grid = document.getElementById("group-call-grid");
  if (grid) grid.innerHTML = "";

  const overlay = document.getElementById("group-call-active-overlay");
  if (overlay) overlay.style.display = "none";
  hideIncomingGroupCallUI();

  const muteBtn = document.getElementById("group-call-mute-btn");
  if (muteBtn) {
    muteBtn.classList.remove("active");
    muteBtn.querySelector(".material-symbols-outlined").textContent = "mic";
  }
  const camBtn = document.getElementById("group-call-camera-btn");
  if (camBtn) {
    camBtn.classList.remove("active");
    camBtn.querySelector(".material-symbols-outlined").textContent = "videocam";
  }
}