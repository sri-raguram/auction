# Corporate Premier League — Auction Server

A single Node server (no dependencies) that serves the auction app and holds
the shared live data (teams, players, bids, purses) for the day.

## Deploy on Render (free)

1. Push this folder to a new GitHub repo (public or private).
2. On [render.com](https://render.com), click **New +** → **Web Service**.
3. Connect the repo (or paste its public URL under "Public Git Repository").
4. Settings:
   - **Runtime**: Node
   - **Build Command**: (leave blank — no dependencies)
   - **Start Command**: `node server.js` (Render should auto-detect this from `package.json`)
   - **Instance Type**: Free
5. Deploy. Render gives you a `https://<something>.onrender.com` link — that's
   the one link everyone uses (Admin, Captains, Public View all pick their
   role from the same page).

Note: on Render's free tier, the service sleeps after 15 minutes with no
traffic and takes ~30-50 seconds to wake up on the next visit. Once people
are actively using it during the auction, it stays awake.

## Running locally

```
node server.js
```

Then open `http://localhost:8787` (or whatever port you set via the `PORT`
environment variable).

Data persists to `local-db.json` next to `server.js` — delete that file (or
use the in-app **Reset Auction** button) to start fresh.
