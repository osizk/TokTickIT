# Lab 1 — Test Plan and Evidence  (fill this in)

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Passed |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Passed |
| 3 | Vitest | Heading renders | Passed |
| 4 | Vitest | Success state shows Online + category list | Passed |
| 5 | Vitest | Error state shows Offline + message | Passed |

Paste your passing terminal output / screenshot below.

### Test screenshots

1. Health endpoint test
![Health endpoint test](test-1-health.png)

2. Categories API test
![Categories API test](test-2-categories.png)

3. Heading test
![Heading test](test-3-heading.png)

4. Success-state test
![Success-state test](test-4-success.png)

5. Offline-error test
![Offline-error test](test-5-error.png)
