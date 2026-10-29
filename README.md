# Sequencer 🎵

> A mood-transition playlist ordering engine built with **Vanilla HTML/CSS/JavaScript** frontend and a **Node.js / Express / MongoDB Atlas** backend following strict **MVC (Model-View-Controller)** architecture.

---

## 📌 Project Overview

**Sequencer** maps the distance between songs based on **tempo (BPM)**, **energy (1–10)**, and **mood (1–10)** to generate the smoothest harmonic and rhythmic transition path through your music library — eliminating jarring jumps without relying on random shuffle.

---

## 🏛️ Architecture & Project Structure (Guideline #2 & #7)

The repository follows a clean, decoupled monorepo structure containing dedicated `frontend/` and `backend/` folders:

```
Sequencer/
├── frontend/                     # 🎨 Frontend Web Application (Continuous Eval 1)
│   ├── index.html                # Home / Landing page
│   ├── about.html                # About page with animated background
│   ├── library.html              # Library management (Tracks, Playlists, Liked)
│   ├── sequence.html             # The core Sequencing engine
│   ├── auth.html                 # Sign-in portal
│   ├── signup.html               # Registration portal
│   ├── profile.html              # User account & playback history
│   ├── assets/                   # Artwork, background svgs & video
│   ├── css/                      # Responsive stylesheets (style, about, auth, profile)
│   └── js/
│       ├── config.js             # API URL configuration (Local vs Deployed)
│       ├── api.js                # REST API Client (Fetch + JWT Auth)
│       ├── user-store.js         # Unified client data manager (localStorage + Cloud Sync)
│       ├── auth.js               # Authentication handlers
│       ├── site-auth.js          # Route guards & user session nav
│       ├── library.js            # Library UI interactions
│       ├── sequence.js           # Graph transition algorithm & audio preview
│       └── profile.js            # Profile updates, password change, stats
│
├── backend/                      # ⚙️ MVC Backend REST API (Continuous Eval 2)
│   ├── config/
│   │   └── db.js                 # MongoDB Atlas Mongoose connection
│   ├── models/                   # [M] - Mongoose Data Models
│   │   ├── User.js               # User accounts (bcrypt hash, email validation)
│   │   ├── Track.js              # Track schema (BPM, energy, mood, genre, liked)
│   │   ├── Playlist.js           # Playlist schema (track references, metadata)
│   │   ├── Sequence.js           # Ordered sequences with flow metrics
│   │   └── History.js            # Playback log schema
│   ├── views/                    # [V] - View Layer
│   │   └── index.html            # Interactive API Documentation & Health Dashboard
│   ├── controllers/              # [C] - Business Logic & DB queries
│   │   ├── authController.js     # Signup, Login, Me, UpdateProfile, ChangePassword, DeleteAccount
│   │   ├── trackController.js    # CRUD tracks, toggle like, batch sync
│   │   ├── playlistController.js # CRUD playlists, batch sync
│   │   ├── sequenceController.js # Save and retrieve generated sequences
│   │   └── historyController.js  # Add, retrieve, clear play history
│   ├── routes/                   # Express API Routers
│   │   ├── authRoutes.js         # /api/auth/*
│   │   ├── trackRoutes.js        # /api/tracks/*
│   │   ├── playlistRoutes.js     # /api/playlists/*
│   │   ├── sequenceRoutes.js     # /api/sequences/*
│   │   └── historyRoutes.js      # /api/history/*
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer token protection & verification
│   │   └── errorMiddleware.js    # Central error handler (CastError, duplicate key, validation)
│   ├── server.js                 # Main Express server entry point
│   ├── package.json              # Backend dependencies (express, mongoose, cors, dotenv, etc.)
│   ├── .env.example              # Environment variables template
│   └── .env                      # Local environment configuration
│
├── postman/                      # 🧪 API Testing Collections (Guideline #4)
│   ├── Sequencer_API.postman_collection.json     # Ready-to-import Postman Collection v2.1
│   └── Sequencer_ThunderClient_Collection.json   # Ready-to-import VS Code Thunder Client Collection
│
├── package.json                  # Root orchestration script runner
├── .gitignore                    # Git ignore file (node_modules, .env, .DS_Store)
└── README.md                     # Documentation & presentation guide
```

---

## 🗄️ MongoDB Atlas Setup (Guideline #1 & #5)

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Shared Cluster**.
3. Under **Security → Database Access**:
   - Create a database user (e.g., `sequencer_admin`) with a secure password.
4. Under **Security → Network Access**:
   - Click **Add IP Address** and choose **Allow Access from Anywhere (`0.0.0.0/0`)** so your local machine and deployed cloud server (Render/Railway) can connect.
5. Under **Database → Deployment → Connect**:
   - Select **Drivers (Node.js)**.
   - Copy the connection string.
   - Example:
     ```
     mongodb+srv://sequencer_admin:<password>@cluster0.abcde.mongodb.net/sequencer?retryWrites=true&w=majority
     ```
6. Paste your URI into `backend/.env`:
   ```env
   PORT=5050
   NODE_ENV=development
   MONGO_URI=mongodb+srv://sequencer_admin:<your_password>@cluster0.abcde.mongodb.net/sequencer?retryWrites=true&w=majority
   JWT_SECRET=sequencer_super_secure_jwt_secret_key_2026
   ```

---

## 🚀 Running the Project Locally

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` inside `backend/` and add your Atlas credentials:
```bash
cp .env.example .env
```

### 3. Start the Backend Server
```bash
npm start
# or for auto-reload during development:
npm run dev
```
The server will boot on port `5050`:
- 📊 **MVC API Dashboard**: `http://localhost:5050/`
- 🩺 **Health Check**: `http://localhost:5050/api/health`
- 🎵 **Frontend Web App**: `http://localhost:5050/frontend/index.html`

### 4. Running Frontend Independently (Optional)
You can also open `frontend/index.html` directly with VS Code Live Server or python:
```bash
cd frontend
python3 -m http.server 8080
```
The frontend automatically points to `http://localhost:5050/api` when run locally.

---

## 📡 REST API Reference

All protected endpoints require the header `Authorization: Bearer <your_jwt_token>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Register new user with hashed password |
| `POST` | `/api/auth/login` | Public | Login with email & password, returns JWT |
| `GET` | `/api/auth/me` | Protected | Get logged-in user profile |
| `PUT` | `/api/auth/profile` | Protected | Update first name, last name, or email |
| `PUT` | `/api/auth/password` | Protected | Change account password |
| `DELETE` | `/api/auth/account` | Protected | Permanently delete account & associated data |

### Tracks (`/api/tracks`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/tracks` | Public/Optional | Get all user tracks (or demo seed tracks) |
| `POST` | `/api/tracks` | Protected | Add a new track (title, artist, BPM, energy, mood) |
| `POST` | `/api/tracks/batch` | Protected | Bulk sync tracks from client |
| `PUT` | `/api/tracks/:id` | Protected | Update track parameters |
| `PATCH` | `/api/tracks/:id/like` | Protected | Toggle track liked state |
| `DELETE` | `/api/tracks/:id` | Protected | Delete track from library |

### Playlists (`/api/playlists`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/playlists` | Protected | Get all user playlists |
| `POST` | `/api/playlists` | Protected | Create a new playlist |
| `PUT` | `/api/playlists/:id` | Protected | Update playlist name or tracks |
| `DELETE` | `/api/playlists/:id` | Protected | Delete playlist |

### Sequences (`/api/sequences`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/sequences` | Protected | Get all saved sequences |
| `POST` | `/api/sequences` | Protected | Save generated sequence with flow metrics |
| `DELETE` | `/api/sequences/:id` | Protected | Delete sequence |

### History (`/api/history`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/history` | Protected | Get recent playback history |
| `POST` | `/api/history` | Protected | Record song playback |
| `DELETE` | `/api/history` | Protected | Clear playback history |

---

## 🧪 API Testing with Postman / Thunder Client (Guideline #4)

Pre-built collections are included in the `postman/` directory:

### Option A: Using Postman
1. Open **Postman**.
2. Click **Import** (top left).
3. Drag and drop `postman/Sequencer_API.postman_collection.json`.
4. Click into **Auth → 1. Signup New User** or **2. Login User** and click **Send**.
   - The test script **automatically saves the returned JWT token** to collection variables!
5. Test protected endpoints (`Me`, `Tracks`, `Playlists`, `Sequences`, `History`).

### Option B: Using VS Code Thunder Client
1. Open the **Thunder Client** extension in VS Code.
2. Go to **Collections → Import** and select `postman/Sequencer_ThunderClient_Collection.json` (or the postman collection).
3. Run the requests to demonstrate working APIs.

---

## 🌐 Backend Deployment Guide (Guideline #3 & #5)

### Deploying on [Render.com](https://render.com) (Recommended Free Tier)
1. Push your repository to GitHub.
2. Sign up on **Render.com** and click **New + → Web Service**.
3. Connect your GitHub repository: `https://github.com/Krish-Mahajan24/Sequencer`.
4. Configure service settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add **Environment Variables**:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Any secure string (e.g. `prod_jwt_secret_key_2026`)
   - `NODE_ENV`: `production`
6. Click **Create Web Service**.
7. Once deployed, Render provides your live URL (e.g. `https://sequencer-backend-xyz.onrender.com`).

### Updating Frontend to Use Deployed URL (Guideline #5)
Open `frontend/js/config.js` and set your live URL:
```javascript
window.SEQUENCER_CONFIG = {
  LOCAL_API_URL: 'http://localhost:5001/api',
  DEPLOYED_API_URL: 'https://sequencer-backend-xyz.onrender.com/api', // <-- paste your deployed Render URL here
  ...
};
```
When hosted online (e.g., GitHub Pages or Vercel), the frontend will automatically use your deployed Render API and store all data in MongoDB Atlas!

---

## 📋 Evaluation Rubric Compliance Checklist

| # | Evaluation Requirement | Status | Where Implemented |
|---|---|---|---|
| **1** | **Backend Development** | ✅ Complete | Node.js + Express backend with REST APIs |
| **2** | **MVC Architecture** | ✅ Complete | Strict separation: `models/`, `views/`, `controllers/`, `routes/` |
| **3** | **Backend Deployment** | ✅ Ready | `server.js`, `package.json`, health check `/api/health`, and Render deployment instructions |
| **4** | **API Testing** | ✅ Complete | Ready-to-import Postman & Thunder Client collections in `postman/` |
| **5** | **Frontend Integration & Atlas** | ✅ Complete | Dynamic API configuration in `frontend/js/config.js`, `frontend/js/api.js`, full MongoDB Atlas data persistence |
| **6** | **GitHub Repository Link** | ✅ Unchanged | Same GitHub repository URL preserved |
| **7** | **Project Structure** | ✅ Complete | Both `frontend/` and `backend/` folders cleanly organized in the same repository |
