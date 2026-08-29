# Vynq-chat

> **Connect. Chat. Disappear.**

A privacy-focused, installable PWA messaging app — WhatsApp-style simplicity + Instagram-style social discovery, built on **React + TypeScript + Vite + Firebase**.

> **Privacy note:** Vynq-chat is *not* end-to-end encrypted. Security is provided by Firebase Authentication, Firestore, and Storage access rules. Messages auto-delete after **7 days**, status after **24 hours**, and media is removed with its message. There are no permanent copies of your conversations.

---

## ✨ Features

- 🔐 Email/password auth with **mandatory email verification** (verified before app access)
- 👤 **Globally unique usernames** (3–20 chars, case-insensitive)
- 📸 Instagram-style **follow / friend requests** (send → accept / reject)
- 💬 Real-time 1:1 **Firebase Firestore** chat with read receipts, typing & online presence
- 🖼️ **Image & video messages** with Storage security + auto-expiry
- ⭕ WhatsApp-style **Status** (image/video, 30-second video cap, 24-hour expiry)
- 🗑️ **Server-side automatic deletion** via scheduled Cloud Functions (messages + status + media)
- 📱 Genuinely installable **PWA** (manifest + service worker + offline shell)
- 🎨 Light-blue, responsive UI (mobile bottom nav → desktop sidebar)
- 🔒 Strict **Firestore + Storage security rules**, server-authoritative
- ♿ Accessible, animated, reduced-motion aware

---

## 🧱 Tech stack

| Layer        | Tech |
|--------------|------|
| Frontend     | React 18, TypeScript, Vite 5, React Router 6, Tailwind CSS 3 |
| Backend      | Firebase Auth, Firestore, Storage, Cloud Functions (2nd gen) |
| PWA          | Web App Manifest, Service Worker, offline shell |
| Icons        | lucide-react |

---

## 🗂️ Project structure

```
vynq-chat/
├─ functions/            # Cloud Functions (auto-deletion, triggers)
├─ public/
│  ├─ icons/             # App icons (192/512 + SVG)
│  ├─ manifest.webmanifest
│  └─ sw.js              # service worker
├─ scripts/gen-icons.mjs # icon generation
├─ src/
│  ├─ components/         # ui/ + layout/ + feature components
│  ├─ context/           # AuthContext (Firebase user + profile + presence)
│  ├─ hooks/             # useChats, useRelations, useNotifications
│  ├─ lib/
│  │  ├─ firebase/       # config, app init, types
│  │  ├─ constants.ts     # retention + limits
│  │  ├─ validation.ts    # username/email/password
│  │  ├─ errorMap.ts      # friendly error messages
│  │  └─ time.ts
│  ├─ pages/             # route components
│  ├─ routes/            # ProtectedRoute, PublicOnlyRoute
│  ├─ services/          # auth, profile, friends, chat, media, status, notifications, account
│  ├─ App.tsx
│  └─ main.tsx
├─ firestore.rules
├─ storage.rules
├─ firestore.indexes.json
├─ firebase.json
└─ .firebaserc
```

---

## 🚀 Getting started (local dev)

### 1. Prerequisites
- Node.js 20+
- A Firebase project (free Spark plan is enough for local dev)

### 2. Install

```bash
npm install
node scripts/gen-icons.mjs   # generate PNG + SVG icons
```

### 3. Configure environment

Copy the example and fill in your Firebase **web app** config:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:5173. If Firebase env vars are missing, a setup screen guides you.

---

## 🔥 Firebase setup

### Authentication
1. Firebase Console → **Authentication → Sign-in method**
2. Enable **Email/Password**
3. (Optional) **Authentication → Templates** → customize the verification email

### Firestore
1. **Firestore Database → Create database** (production mode)
2. Deploy rules + indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The required composite indexes are in `firestore.indexes.json`.

### Storage
1. **Storage → Get started**
2. Deploy rules:

```bash
firebase deploy --only storage
```

Storage paths: `profilePictures/{uid}`, `chatMedia/{chatId}/{messageId}/{file}`, `statusMedia/{uid}/{statusId}/{file}`.

### Cloud Functions (auto-deletion)
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Scheduled functions:
- `cleanupExpiredMessages` — every 60 min (deletes messages > 7 days + their media)
- `cleanupExpiredStatuses` — every 30 min (deletes statuses > 24 hours + media)
- `onFriendRequestAccepted` — creates mutual friendship + notifies
- `onMessageCreated` — in-app notification to the recipient

> Cleanup is **idempotent** — re-runs are safe. Message text is never logged.

---

## 📦 Data model

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | Profile, privacy, presence |
| `users/{uid}/notifications` | In-app notifications |
| `friendRequests/{sortedPair}` | Requests (idempotent key) |
| `friendships/{sortedPair}` | Mutual connections |
| `chats/{chatId}` | Conversation metadata (`participants`, `lastMessage…`, `unread`) |
| `chats/{chatId}/messages/{msgId}` | Messages (`createdAt`, `expiresAt`, `status`) |
| `statuses/{statusId}` | Status (`createdAt`, `expiresAt`, `viewedBy`) |

**Deterministic IDs:** chat + friendship IDs are the sorted pair of the two UIDs, so duplicate 1:1 chats/friendships are impossible.

---

## 🔒 Security

- **Firestore rules** — users read only allowed profiles, create only legitimate requests, write messages only inside chats they belong to, update only their own data. Expiry enforced server-side.
- **Storage rules** — chat media readable only by chat participants; status media only by friends; strict content-type + size validation.
- **No fake backend** — all data lives in Firebase. No `localStorage` DB, no mocked auth.
- **No false E2EE claims** — the UI says "privacy-focused with automatic data expiration."

---

## 🧪 Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production build
npm run preview     # preview build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run verify      # typecheck + lint + build
npm run gen:icons   # (re)generate icons
```

---

## 📱 PWA

- Installable on desktop and mobile (manifest + icons).
- Offline shell: cached app shell + runtime caching; Firebase requests go straight to the network (not cached) so auth/data stay authoritative.
- Service worker only registers in production builds to avoid dev caching quirks.

---

## ⚠️ Retention policy (shown in-app)

- **Messages** — auto-delete after 7 days
- **Status** — auto-delete after 24 hours
- **Status videos** — max 30 seconds
- **Media** — deleted when its associated message/status expires

Server-side cleanup runs on a schedule; there can be a short delay before deletion is visible.

---

## 🚢 Deploy

1. Build + deploy everything:

```bash
npm run build
firebase login
firebase use --add   # link your project
firebase deploy
```

2. Or deploy pieces:

```bash
firebase deploy --only hosting
firebase deploy --only firestore
firebase deploy --only storage
firebase deploy --only functions
```

---

## 🧭 Roadmap / extensibility

The architecture leaves room for voice messages, documents, GIFs, reactions, dark mode, and (in theory) end-to-end encryption — message/media model is extensible.
