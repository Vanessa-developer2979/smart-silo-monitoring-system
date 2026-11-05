# Smart Silo Monitoring System

A responsive React/Vite dashboard and FastAPI API for grain storage monitoring in Malawi. SQLite is used by default; `DATABASE_URL` can be changed to a supported SQLAlchemy PostgreSQL URL.

Sensor readings created during initial setup are simulated demonstration data. No physical IoT integration is connected. The demo uses one silo named Local Silo.

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+

## Backend setup (Windows PowerShell)

From the project root:

```powershell
cd .\backend
Copy-Item .env.example .env
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the generated value in `backend\.env` as `JWT_SECRET_KEY=...`. To provision the first administrator, also set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` (at least 8 characters), and optionally `INITIAL_ADMIN_NAME` in that file. Do not use a sample or shared password. If no admin is provisioned, a new operator account can be created from the login screen; an administrator must be provisioned to access administrative features.

Start the API:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is at `http://127.0.0.1:8000`, health check at `http://127.0.0.1:8000/health`, and Swagger UI at `http://127.0.0.1:8000/docs`. The database is created at `backend\smart_silo.db`.

## Frontend setup (separate PowerShell window)

From the project root:

```powershell
cd .\frontend
Copy-Item .env.example .env
npm install
npm run dev -- --host localhost
```

Vite serves the frontend at `http://localhost:5173`. `VITE_API_URL` defaults to `http://127.0.0.1:8000/api`.

## Deployment

The frontend is a Vite single-page app for Vercel; the FastAPI backend and PostgreSQL database are configured as a Render Blueprint in `render.yaml`.

1. In Render, choose **New → Blueprint**, connect this GitHub repository, and deploy `render.yaml`. The demo deployment enables `DEMO_MODE_ENABLED` so operator accounts can view the generated Local Silo and readings. The first backend startup after this update permanently removes every other silo and its readings, alerts, inspections, and operator assignments. The blueprint prompts for `CORS_ORIGINS`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD`. For the first deployment, set `CORS_ORIGINS` to `http://localhost:5173`; after Vercel provides a URL, update it to that origin (for example, `https://your-project.vercel.app`). Use a private, unique admin password.
2. In Vercel, import this GitHub repository and set **Root Directory** to `frontend`. Use the default Vite build command (`npm run build`) and output directory (`dist`). Set the `VITE_API_URL` environment variable to `https://<your-render-service>.onrender.com/api`, then deploy.
3. Update Render's `CORS_ORIGINS` to the exact Vercel production origin and redeploy/restart the API. If you use Vercel preview deployments, add their origins too.

The Render Blueprint uses free plans to make a no-cost demo possible. In this demo configuration, unassigned operator accounts can access the generated Local Silo; set `DEMO_MODE_ENABLED=false` before using real silo data. Render's free web service can sleep while idle, and its free PostgreSQL database expires after 30 days; do not use this configuration for production or durable data. Upgrade the Render database and API to plans that meet your availability and storage needs before relying on them.

## Authentication and roles

- Login uses backend-verified credentials and returns a short-lived JWT. The browser keeps it in `sessionStorage` for the current tab session.
- Public account creation always creates an operator account; users cannot grant themselves administrator access.
- When `DEMO_MODE_ENABLED=true`, unassigned operator accounts are given access to the simulated Local Silo. This is for demonstrations only; set it to `false` when using real silo data.
- Administrator accounts are provisioned through the backend environment or by an existing administrator. The login page does not display shared test credentials or offer demo/role-preview access.
- Operators only see data for silos assigned to their account. User management and settings routes require an administrator; protected API routes enforce authentication and administrative permissions as well.
- Sample users from the original demo database have no passwords and are inactive. Provision an administrator or create a new operator account; do not rely on the sample names as login accounts.
- In production, set `APP_ENV=production` and a private `JWT_SECRET_KEY` of at least 32 characters. Keep `.env` out of source control and use HTTPS.

## API endpoints

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/users/`, `PATCH /api/users/{id}` (administrator)
- `GET/POST /api/silos/`, `GET/PATCH/DELETE /api/silos/{id}`
- `GET/POST /api/assignments/`, `DELETE /api/assignments/{user_id}/{silo_id}` (administrator)
- `GET/POST /api/readings/`, `GET /api/readings/latest`
- `GET/POST /api/alerts/`, `PATCH /api/alerts/{id}/acknowledge`, `PATCH /api/alerts/{id}/resolve`
- `GET/POST /api/inspections/`
- `GET /api/reports/history?period=7d&data_source=simulation`
- `GET /api/reports/summary`

Reports accept `period=24h`, `7d`, or `30d`, an optional `silo_id`, and a `data_source` filter. Protected endpoints require a Bearer token. Request validation uses Pydantic. Reading submissions accept `data_source` values `simulation`, `hardware`, or `manual`. Hardware status is shown as online only when a hardware reading arrived within the last 15 minutes; selecting hardware mode does not connect a device.

## Reports and demonstration data

The Reports page reads its chart, KPI cards, filters, and paginated log from the authenticated reports API. It supports 24-hour, 7-day, and 30-day ranges, silo filtering, and CSV export. Initial demo data provides 30 days of hourly simulated readings for Local Silo. The UI labels simulation data; these values are not hardware measurements.
