# CarboECO Load Testing with k6 ⚡

This directory contains the k6 load testing suite for the CarboECO FastAPI backend. It tests critical routes including authentication, rate-limiting, and carbon log generation.

## Prerequisites

1. Install k6 on your machine:
   - **Windows (Chocolatey)**: `choco install k6`
   - **Windows (Winget)**: `winget install k6`
   - **Mac (Homebrew)**: `brew install k6`
   - **Linux**: See [k6 installation documentation](https://k6.io/docs/getting-started/installation/)

## Running the Tests

Ensure the CarboECO FastAPI backend server is running locally (default: `http://localhost:8000`).

Run the load test:
```bash
k6 run k6/load_test.js
```

To run against a different URL (e.g. production/staging):
```bash
k6 run -e BASE_URL=https://api.yourstage.com k6/load_test.js
```

## Test Scenarios

The script defines three concurrent/sequential scenarios to test different system load patterns:

1. **smoke**: 1 Virtual User (VU) for 30s to verify API health and correct end-to-end functionality.
2. **load**: Ramps up from 0 to 50 VUs over 2 minutes to verify response times and throughput under normal operating loads.
3. **rate_limit_stress**: Targets the server with high-frequency requests (200 requests/minute) to verify that the rate limiter properly intercepts traffic with `429 Too Many Requests`.

## Thresholds

The quality gates will fail if:
- The 95th percentile of request duration (`http_req_duration`) exceeds 2.0 seconds.
- The request failure rate (`http_req_failed`) exceeds 5%.
- The health check response time exceeds 500ms.
