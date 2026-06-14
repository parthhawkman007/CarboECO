from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram
import time
import logging
from collections import defaultdict

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seeding import seed_database

# Routers
from app.routers import (
    auth_router,
    carbon_router,
    ai_router,
    gamification_router,
    community_router,
    education_router,
    simulator_router,
    offset_router,
    websocket_router
)

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carboeco")

# Database table initialization
try:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
except Exception as e:
    logger.error(f"Failed to auto-migrate and seed database: {e}")

app = FastAPI(
    title=settings.APP_NAME,
    description="CarboECO - AI-powered Carbon Footprint Awareness Platform Backend API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Metrics Definition
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "http_status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"])

# In-memory Rate Limiting database
rate_limit_db = defaultdict(list)

def apply_security_headers(response: Response, is_production: bool = False) -> Response:
    """Apply OWASP-recommended security headers to every response."""
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; frame-ancestors 'none'; object-src 'none';"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=()"
    )
    if is_production:
        # HSTS: enforce HTTPS for 1 year, include subdomains
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    return response

# Rate limiter & Security Headers middleware
@app.middleware("http")
async def secure_and_limit_middleware(request: Request, call_next):
    # 0. Request payload size check (OWASP DoS protection)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 1024 * 1024:  # 1MB max
                logger.warning(f"Payload size limit exceeded: {content_length} bytes")
                return apply_security_headers(JSONResponse(
                    status_code=413,
                    content={"detail": "Payload too large. Maximum allowed size is 1MB."}
                ))
        except ValueError:
            pass

    # 1. Rate Limiting Check
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # Clean old requests
    rate_limit_db[client_ip] = [t for t in rate_limit_db[client_ip] if current_time - t < settings.RATE_LIMIT_PERIOD_SEC]
    
    # Check rate limit (exclude doc urls & metrics)
    if not any(x in request.url.path for x in ["/docs", "/openapi", "/redoc", "/metrics"]):
        if len(rate_limit_db[client_ip]) >= settings.RATE_LIMIT_CALLS:
            logger.warning(f"Rate limit exceeded for client IP: {client_ip}")
            return apply_security_headers(JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."}
            ))
        rate_limit_db[client_ip].append(current_time)

    # 2. Measure duration
    start_time = time.time()
    
    # 3. Call next middleware/endpoint
    response = await call_next(request)
    
    duration = time.time() - start_time

    # 4. Record Prometheus Metrics
    # Standardize path to avoid label cardinality explosion
    route_path = request.url.path
    if "/logs/" in route_path:
        route_path = "/api/carbon/logs/{id}"
    elif "/groups/" in route_path:
        route_path = "/api/community/groups/{id}"
    elif "/lessons/" in route_path:
        route_path = "/api/education/lessons/{id}/quiz"
        
    REQUEST_COUNT.labels(method=request.method, endpoint=route_path, http_status=response.status_code).inc()
    REQUEST_LATENCY.labels(method=request.method, endpoint=route_path).observe(duration)

    # 5. Security Headers (OWASP recommendations, CSP, Clickjacking protection, HSTS in prod)
    is_prod = settings.ENV.lower() == "production"
    return apply_security_headers(response, is_production=is_prod)

# Root router redirects/health checks
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": settings.APP_NAME, "time": time.time()}

# Prometheus metrics endpoint
@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Register endpoints routers
app.include_router(websocket_router.router)
app.include_router(auth_router.router, prefix="/api")
app.include_router(carbon_router.router, prefix="/api")
app.include_router(ai_router.router, prefix="/api")
app.include_router(gamification_router.router, prefix="/api")
app.include_router(community_router.router, prefix="/api")
app.include_router(education_router.router, prefix="/api")
app.include_router(simulator_router.router, prefix="/api")
app.include_router(offset_router.router, prefix="/api")

# General HTTP exception handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    # Log authentication or security-related failures
    if exc.status_code in [401, 403]:
        logger.warning(f"Security event: status={exc.status_code} path={request.url.path} detail={exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled system error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Our engineering team has been notified."}
    )
