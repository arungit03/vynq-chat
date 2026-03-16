# A3Chat

React + Vite chat app backed by Firebase Authentication and Firestore.

## Environment variables

Firebase config is loaded from Vite environment variables. Keep your real values in a local `.env` file and only commit `.env.example`.

Required keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_FIREBASE_MEASUREMENT_ID`

## Development

1. Install dependencies with `npm install`.
2. Create your local `.env` from `.env.example` and fill in your Firebase project values.
3. Start the app with `npm run dev`.

## Build

- `npm run build`
- `npm run preview`
