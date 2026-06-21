/**
 * CarboECO k6 Load Test
 * Tests: API rate limiter, carbon logs endpoint, authentication
 * Run: k6 run k6/load_test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    // Smoke test: 1 VU for 30s
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    // Load test: ramp up to 50 VU
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'load' },
      startTime: '35s',
    },
    // Rate limiter stress test
    rate_limit_stress: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1m',
      duration: '30s',
      preAllocatedVUs: 10,
      tags: { scenario: 'rate_limit' },
      startTime: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95th percentile under 2s
    http_req_failed: ['rate<0.05'],     // Error rate under 5%
    'health_check_duration': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const healthCheckDuration = new Trend('health_check_duration');
const errorRate = new Rate('errors');

export function setup() {
  // Register and login a test user
  const email = `load_test_${Date.now()}@carboeco.test`;
  const password = 'LoadTest123!';
  
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, 
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  if (registerRes.status !== 201) {
    console.error('Setup failed: could not register test user');
    return { token: null };
  }
  
  const loginRes = http.post(`${BASE_URL}/api/auth/login`,
    `username=${email}&password=${password}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  
  const token = loginRes.json('access_token');
  return { token, email };
}

export default function (data) {
  const headers = data.token 
    ? { 'Authorization': `Bearer ${data.token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  group('Health Check', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/health`);
    healthCheckDuration.add(Date.now() - start);
    
    const ok = check(res, {
      'health status 200': (r) => r.status === 200,
      'health returns healthy': (r) => r.json('status') === 'healthy',
    });
    errorRate.add(!ok);
  });

  if (data.token) {
    group('Carbon Logs API', () => {
      // Create a log
      const createRes = http.post(`${BASE_URL}/api/carbon/logs`,
        JSON.stringify({
          date: '2026-06-20',
          category: 'transportation',
          subcategory: 'metro',
          value: 10.0,
          unit: 'km'
        }),
        { headers }
      );
      
      check(createRes, {
        'create log status 201': (r) => r.status === 201,
        'create log has co2': (r) => r.json('co2_equivalent') > 0,
      });

      // List logs
      const listRes = http.get(`${BASE_URL}/api/carbon/logs`, { headers });
      check(listRes, {
        'list logs status 200': (r) => r.status === 200,
        'list logs is array': (r) => Array.isArray(r.json()),
      });

      // Dashboard summary
      const summaryRes = http.get(`${BASE_URL}/api/carbon/summary`, { headers });
      check(summaryRes, {
        'summary status 200': (r) => r.status === 200,
        'summary has daily_co2': (r) => r.json('daily_co2') !== undefined,
      });
    });

    group('Rate Limiter Test', () => {
      // Make rapid requests to test rate limiter
      for (let i = 0; i < 5; i++) {
        const res = http.get(`${BASE_URL}/api/carbon/summary`, { headers });
        check(res, {
          'not rate limited yet': (r) => r.status !== 429,
        });
      }
    });
  }

  sleep(1);
}

export function teardown(data) {
  console.log(`Load test complete. Test user: ${data.email}`);
}
