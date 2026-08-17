# Zovari — Premium Social Web App (Frontend)

Yeh **Task 2: Social Media Platform** ka frontend hai. Design Stitch se banaya gaya tha, is yahan par usay plain **HTML, CSS aur JavaScript** me convert kiya gaya hai (bilkul waisay hi jaisay Cleaning-Website repo me hai — koi framework nahi, sari files separate hain).

## Folder Structure

Sab files root me hain (bilkul Cleaning-Website repo jaisa — koi subfolder nahi):

```
Zovari-social-media-app/
├── index.html          → Home feed (site kholte hi yeh page aata hai)
├── login.html          → Login / Sign in page
├── signup.html         → Sign up page
├── explore.html        → Explore / Discover page (top creators + popular grid)
├── profile.html        → User profile page (cover, bio, tabs: Posts/Media/Likes)
├── notifications.html  → Notifications page (likes, follows, comments, mentions)
├── messages.html       → Messages / DM page (conversation list + chat panel)
├── settings.html        → Account settings (profile info, privacy, notification toggles)
├── style.css            → Sara design system + responsive CSS ek hi file me
├── script.js             → Poori interactivity (neeche list hai)
├── zovari-logo.png        → Logo
└── README.md
```

**Note:** `index.html` = Home feed hai (jab backend lagega tab is pe login-check add hoga: agar user logged in nahi hai to `login.html` pe redirect karna, warna feed dikhana). Abhi ke liye seedha `index.html` khulne se feed dikhta hai taake design dekhna aasaan ho.

## Abhi kya kaam kar raha hai (Frontend-only, no backend yet)

- **Like** button click karne se count update hota hai aur heart fill ho jata hai.
- **Follow** button click karne se "Follow" → "Following" toggle hota hai.
- **Comments**: har post ke comment icon pe click karne se comments section khulta hai — pehle se maujood comments dikhte hain aur naya comment likh kar bhej bhi sakte ho (Enter ya send button se).
- **Composer**: post likh kar "Post" dabao to naya card feed ke top pe add ho jata hai (comments ke sath).
- **Search**: home feed ke search box me kuch likho to posts (author/text ke mutabiq) filter ho jati hain.
- Profile page pe **Posts / Media / Likes** tabs switch hoti hain.
- Explore page pe **filter chips** (For You / Trending...) select ho sakti hain.
- **Notifications page**: likes, follows, comments, mentions ki list — unread wali highlight hoti hain.
- **Messages page**: left me conversations list, click karne se chat panel update hota hai, message type karke bhej bhi sakte ho.
- **Settings page**: profile info, privacy aur notification toggles — "Save changes" pe confirmation toast dikhta hai.
- **Create** button (sidebar/mobile-nav) kisi bhi page se click karo to `index.html` pe le jaake seedha composer pe focus kar deta hai.
- Login/Signup forms abhi sirf front-end validation karte hain, phir seedha `index.html` pe le jate hain.
- Mobile pe sidebar chup jati hai aur neeche bottom nav bar aa jati hai.

## Backend lagana baaki hai (Task requirement ke mutabiq)

Task ke mutabiq backend Django ya Express.js + database (users, posts, comments, followers) chahiye. `js/script.js` me har jagah `// TODO:` comments likhe hain jahan real API calls lagni hain, misaal ke tor par:

```js
// Like karne ke liye
fetch(`/api/posts/${postId}/like`, { method: "POST" })

// Follow karne ke liye
fetch(`/api/users/${userId}/follow`, { method: "POST" })

// Login
fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
```

Jab backend ready ho jaye to bas in jagah pe real fetch calls daalni hain aur static content ko database se aane wale data se replace karna hai.

## Kaise chalayein

Koi build step nahi chahiye. `index.html` ko browser me kholo, ya VS Code me "Live Server" extension use karo.