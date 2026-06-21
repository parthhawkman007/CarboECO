# CarboECO 🌿

> **"Track Smarter. Live Greener. Reduce Your Carbon Footprint."**

CarboECO is an enterprise-grade, AI-powered Carbon Footprint Awareness Platform designed to help individuals understand, track, predict, and reduce their environmental impact through intelligent analytics, personalized sustainability coaching, gamified eco-actions, and real-world carbon reduction strategies.

---

## 🏗️ System Architecture

The CarboECO platform is built using a modern, scalable monorepo structure:

```
                  +--------------------------------+
                  |       Next.js Frontend         |
                  |  (TailwindCSS, Framer Motion,  |
                  |     Recharts, Radix UI)        |
                  +---------------+----------------+
                                  |
                                  | HTTP REST / JWT
                                  v
                  +--------------------------------+
                  |        FastAPI Backend         |
                  |  (Scikit-Learn Trend Engine,   |
                  |   SlowAPI, Prometheus Metrics) |
                  +--------+--------------+--------+
                           |              |
           ORM (SQLAlchemy)|              | Caching
                           v              v
                  +--------+-----+  +-----+--------+
                  |  PostgreSQL  |  | Redis Cache  |
                  |   Database   |  |              |
                  +--------------+  +--------------+
```

### Stack Components
- **Frontend**: Next.js (App Router), TypeScript, TailwindCSS, Framer Motion, Recharts (WCAG 2.2 AA).
- **Backend**: FastAPI, SQLAlchemy, NumPy, Pandas, Scikit-Learn (Predictive ML (Gradient Boosting Regressor)).
- **Database**: PostgreSQL (with automatic SQLite fallback for rapid local-only testing).
- **Caching**: Redis.
- **Monitoring**: Prometheus.
- **Containerization**: Docker & Docker Compose.
- **CI/CD**: GitHub Actions.
- **Hosting**: Firebase Hosting (Frontend) + Google Cloud Run (Backend).

---

## 🌍 Impact & Business Model

CarboECO is designed as a freemium sustainability platform aligned with the UN SDG 13 (Climate Action):

### Value Proposition
- **Individuals**: Free carbon tracking, AI coaching, and gamification to build sustainable habits
- **Enterprises**: Team dashboards, bulk offset purchases, and ESG reporting (B2B tier)
- **NGOs & Governments**: White-label deployment for regional sustainability programs

### Revenue Streams
1. **Carbon Offset Marketplace [DEMO MODE]**: 5% platform fee on verified carbon credit purchases (simulated demo sandbox active).
2. **CarboECO Pro** (€9.99/month): Advanced AI insights, unlimited history, premium challenges
3. **Enterprise API** (custom pricing): Embeddable carbon tracking widgets for corporate sustainability
4. **Data Insights** (anonymized, opt-in): Aggregate behavioral data for climate research partnerships

### Scalability Path
- Current: Firebase Hosting (CDN) + Google Cloud Run (auto-scale to 1000+ req/s)
- Year 1: 100K users, break-even via marketplace fees
- Year 3: 1M users, enterprise tier, government partnerships

### UN SDG Alignment
- **SDG 13** (Climate Action): Core mission — empowering individuals to measure and reduce footprint
- **SDG 12** (Responsible Consumption): Shopping and food carbon tracking
- **SDG 11** (Sustainable Cities): Community challenges and public transport incentives
- **SDG 17** (Partnerships): Open API for NGO and government integration

---

## ⚡ Quick Start

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose (optional but recommended)

### Option 1: Docker Compose (Recommended)
Launch the entire stack (Database, Cache, API, and Frontend) in a single command:
```bash
docker-compose up --build
```
- Frontend will be available at: `http://localhost:3000`
- Backend API Docs at: `http://localhost:8000/api/docs`
- Prometheus Metrics at: `http://localhost:8000/metrics`

---

### Option 2: Local Manual Setup

#### 1. Backend (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run Redis locally:
   - On Windows: Run Redis via WSL (`sudo service redis-server start`) or use Memurai.
   - On macOS: Run `brew install redis && brew services start redis`
   *(Note: Redis is required for rate limiting and WebSocket tickets in multi-worker scenarios. The CacheService will gracefully fallback to guest/local memory mode if Redis is temporarily offline.)*
5. Run the development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

*(Note: The backend automatically falls back to an in-memory SQLite database (`carboeco_dev.db`) and seeds initial courses/badges/users if PostgreSQL is not active locally.)*

#### 2. Frontend (Next.js)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Launch development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your web browser.

---

## 🧪 Testing Strategy

CarboECO implements a comprehensive test suite across client and server layers:

### Run Backend Tests (pytest)
```bash
cd backend
pytest --cov=app tests/
```
Coverage includes authorization filters, carbon calculation coefficients, linear regression forecasts, and database cascade operations.

### Run Frontend Tests (Vitest)
```bash
cd frontend
npm run test
```

### Additional Test Suites
- **Property-Based Tests**: Hypothesis tests verify mathematical invariants in emission calculations
- **Contract Tests**: Schemathesis validates all API endpoints against the OpenAPI spec
- **Load Tests**: k6 load test suite (see `k6/` directory). Run: `k6 run k6/load_test.js`
- **E2E Tests**: Full Playwright user journey tests: `npm run test:e2e`

---

## ♿ Accessibility (WCAG 2.2 AA Compliant)
- **Keyboard Navigation**: Full focus ring indicator states across interactive elements.
- **Aria Labels**: Comprehensive `aria-label` and `aria-pressed` tagging for screen readers.
- **Contrast Ratios**: Custom High Contrast accessibility mode toggling black and yellow contrast sets.
- **Semantic HTML**: Standardized use of semantic landmarks (`<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`).

---

## 🔒 Security Measures
- **OWASP Top 10 Protections**: Automatic CORS filters, Content Security Policy (CSP), Clickjacking headers, and XSS sanitizations.
- **Rate Limiting**: Built-in middleware limits request frequency to prevent DDoS and brute-force scans.
- **JWT Authentication**: Secure stateless token authentication with custom password hashing.
- **RBAC**: Role-based access control filters restricting database modifications.
