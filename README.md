# Zovari — Premium Social Web App (Frontend)

Yeh **Task 2: Social Media Platform** ka frontend hai. Design Stitch se banaya gaya tha, is yahan par usay plain **HTML, CSS aur JavaScript** me convert kiya gaya hai (bilkul waisay hi jaisay Cleaning-Website repo me hai — koi framework nahi, sari files separate hain).

## Folder Structure

```
zovari/
├── index.html      → Home feed (site kholte hi yeh page aata hai — composer + posts + trending + who to follow)
├── login.html        → Login / Sign in page
├── signup.html         → Sign up page
├── explore.html          → Explore / Discover page (top creators + popular grid)
├── profile.html            → User profile page (cover, bio, tabs: Posts/Media/Likes)
├── css/
│   └── style.css              → Sara design system + responsive CSS ek hi file me
├── js/
│   └── script.js                 → Like, Follow, Tabs, Password toggle, Composer logic
├── images/
│   └── zovari-logo.png            → Logo
└── README.md
```

**Note:** `index.html` = Home feed hai (jab backend lagega tab is pe login-check add hoga: agar user logged in nahi hai to `login.html` pe redirect karna, warna feed dikhana). Abhi ke liye seedha `index.html` khulne se feed dikhta hai taake design dekhna aasaan ho.

## Abhi kya kaam kar raha hai (Frontend-only, no backend yet)

- Like button click karne se count update hota hai aur heart fill ho jata hai.
- Follow button click karne se "Follow" → "Following" toggle hota hai.
- Composer me post likh kar "Post" dabao to naya card feed ke top pe add ho jata hai.
- Profile page pe Posts / Media / Likes tabs switch hoti hain.
- Explore page pe filter chips (For You / Trending...) select ho sakti hain.
- Login/Signup forms abhi sirf front-end validation karte hain, phir seedha `home.html` pe le jate hain.
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
