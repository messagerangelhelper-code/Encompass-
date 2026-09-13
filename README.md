# Rideshare — real web app

This is the real, deployable version of the rider app, driver app, and admin
dashboard you tried in Claude. It's a Next.js project backed by Firebase
(real accounts, a real database, real-time updates instead of polling) —
built to deploy the same way you already deploy Integrity Records: push to
GitHub, connect to Vercel, set environment variables, done.

Three pages:
- `/rider` — rider app
- `/driver` — driver app
- `/admin` — admin dashboard

## What's real here vs. the Claude artifact version

- **Real accounts** — Firebase Authentication (email/password), not browser storage
- **Real database** — Firestore, so data persists properly and can scale to real users
- **Real-time, not polling** — rides and messages update instantly on both sides via Firestore listeners
- **Same design, same features** — Safety Toolkit, in-trip messaging, Waze navigation handoff, fare formula — all carried over unchanged

Still simulated: the map itself (a stylized grid, not real streets) and trip
distance/time (seeded off the destination text). Swapping in a real Google
Maps key later is a small, contained change — see "Adding real maps" below.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**
2. Name it (e.g. "rideshare-prod") and finish the wizard (Google Analytics is optional, skip it if you don't need it)
3. In the left sidebar, go to **Build → Authentication → Get started**, then enable the **Email/Password** sign-in method
4. Go to **Build → Firestore Database → Create database** — start in **production mode**, pick a region close to you
5. Once created, go to the **Rules** tab and paste in the contents of `firestore.rules` from this project, then **Publish**
6. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web) icon to register a new web app → copy the config values shown (`apiKey`, `authDomain`, etc.)

## 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in the values from step 1 (for local testing). For the real deployment, add the same variables in **Vercel → Project Settings → Environment Variables** — same pattern you already use for the Integrity Records Stripe keys.

## 3. Deploy

Same flow as your existing projects:

```bash
npm install
git init
git add .
git commit -m "Initial rideshare app"
```

Push this to a new GitHub repo, then in Vercel: **Add New → Project → Import** that repo. Vercel auto-detects Next.js — no special build config needed. Add the environment variables from step 2, then deploy.

Once deployed, you'll have a real URL (e.g. `rideshare.vercel.app`) with `/rider`, `/driver`, and `/admin` all live.

## 4. Try it on your phone

Once deployed, open the `/rider` URL in Safari on your phone, tap the **Share** button, then **Add to Home Screen**. It'll behave like an installed app (its own icon, opens full-screen) without needing the App Store — this is a PWA (Progressive Web App). Do the same for `/driver` if you want it as a separate icon.

## Adding real maps later

Once you have a Google Maps API key, the only file that needs real changes is `components/CityMap.jsx` (swap the SVG for a real `<Map>` component) and `lib/fare.js` (swap `seededTrip()` for a real Directions API call). Every screen that uses them already expects the same shape of data back, so the rest of the app doesn't need to change.

## Adding payments later

Nothing payment-related is wired in yet, on purpose — you're still deciding between Stripe, PayPal/Braintree, and others, and your Stripe account is mid-verification anyway. When you're ready, the natural place to add it is right after `updateRide(ride.id, { status: "completed" })` in `app/driver/page.js` — that's the moment a charge would actually get captured.

## Known limitations to know about going in

- **Firestore security rules are intentionally loose** for now (any signed-in user can read/write any ride) so the app works without a backend server. Before real users touch this, tighten `firestore.rules` so only the ride's actual rider/driver can update it.
- **No backend validation** — a rider's app currently sets its own fare client-side. For production you'd want a Cloud Function to calculate and lock the fare server-side so it can't be tampered with.
- **Waze navigation** uses the free Deep Links approach — one-way handoff, no data back. The Transport SDK (if you apply and get approved) would replace this.
