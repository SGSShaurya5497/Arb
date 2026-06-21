"""
test_spreads.py — test suite for spreads and alerts endpoints.
"""

from datetime import datetime, timezone
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.assets import Asset
from app.models.spread import Spread


def test_get_current_spreads_200(client: TestClient, db_session: Session, auth_headers: dict):
    # Setup mock data
    asset_id = uuid.uuid4()
    db_session.add(Asset(id=asset_id, symbol="TESTETF", name="Test ETF", asset_type="ETF", exchange_primary="NSE"))
    db_session.add(Spread(id=1, asset_id=asset_id, spread_bps=12.5, z_score=1.5, captured_at=datetime.now(timezone.utc)))
    db_session.commit()

    res = client.get("/api/v1/spreads/current", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["asset"]["symbol"] == "TESTETF"
    assert data[0]["latest_spread"]["spread_bps"] == "12.5000"


def test_get_spread_history_200_and_pagination(client: TestClient, db_session: Session, auth_headers: dict):
    asset_id = uuid.uuid4()
    db_session.add(Asset(id=asset_id, symbol="HISTETF", name="History ETF", asset_type="ETF", exchange_primary="NSE"))
    
    # Add 25 spreads
    now = datetime.now(timezone.utc)
    for i in range(25):
        db_session.add(Spread(id=i+1, asset_id=asset_id, spread_bps=i*1.0, z_score=0.5, captured_at=now))
    db_session.commit()

    # Request page 1, size 20
    res = client.get(f"/api/v1/spreads/{asset_id}/history?page=1&page_size=20", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 25
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert len(data["items"]) == 20

    # Request page 2, size 20 (should return 5 items)
    res2 = client.get(f"/api/v1/spreads/{asset_id}/history?page=2&page_size=20", headers=auth_headers)
    assert len(res2.json()["items"]) == 5


def test_get_spread_history_invalid_uuid_404(client: TestClient, auth_headers: dict):
    invalid_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/spreads/{invalid_uuid}/history", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == f"Asset {invalid_uuid} not found"


def test_get_alerts_200(client: TestClient, db_session: Session, auth_headers: dict):
    asset_id = uuid.uuid4()
    db_session.add(Asset(id=asset_id, symbol="ALERTETF", name="Alert ETF", asset_type="ETF", exchange_primary="NSE"))
    
    # 1 normal, 2 extreme (one positive, one negative)
    now = datetime.now(timezone.utc)
    db_session.add_all([
        Spread(id=1, asset_id=asset_id, spread_bps=5.0, z_score=0.5, captured_at=now),    # should not be in alerts
        Spread(id=2, asset_id=asset_id, spread_bps=20.0, z_score=2.5, captured_at=now),   # should be in alerts
        Spread(id=3, asset_id=asset_id, spread_bps=-20.0, z_score=-3.5, captured_at=now), # should be in alerts (highest severity)
    ])
    db_session.commit()

    # Default threshold is 2.0
    res = client.get("/api/v1/alerts/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    
    assert data["total"] == 2
    assert len(data["items"]) == 2
    
    # Should be sorted by severity desc, so -3.5 (severity 3.5) comes first
    assert data["items"][0]["z_score"] == "-3.5000"
    assert data["items"][0]["severity"] == 3.5
    
    assert data["items"][1]["z_score"] == "2.5000"
    assert data["items"][1]["severity"] == 2.5


def test_rate_limit_triggers_429(client: TestClient, auth_headers: dict):
    # Make 101 requests to trigger the 100/minute rate limit
    for _ in range(100):
        client.get("/api/v1/spreads/current", headers=auth_headers)
        
    res = client.get("/api/v1/spreads/current", headers=auth_headers)
    assert res.status_code == 429
    assert "Rate limit exceeded" in res.text
