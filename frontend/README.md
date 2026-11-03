# HarvestGuard frontend

React 19, Vite, Tailwind CSS, React Router, Axios, Lucide React, and Recharts.

From this directory, install dependencies and start the frontend:

```powershell
npm install
npm run dev -- --host localhost
```

The app is served at `http://localhost:5173` and connects to the API configured by `VITE_API_URL` in `.env` (default: `http://127.0.0.1:8000/api`). The login route is a clearly labeled, unauthenticated demo role preview. For backend setup, API endpoints, data simulation notice, and security limitations, see the [project README](../README.md).
