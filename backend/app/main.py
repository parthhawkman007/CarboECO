from fastapi import FastAPI, Request, Response, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram
import time
import logging
import uuid
import contextvars
import ipaddress
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.seeding import seed_database
from app.services.cache import CacheService

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

# ContextVar for tracing Request IDs
request_id_ctx = contextvars.ContextVar("request_id", default=None)

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_ctx.get() or "no-request-id"
        return True

# Logger setup
from pythonjsonlogger import jsonlogger
handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter(
    "%(asctime)s %(levelname)s %(request_id)s %(name)s %(message)s"
))
handler.addFilter(RequestIdFilter())
logger = logging.getLogger("carboeco")
logger.setLevel(logging.INFO)
logger.addHandler(handler)
logger.propagate = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Database migration and seeding on start
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            await seed_database(db)
        logger.info("Successfully initialized and seeded database (Async Lifespan).")
    except Exception as e:
        logger.error(f"Failed to auto-migrate and seed database: {e}")
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="CarboECO - AI-powered Carbon Footprint Awareness Platform Backend API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Prometheus Metrics Definition
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "http_status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"])

# In-memory rate limiting database fallback
rate_limit_db = defaultdict(list)

def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP from the request. Protects against X-Forwarded-For 
    spoofing by validating against settings.TRUSTED_PROXIES.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    xff = request.headers.get("x-forwarded-for")
    if xff:
        is_trusted = False
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
            for proxy in settings.TRUSTED_PROXIES:
                if "/" in proxy:
                    if client_ip_obj in ipaddress.ip_network(proxy):
                        is_trusted = True
                        break
                else:
                    if client_ip_obj == ipaddress.ip_address(proxy):
                        is_trusted = True
                        break
        except ValueError:
            pass
            
        if is_trusted:
            parts = [p.strip() for p in xff.split(",")]
            if parts:
                return parts[0]
    return client_ip

async def check_rate_limit(client_ip: str) -> bool:
    """
    Validates requests counts using Redis sorted sets (sliding window rate limit).
    Falls back to a local memory limit list if Redis is unconfigured.
    """
    redis_client = await CacheService.get_client()
    now = time.time()
    
    if redis_client:
        try:
            key = f"rate_limit:{client_ip}"
            clear_before = now - settings.RATE_LIMIT_PERIOD_SEC
            async with redis_client.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, 0, clear_before)
                pipe.zcard(key)
                pipe.zadd(key, {f"{now}-{uuid.uuid4()}": now})
                pipe.expire(key, settings.RATE_LIMIT_PERIOD_SEC + 5)
                results = await pipe.execute()
                count = results[1]
            return count < settings.RATE_LIMIT_CALLS
        except Exception as e:
            logger.warning(f"Redis rate limiting failed, falling back to memory: {e}")
            
    # Fallback to local memory limiter
    logger.warning(f"Using process-local memory database fallback for rate limiting for IP {client_ip}. This is not multi-worker safe.")
    rate_limit_db[client_ip] = [t for t in rate_limit_db[client_ip] if now - t < settings.RATE_LIMIT_PERIOD_SEC]
    if len(rate_limit_db[client_ip]) >= settings.RATE_LIMIT_CALLS:
        return False
    rate_limit_db[client_ip].append(now)
    return True

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
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    return response

# Rate limiter & Security Headers middleware
@app.middleware("http")
async def secure_and_limit_middleware(request: Request, call_next):
    # 1. Trace request ID
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_ctx.set(req_id)
    
    # 0. Request payload size check (OWASP DoS protection)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 1024 * 1024:  # 1MB max
                logger.warning(f"Payload size limit exceeded: {content_length} bytes")
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Payload too large. Maximum allowed size is 1MB."}
                )
                response.headers["X-Request-ID"] = req_id
                return apply_security_headers(response, is_production=(settings.ENV.lower() == "production"))
        except ValueError:
            pass

    # 2. Rate Limiting Check (Exclude doc urls & metrics & health)
    client_ip = get_client_ip(request)
    if not any(x in request.url.path for x in ["/docs", "/openapi", "/redoc", "/metrics", "/api/health"]):
        allowed = await check_rate_limit(client_ip)
        if not allowed:
            logger.warning(f"Rate limit exceeded for client IP: {client_ip}")
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."}
            )
            response.headers["X-Request-ID"] = req_id
            return apply_security_headers(response, is_production=(settings.ENV.lower() == "production"))

    # 3. Measure duration and execute route
    start_time = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        logger.error(f"Error handling request: {e}", exc_info=True)
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred."}
        )
    finally:
        duration = time.time() - start_time
        route_path = request.url.path
        if "/logs/" in route_path:
            route_path = "/api/carbon/logs/{id}"
        elif "/groups/" in route_path:
            route_path = "/api/community/groups/{id}"
        elif "/lessons/" in route_path:
            route_path = "/api/education/lessons/{id}/quiz"
            
        REQUEST_COUNT.labels(method=request.method, endpoint=route_path, http_status=response.status_code if 'response' in locals() else 500).inc()
        REQUEST_LATENCY.labels(method=request.method, endpoint=route_path).observe(duration)
        request_id_ctx.reset(token)

    response.headers["X-Request-ID"] = req_id
    is_prod = settings.ENV.lower() == "production"
    return apply_security_headers(response, is_production=is_prod)

# Root router redirects/health checks
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": settings.APP_NAME, "time": time.time()}

security = HTTPBasic()

def authenticate_metrics(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, settings.METRICS_USER)
    correct_password = secrets.compare_digest(credentials.password, settings.METRICS_PASSWORD)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect metrics username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Prometheus metrics endpoint
@app.get("/metrics")
def metrics(username: str = Depends(authenticate_metrics)):
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Register endpoints routers
app.include_router(websocket_router.router)

for prefix in ["/api", "/api/v1"]:
    app.include_router(auth_router.router, prefix=prefix)
    app.include_router(carbon_router.router, prefix=prefix)
    app.include_router(ai_router.router, prefix=prefix)
    app.include_router(gamification_router.router, prefix=prefix)
    app.include_router(community_router.router, prefix=prefix)
    app.include_router(education_router.router, prefix=prefix)
    app.include_router(simulator_router.router, prefix=prefix)
    app.include_router(offset_router.router, prefix=prefix)
    app.include_router(offset_router.cert_router, prefix=prefix)

# General HTTP exception handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
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
