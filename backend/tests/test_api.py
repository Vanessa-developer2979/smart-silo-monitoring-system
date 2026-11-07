"""Smoke tests for the fixes in this change set.

Run from backend/:  pip install pytest httpx && pytest -q
NOTE: written without being able to execute them (no network in the authoring sandbox).
"""
import os
import tempfile
from datetime import datetime, timedelta, timezone

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["JWT_SECRET_KEY"] = "t" * 48
os.environ["ESP32_API_KEY"] = "k" * 40
os.environ["INITIAL_ADMIN_EMAIL"] = "admin@example.com"
os.environ["INITIAL_ADMIN_PASSWORD"] = "correct-horse-battery"
os.environ["APP_ENV"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.main import app

DEVICE = {"X-Device-Key": "k" * 40}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]["id"]


@pytest.fixture(scope="module")
def silo_id(client, admin):
    r = client.post("/api/silos/", headers=admin[0], json={
        "name": "Test silo", "location": "Lilongwe", "grain_type": "Maize", "capacity_tonnes": 100})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_hardware_rejects_bad_key(client, silo_id):
    r = client.post("/api/readings/hardware", headers={"X-Device-Key": "x" * 40},
                    json={"silo_id": silo_id, "temperature_c": 20, "humidity_percent": 50})
    assert r.status_code == 401


def test_hardware_requires_temperature_and_humidity(client, silo_id):
    r = client.post("/api/readings/hardware", headers=DEVICE, json={"silo_id": silo_id})
    assert r.status_code == 422


def test_hardware_reading_marks_silo_online_even_in_manual_mode(client, admin, silo_id):
    r = client.post("/api/readings/hardware", headers=DEVICE,
                    json={"silo_id": silo_id, "temperature_c": 21.5, "humidity_percent": 55})
    assert r.status_code == 201, r.text
    silo = next(s for s in client.get("/api/silos/?data_source=manual", headers=admin[0]).json() if s["id"] == silo_id)
    assert silo["connection_status"] == "online"
    assert silo["latest_reading"] is None  # no manual readings yet


def test_future_timestamp_rejected(client, silo_id):
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    r = client.post("/api/readings/hardware", headers=DEVICE, json={
        "silo_id": silo_id, "temperature_c": 20, "humidity_percent": 50, "recorded_at": future})
    assert r.status_code == 422


def test_timestamps_are_returned_as_utc(client, admin, silo_id):
    r = client.get("/api/readings/?data_source=hardware", headers=admin[0])
    assert r.status_code == 200 and r.json()
    assert r.json()[0]["recorded_at"].endswith(("Z", "+00:00"))


def test_report_counts_cover_whole_range(client, admin, silo_id):
    r = client.get("/api/reports/history?period=24h&data_source=hardware", headers=admin[0])
    body = r.json()
    assert body["reading_count"] >= 1
    assert body["truncated"] is False
    assert body["average_temperature_c"] is not None


def test_duplicate_silo_name_on_update_is_409(client, admin, silo_id):
    other = client.post("/api/silos/", headers=admin[0], json={
        "name": "Other silo", "location": "Zomba", "grain_type": "Wheat", "capacity_tonnes": 50}).json()["id"]
    r = client.patch(f"/api/silos/{other}", headers=admin[0], json={"name": "Test silo"})
    assert r.status_code == 409


def test_admin_cannot_deactivate_self(client, admin):
    r = client.patch(f"/api/users/{admin[1]}?is_active=false", headers=admin[0])
    assert r.status_code == 400
