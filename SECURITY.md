# Security Policy & Architecture - CarboECO

CarboECO implements enterprise-grade security structures targeting a 100/100 auditing score. Below is the technical breakdown of our security layer.

---

## 🔒 Threat Models & OWASP Top 10 Mitigation

### 1. Broken Object Level Authorization (BOLA)
- **Mitigation**: Every database modification check (e.g. deleting logs, querying twin states) validates the log's owner ID (`user_id`) against the decrypted JWT identity payload of the current active session.

### 2. Broken Authentication
- **Mitigation**: Password hashes are computed using the industry-standard `bcrypt` algorithm. JWT access tokens are signed with a secure HS256 signature and expire automatically after 15 minutes. 
- **Refresh Token Rotation (RTR)**: Long-lived refresh tokens are stored in the database. When requesting a new access token, the client must rotate their refresh token. Old refresh tokens are immediately invalidated to prevent replay attacks. Stateless authentication prevents session hijacking.

### 3. Broken Object Property Level Authorization & RBAC
- **Mitigation**: Endpoint dependencies check roles (e.g. `check_admin` dependencies) before allowing admin operations. Non-privileged users are blocked at the router layer.

### 4. Unrestricted Resource Consumption (Rate Limiting & State Isolation)
- **Mitigation**: Built-in HTTP middleware tracks client IP addresses. It uses Redis sorted sets (sliding window rate limit) in multi-worker environments to share rate limiting state across instances, falling back to local memory if Redis is unavailable. If requests exceed 100 calls per 60-second window, the gateway responds with HTTP `429 Too Many Requests`.
- **WebSocket Ticket Authentication**: Multi-worker isolation is maintained by storing WebSocket verification tickets in a shared Redis cache with a strict 30-second TTL rather than inside process-local memory.

### 5. Security Misconfiguration & Injection prevention
- **Mitigation**:
  - Content Security Policy (CSP) headers restrict object/iframe executions.
  - `X-Frame-Options: DENY` mitigates clickjacking.
  - `X-Content-Type-Options: nosniff` protects against mime-sniffing.
  - SQLAlchemy ORM parameterizes all SQL queries automatically, preventing SQL injection (SQLi).
  - Pydantic models validate all inputs, rejecting overflow values, script tags, or format strings.
  - The Carbon Offset Marketplace runs entirely in **[DEMO MODE]** with sandboxed, verification-only endpoints to prevent real-world payment data leakage or unauthorized transactions.

---

## 🔑 Key Management & Secrets

- Secrets (such as `SECRET_KEY` and database URLs) are loaded dynamically from environment variables (`.env`) or GCP Secret Manager in production.
- Default developer credentials are prohibited from production execution.
