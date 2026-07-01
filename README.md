<div align="center">

# 📈 Arb

### Real-Time ETF Arbitrage Tracker

*A production-style fintech dashboard that detects and monitors price arbitrage opportunities in Indian ETFs*

[![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Streams-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

[Overview](#-what-is-this) • [Dashboard](#-live-dashboard) • [Architecture](#-how-the-system-works) • [Setup](#-how-to-run) • [Strategy](#-how-can-an-individual-make-money-from-this) • [Bug Log](#-bugs-fixed-full-log)

</div>

---

## 🧭 What Is This?

Indian ETFs trade on the NSE at a **market price**, but each one also has a **NAV** (Net Asset Value) — the true value of the assets it holds. These two numbers should track each other almost perfectly. But liquidity crunches, heavy order flow, or breaking news can pull them apart for a moment.

That gap is the **spread** — and it's a real, measurable, exploitable arbitrage signal.

> **Arb watches that gap live across 5 major Indian ETFs, scores how unusual it is statistically, and raises an alert the moment it crosses into "this doesn't happen often" territory.**

---

## 🖥️ Live Dashboard

A trading-terminal-style UI, inspired by Bloomberg and TradingView:

| Component | What it does |
|---|---|
| 🗂️ **SpreadTable** | Dense, sortable table of every tracked ETF with live color-coded Z-scores. Rows flash on update. |
| 📉 **BasisChart** | 30-day spread history with ±2σ reference bands |
| 📡 **LiveFeed** | Real-time ticker strip of the last 10 WebSocket events |
| 🚨 **Alerts** | Active anomalies ranked by severity (`|Z| > 2`) |

---

## ⚙️ How the System Works

```
[External APIs]  →  [Backend Pipeline]  →  [Live Dashboard]
  Yahoo Finance       Collects prices        React terminal
  MFAPI (NAVs)        Computes spreads       SpreadTable
                      Detects anomalies      BasisChart
                      Stores history          Live Alerts
```

### 1️⃣ Data Collection — Celery

A background worker runs **every 15 seconds** during NSE market hours (Mon–Fri, 9:15 AM – 3:30 PM IST). For each ETF:

1. Fetch **market price** from Yahoo Finance
2. Fetch **NAV** from MFAPI
3. Compute the **spread in basis points** (1 bps = 0.01%)
4. Compute a **Z-score** — how unusual the current spread is against the last 20 readings
5. Persist to PostgreSQL and publish to **Redis Streams** for live delivery

### 2️⃣ API — FastAPI

JWT-authenticated REST API + WebSocket server:

| Endpoint | Description |
|---|---|
| `POST /auth/register` | Create account |
| `POST /auth/token` | Login, receive JWT |
| `GET /api/v1/spreads/current` | Latest snapshot of all ETFs |
| `GET /api/v1/spreads/{id}/history` | Paginated 30-day history |
| `GET /api/v1/alerts/` | Extreme spreads, sorted by severity |
| `WS /ws/spreads` | Live WebSocket stream |

### 3️⃣ Dashboard — React

Built with **React + TypeScript + Vite + Tailwind CSS**:

- Per-row flash effect (step-function, 280ms) on live updates
- Exponential-backoff WebSocket reconnection (1s → 2s → 4s → … cap 30s)
- JetBrains Mono for all numeric data (tabular lining figures)
- Fully restyled Recharts — no default blue lines, custom amber-gold accent

---

## 📊 Tracked ETFs

| Symbol | Fund | Tracks |
|---|---|---|
| `NIFTYBEES` | Nippon India ETF Nifty BeES | Nifty 50 index |
| `JUNIORBEES` | Nippon India ETF Junior BeES | Nifty Next 50 |
| `BANKBEES` | Nippon India ETF Bank BeES | Bank Nifty index |
| `GOLDBEES` | Nippon India ETF Gold BeES | Gold price |
| `CPSEETF` | Nippon India ETF CPSE | Public sector companies |

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Python |
| Database | PostgreSQL + SQLAlchemy + Alembic |
| Cache / Event Bus | Redis (Hashes, Lists, Streams) |
| Background Jobs | Celery + Celery Beat |
| Authentication | JWT (python-jose + passlib/bcrypt) |
| Rate Limiting | slowapi |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Charts | Recharts (fully restyled) |
| Containers | Docker + Docker Compose |
| Testing | pytest + fakeredis + SQLite in-memory |

</div>

---

## 🚀 How to Run

```bash
# 1. Clone the repo
git clone https://github.com/SGSShaurya5497/Arb.git
cd Arb

# 2. Start everything (Postgres, Redis, FastAPI, Celery)
docker compose up --build

# 3. Start the frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** → Register an account → Done. ✅

> The collector starts fetching data automatically during NSE market hours (Mon–Fri, 9:15 AM – 3:30 PM IST).

---

## 💰 How Can an Individual Make Money From This?

### The Core Mechanic

Every ETF has two prices at once:

- **Market Price** — what it's trading at on NSE right now
- **NAV** — the actual value of the assets *inside* the fund

These should be nearly identical. When they're not, that gap is the opportunity.

<table>
<tr>
<td width="50%" valign="top">

**📈 Scenario 1 — Premium** (`Price > NAV`)

*Example: NIFTYBEES price ₹274, NAV ₹271 → 30 bps premium*

The ETF is temporarily overpriced.

- **Retail signal:** Don't buy right now — you're overpaying. Wait for compression, or use the equivalent index mutual fund.
- **Pro play:** Short the ETF + buy the underlying stocks. Close both legs when the gap closes — it always does.

</td>
<td width="50%" valign="top">

**📉 Scenario 2 — Discount** (`Price < NAV`)

*Example: GOLDBEES price ₹58.10, NAV ₹58.25 → -25 bps discount*

The ETF is cheaper than what it holds.

- **Retail signal:** Buy it. The discount closes — a small risk-adjusted gain on top of the underlying asset's return.
- **Why it closes:** Authorized Participants can redeem ETF units for the underlying assets at NAV. This mechanism structurally forces price back toward NAV.

</td>
</tr>
</table>

### The Z-Score Is the Key Signal

Raw spreads are noisy — 15 bps might be normal for GOLDBEES but extreme for NIFTYBEES. Z-score normalizes across ETFs:

| Z-Score | Meaning | Action |
|---|---|---|
| 0 to ±1 | Normal | Ignore |
| ±1 to ±2 | Slight deviation | Watch |
| **±2 to ±3** | **Historically unusual (top 5%)** | **Consider acting** |
| **> ±3** | **Extremely rare (top 0.3%)** | **Strong signal** |

### Real Limitations

| Limitation | Detail |
|---|---|
| Spreads are tiny | 5–30 bps → ₹50–300 on ₹1L before costs |
| Costs eat profits | Works best at ₹10L+ scale or zero-brokerage accounts |
| Gaps close fast | Institutions arbitrage in milliseconds — retail gets the tail end |
| Less liquid ETFs | GOLDBEES/CPSEETF spreads can persist longer — opportunity *and* risk |

### Realistic Retail Use Cases

1. **Better entry timing** — don't buy when the premium is unusually high; wait it out
2. **Market stress detector** — large sustained discounts (`Z < -3`) often signal institutional selling before it shows in the index
3. **Research tool** — the BasisChart reveals each ETF's normal spread range, teaching you the fund's character

> The professional version of exactly this is what quant desks at Mirae Asset, DSP, and Nippon AMC run internally. **Arb is a stripped-down version of that same system — built end-to-end.**

---

## 🗂️ Project Structure

```
arb/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers (auth, spreads, alerts, ws)
│   │   ├── core/         # Config, DB, Redis, security, deps
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/     # DB query logic (spread_service.py)
│   ├── collector/
│   │   ├── tasks.py          # Celery tasks: collect_etf_prices, compute_spreads
│   │   ├── data_sources.py   # Yahoo Finance + MFAPI fetchers
│   │   └── spreads.py        # Spread + z-score math
│   ├── alembic/           # DB migrations
│   └── tests/              # pytest suite (12 tests, all passing)
├── frontend/
│   └── src/
│       ├── components/   # SpreadTable, BasisChart, LiveFeed, AlertsPanel
│       ├── hooks/         # useWebSocket, useSpreads
│       └── types/          # TypeScript types matching backend schema
└── docker-compose.yml    # Postgres + Redis + Backend + Celery Worker + Beat
```

---

## 🐛 Bugs Fixed (Full Log)

<details>
<summary><strong>20 bugs identified and fixed across every phase of development — click to expand</strong></summary>

<br>

**Data Layer & Collector**

| # | Bug | Fix |
|---|---|---|
| 1 | Alembic migration failed — `symbol` column too short | Widened to `String(50)`, `name` to `String(200)` |
| 2 | UUID generation failed on raw SQL inserts | Added `server_default=gen_random_uuid()` via migration |
| 3 | Z-scores always `0.000` | Changed yfinance from `period="1d"` to `interval="1m"` for live intraday price |
| 4 | NAVs 100%+ wrong | Corrected MFAPI scheme codes for both ETFs |

**FastAPI Backend**

| # | Bug | Fix |
|---|---|---|
| 5 | `ImportError` on startup — missing `email-validator` | Added to `requirements.txt` |
| 6 | `RuntimeError` on login — missing `python-multipart` | Added to `requirements.txt` |
| 7 | Password hashing crash — `passlib` + `bcrypt` 4.x incompatibility | Pinned `bcrypt<4.0.0` |
| 8 | Test suite `NOT NULL` failure on SQLite | Provided explicit `id=` in test fixtures |
| 9 | WebSocket test received real Celery data instead of mock | Patched `get_redis` at fixture level before app boots |

**React Frontend**

| # | Bug | Fix |
|---|---|---|
| 10 | Login showed "Incorrect password" — no way to register | Added Register tab to login panel |
| 11 | Auth URL malformed (`/api/v1/../auth/token`) | Fixed to `/auth/token` |
| 12 | `useClock` used `useState` for a side effect — timer leak | Replaced with `useEffect` + cleanup |
| 13 | WebSocket blocked entire FastAPI server for 500ms | Wrapped `r.xread()` in `asyncio.to_thread()` |
| 14 | SpreadTable Z-score never updated live | Added `r.xadd()` to `compute_spreads` task |
| 15 | New ETFs never appeared in the table | Added `seed_assets()` on backend startup |
| 16 | "3s ago" timestamps froze permanently | Added `useTimestampTick()` to force re-render every 5s |
| 17 | Expired JWT silently broke dashboard | Auto-logout on `error === 'Unauthorized'` |
| 18 | CORS blocked port 5174 | Added `http://localhost:5174` to `CORS_ORIGINS` |
| 19 | Alerts endpoint had no UI | Built `AlertsPanel.tsx` with severity sorting |
| 20 | Collector ran 24/7 including weekends | Added IST market hours gate (`_is_market_open()`) |

</details>

---

<div align="center">

**Built with FastAPI · React · Redis · PostgreSQL · Celery · Docker**

⭐ *If you find this interesting, a star helps a lot* ⭐

</div>
