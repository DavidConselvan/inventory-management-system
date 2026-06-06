# Frontend

React + TypeScript SPA (Vite) for the inventory app. UI is built with Mantine,
server state with TanStack Query, and HTTP with Axios (including automatic JWT
refresh). See the [root README](../README.md) for the full picture.

## Scripts

```bash
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
```

Set `VITE_API_BASE_URL` (e.g. in `.env.local`) to point at the API; it defaults
to `http://localhost:8000/api`.

## Layout

- `src/api/` — Axios client and typed TanStack Query hooks per resource
- `src/auth/` — auth context, token storage, protected routes
- `src/components/` — app shell and shared UI
- `src/pages/` — login, register, dashboard, products, stock, orders
- `src/theme.ts` / `src/brand.css` — Mantine theme and brand tokens
