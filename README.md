# Shared Todo List

A real-time collaborative Todo List built with React, Vite and Supabase. Create a
list, share its link, and everyone on that link sees adds, completions and
deletes instantly. No login required.

## How it works

Each list has an unguessable ID and lives at `/list/:listId`. Tasks are stored in
Supabase Postgres and every client subscribes to Supabase Realtime for its own
`list_id`, so changes made by one person appear immediately for the others.

## Tech stack

- React 19 + Vite
- React Router for the `/list/:listId` route
- Supabase Postgres for storage and Supabase Realtime for live sync
- Netlify for hosting

## Local setup

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Use only the public (anon / publishable) key. Never put the `service_role` key in
this app, and never commit `.env`.

Then start the dev server:

```bash
npm run dev
```

## Database setup

Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
It creates the `lists` and `todos` tables, indexes, Row Level Security policies,
and enables Realtime for `todos`.

Because there is no login, the list ID in the URL acts as the secret: anyone with
the link can read and write that list. `REPLICA IDENTITY FULL` on `todos` is
required so DELETE events include `list_id` and can be filtered by the client.

## Deploying to Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Vite reads env variables at build time, so they must exist in Netlify before the
build runs. SPA routing is handled by `netlify.toml` and `public/_redirects`, so
direct links such as `/list/abc123` do not 404.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
