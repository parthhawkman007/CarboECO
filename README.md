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
- **Frontend**: Next.js (App Router), TypeScript, TailwindCSS, Framer Motion, Recharts, Radix UI (WCAG 2.2 AA).
- **Backend**: FastAPI, SQLAlchemy, NumPy, Pandas, Scikit-Learn (Predictive Linear Regression).
- **Database**: PostgreSQL (with automatic SQLite fallback for rapid local-only testing).
- **Caching**: Redis.
- **Monitoring**: Prometheus.
- **Containerization**: Docker & Docker Compose.
- **CI/CD**: GitHub Actions.
- **Hosting**: Firebase Hosting (Frontend) + Google Cloud Run (Backend).

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
4. Run the development server:
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

---

## ♿ Accessibility (WCAG 2.2 AA Target 100/100)
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
