# Zovari — Social Media Platform (Task 2)

Mini social media app: user profiles, posts & comments, like/follow system, messaging, notifications.

## Folder Structure

```
Zovari-social-media-app/
├── frontend/            → HTML, CSS, JavaScript (static site)
│   ├── index.html       → Home feed
│   ├── login.html       → Login
│   ├── signup.html      → Sign up
│   ├── explore.html     → Explore / Discover
│   ├── profile.html     → User profile
│   ├── messages.html    → Direct messages
│   ├── notifications.html
│   ├── settings.html
│   ├── script.js        → All frontend logic + API calls to backend
│   └── style.css
│
└── zovari-backend/      → Express.js + MongoDB backend
    ├── server.js
    ├── config/          → DB connection
    ├── models/          → User, Post, Comment, Conversation, Message, Notification
    ├── controllers/      → Route logic
    ├── middleware/       → JWT auth
    ├── routes/
    └── README.md         → Backend setup instructions (API list, .env setup)
```

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla, no framework)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Atlas)
- **Auth:** JWT + bcrypt

## How to Run

1. Backend setup: see [`zovari-backend/README.md`](./zovari-backend/README.md) for full instructions (`.env` setup, `npm install`, `npm run dev`).
2. Once the backend is running on `http://localhost:5000`, open `frontend/index.html` in a browser (or via Live Server).

## Features

- Signup / Login (JWT)
- User profiles (bio, location, avatar)
- Create posts, like/unlike, comment
- Follow / unfollow users
- Explore page (top creators, popular posts)
- Direct messages between users
- Notifications (like/comment/follow)