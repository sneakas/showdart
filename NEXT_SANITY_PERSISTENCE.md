# Cloud Persistence Setup (Next.js + Sanity + Vercel)

This project now saves tournament progress to `GET/PUT /api/tournament-state`.

## 1) Install dependency in your Next.js app

```bash
npm install @sanity/client
```

## 2) Add environment variables (Vercel + local `.env.local`)

Use values from `.env.example`.

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_VERSION`
- `SANITY_API_WRITE_TOKEN` (must have write access)

## 3) Register schema in Sanity Studio

Ensure `sanity/schemas/index.ts` exports `tournamentState` and is used by your Sanity config.

## 4) Deploy API route

The API route is at:

- `app/api/tournament-state/route.ts`

## 5) Client behavior

`index.html` now:

- loads state on startup from `/api/tournament-state?id=showdart-default`
- autosaves after user actions
- flushes a save attempt on page unload

## Notes

- Tournament key is currently hardcoded to `showdart-default` in `index.html`.
- For multiple tournaments, set a dynamic ID in `CLOUD_PERSISTENCE.tournamentId`.
