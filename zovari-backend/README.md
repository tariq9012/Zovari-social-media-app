# Zovari Backend (Task 2 — Social Media Platform)

Express.js + MongoDB backend jo `Zovari-social-media-app` frontend ke sath connect hota hai.

## Features (Task requirement ke mutabiq)

- ✅ User signup/login (JWT auth, password bcrypt se hash hota hai)
- ✅ User profiles (name, bio, location, avatar, cover image) — real profile page se connected
- ✅ Posts (create, feed, delete, popular sort)
- ✅ Comments (add, list)
- ✅ Like system (toggle like/unlike, per-post likes count)
- ✅ Follow system (toggle follow/unfollow, followers/following count)
- ✅ Real-time-jaisa Messaging (conversations + messages)
- ✅ Notifications (like/comment/follow pe auto-generate hoti hain)
- ✅ Image upload (Cloudinary) — post images aur profile avatar dono

## Folder Structure

```
zovari-backend/
├── server.js              → Entry point, Express app setup
├── config/db.js           → MongoDB connection
├── models/                → User.js, Post.js, Comment.js (Mongoose schemas)
├── controllers/           → Route logic (auth, user, post, comment)
├── middleware/auth.js     → JWT verify (protect route middleware)
├── routes/                → authRoutes, userRoutes, postRoutes
└── .env.example            → Env variables ka template
```

## Setup (Step by Step)

1. **MongoDB Atlas account banao** (free tier): https://www.mongodb.com/cloud/atlas
   - Cluster create karo, database user banao, "Connect Your Application" se connection string copy karo.
   - Ya phir local MongoDB use kar sakte ho: `mongodb://localhost:27017/zovari`

2. **Cloudinary account banao** (free tier, image upload ke liye): https://cloudinary.com/users/register/free
   - Signup ke baad Dashboard pe seedha teen values dikh jati hain: **Cloud Name**, **API Key**, **API Secret**

3. **Install dependencies:**
   ```bash
   cd zovari-backend
   npm install
   ```

4. **`.env` file banao** (`.env.example` ko copy kar ke):
   ```bash
   cp .env.example .env
   ```
   Phir `.env` me apna `MONGO_URI`, `JWT_SECRET`, aur Cloudinary ke teeno values daal do.

5. **Server run karo:**
   ```bash
   npm run dev
   ```
   Server `http://localhost:5000` pe chalega. Browser me `http://localhost:5000` khol kar check karo — `{"message": "Zovari backend chal raha hai 🚀"}` dikhna chahiye.

## API Endpoints

| Method | Endpoint                     | Auth Required | Description                    |
|--------|-------------------------------|:--------------:|---------------------------------|
| POST   | `/api/auth/signup`            | ❌             | Naya account banana             |
| POST   | `/api/auth/login`             | ❌             | Login (JWT token milta hai)     |
| GET    | `/api/auth/me`                | ✅             | Apni profile info               |
| GET    | `/api/users?limit=4`           | Optional       | Users ki list (suggestions ke liye) |
| GET    | `/api/users/:id`               | ❌             | Kisi user ki profile + posts    |
| PATCH  | `/api/users/me`                | ✅             | Profile/settings update         |
| POST   | `/api/users/:id/follow`        | ✅             | Follow/Unfollow toggle          |
| GET    | `/api/posts`                   | ❌             | Home feed (sab posts)           |
| GET    | `/api/posts?sort=popular`      | ❌             | Explore "Popular Today" grid    |
| POST   | `/api/posts`                   | ✅             | Naya post banana                |
| DELETE | `/api/posts/:id`               | ✅             | Apna post delete karna           |
| PATCH  | `/api/posts/:id`               | ✅             | Apna post edit karna (text/image) |
| POST   | `/api/posts/:id/like`          | ✅             | Like/Unlike toggle              |
| GET    | `/api/posts/:id/comments`      | ❌             | Post ke comments dekhna         |
| POST   | `/api/posts/:id/comments`      | ✅             | Comment add karna                |
| GET    | `/api/conversations`           | ✅             | Apni sari conversations         |
| POST   | `/api/conversations`           | ✅             | `{ userId }` ke sath naya/existing conversation |
| GET    | `/api/conversations/:id/messages` | ✅          | Conversation ke messages         |
| POST   | `/api/conversations/:id/messages` | ✅          | Message bhejna                   |
| GET    | `/api/notifications`           | ✅             | Apni notifications               |
| PATCH  | `/api/notifications/read-all`  | ✅             | Sab notifications read mark karna |
| POST   | `/api/upload`                  | ✅             | Image upload (form-data field: `image`), URL wapis milta hai |

Protected routes ke liye header me token bhejna hota hai:
```
Authorization: Bearer <token>
```

## Frontend ke sath connect karna

`script.js` me top pe `API_BASE = "http://localhost:5000/api"` set hai — backend run karne ke baad `index.html`, `login.html`, `signup.html`, `profile.html`, `explore.html`, `messages.html`, `notifications.html`, `settings.html` sab ko browser ya Live Server se kholo, sab kuch real database se chalega:

- **Home feed**: real posts, like, comment
- **Profile**: apni profile (login ke baad) ya `profile.html?id=<userId>` se kisi aur ki — real follow button, real posts
- **Explore**: real "Top Creators" (follow suggestions) aur "Popular Today" (sab se zyada liked posts)
- **Messages**: real conversations — kisi ki profile pe mail icon dabao to conversation start ho jati hai
- **Notifications**: like/comment/follow pe automatically ban kar yahan dikhti hain
- **Settings**: apna naam/bio/location update karke save kar sakte ho

**Note:** CORS ke liye `.env` me `CLIENT_URL` apne frontend ke URL ke mutabiq set karna (masalan Live Server `http://127.0.0.1:5500`).

## Agla kaam (future scope, agar chaho)
- Messages real-time (Socket.io se instant delivery) — abhi refresh/reload pe hi naye messages dikhte hain.
- Media/Likes tabs (profile page) abhi placeholder hain — chaho to inhe bhi real data se bhara ja sakta hai.
- Privacy/Notification toggles (Settings page) abhi UI-only hain, backend me store nahi hote.