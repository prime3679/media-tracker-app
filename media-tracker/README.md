# Media Tracker

Full-stack media tracking app with a React + Vite frontend and an Express API.

## Stack
- React 19 + Vite + TypeScript
- Express API (`server/api.ts`)
- PostgreSQL via Drizzle ORM (uses `DATABASE_URL`)
- Vitest + Playwright for testing

## Development
Install dependencies and start both API + client:

```bash
npm install
npm run dev
```

Client-only or API-only:

```bash
npm run dev:client
npm run dev:api
```

## Database
Drizzle migration and seed helpers:

```bash
npm run db:migrate
npm run seed:genres
npm run seed:catalog
```

See `../MIGRATION_STEPS.md` for detailed migration steps.

## Tests

```bash
npm run test
npm run lint
npm run typecheck
```

## Quick Add Prototype
Design notes and demo flow live in `../QUICK_ADD_README.md`.
