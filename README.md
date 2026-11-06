# Smart Silo Monitoring System

A responsive React/Vite dashboard and FastAPI API for grain storage monitoring in Malawi. SQLite is used by default; `DATABASE_URL` can be changed to a supported SQLAlchemy PostgreSQL URL. Reading history is populated only by authenticated manual entry or the protected ESP32 ingestion endpoint; startup does not create sample silos, readings, or alerts.

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

Put the generated value in `backend\.env` as `JWT_SECRET_KEY=...`. To provision the first administrator, set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` (at least 8 characters), and optionally `INITIAL_ADMIN_NAME` in that file. This provisions the account once in the database, promotes an existing matching account, and does not change it on later restarts. Do not use a sample or shared password. Public registration creates operator accounts; an administrator must be provisioned to access administrative features. To enable ESP32 ingestion, set `ESP32_API_KEY` to a separate private key of at least 32 characters.

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

1. In Render, choose **New → Blueprint**, connect this GitHub repository, and deploy `render.yaml`. Set `CORS_ORIGINS` to your Vercel production origin (for example, `https://your-project.vercel.app`), `INITIAL_ADMIN_EMAIL`, and a private `INITIAL_ADMIN_PASSWORD`. Optionally set `INITIAL_ADMIN_NAME` in the service environment. The configured administrator is provisioned once in the persistent database; subsequent restarts/redeploys leave its account and password intact. The startup migrations are additive and do not delete existing silos or historical records. Set `ESP32_API_KEY` to a separate random value of at least 32 characters to enable device ingestion.
2. In Vercel, import this GitHub repository and set **Root Directory** to `frontend`. Use the default Vite build command (`npm run build`) and output directory (`dist`). Set the `VITE_API_URL` environment variable to `https://<your-render-service>.onrender.com/api`, then deploy.
3. Update Render's `CORS_ORIGINS` to the exact Vercel production origin and redeploy/restart the API. If you use Vercel preview deployments, add their origins too.

The Render Blueprint uses free plans to make a no-cost demo possible. Render's free web service can sleep while idle, and its free PostgreSQL database expires after 30 days. The database survives service restarts and redeploys, but use a paid persistent database plan for long-term storage and production availability.

## Authentication and roles

- Login uses backend-verified credentials and returns a short-lived JWT. The browser keeps it in `sessionStorage` for the current tab session.
- Public account creation always creates an operator account; users cannot grant themselves administrator access.
- Logging out only clears the browser's session token; it does not change the account. Administrator provisioning is one-time and uses `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and optionally `INITIAL_ADMIN_NAME`.
- Administrator accounts can also be created by an existing administrator. Public registration cannot grant administrator access.
- Operators only see data for silos assigned to their account. User management and settings routes require an administrator; protected API routes enforce authentication and administrative permissions as well.
- In production, set `APP_ENV=production` and a private `JWT_SECRET_KEY` of at least 32 characters. Keep `.env` out of source control and use HTTPS.

## API endpoints

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/users/`, `PATCH /api/users/{id}` (administrator)
- `GET/POST /api/silos/`, `GET/PATCH/DELETE /api/silos/{id}`
- `GET/POST /api/assignments/`, `DELETE /api/assignments/{user_id}/{silo_id}` (administrator)
- `GET/POST /api/readings/`, `GET /api/readings/latest`, `DELETE /api/readings/{id}` (manual readings only)
- `POST /api/readings/hardware` (ESP32 only; requires `X-Device-Key: <ESP32_API_KEY>`)
- `GET/POST /api/alerts/`, `PATCH /api/alerts/{id}/acknowledge`, `PATCH /api/alerts/{id}/resolve`
- `GET/POST /api/inspections/`
- `GET /api/reports/history?period=7d&data_source=hardware`
- `GET /api/reports/summary`

Reports accept `period=24h`, `7d`, or `30d`, an optional `silo_id`, and a `data_source` filter of `hardware` or `manual`. Protected endpoints require a Bearer token. Request validation uses Pydantic. Reading and report APIs exclude legacy simulated rows without deleting them. Hardware readings are labeled Hardware and accepted only through the ESP32-key-protected endpoint; manual readings require an authenticated user authorized for the silo. Hardware status is shown as online only when an ESP32 reading arrived within the last 15 minutes.

## Reports and reading history

The Reports page reads its chart, KPI cards, filters, and paginated log from the authenticated reports API. Charts, logs, and CSV exports are scoped to the selected data source, so manual readings are not presented as live hardware readings. It supports 24-hour, 7-day, and 30-day ranges, silo filtering, and CSV export. Manual readings can be deleted individually from the monitoring log; only administrators and operators assigned to the silo may delete them. Empty views display “No readings available.”
