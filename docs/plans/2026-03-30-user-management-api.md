# User Management API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a REST API in Node.js + TypeScript exposing user/group management endpoints with pagination, bulk updates, rate limiting, and request tracing.

**Architecture:** Express.js server backed by MySQL, using Zod for request validation and mysql2 for DB access. All endpoints follow a `{ success, data, ... }` envelope. Middleware adds X-Request-ID, rate limiting (100 req/min/IP), and Cache-Control headers per operation type.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, mysql2, Zod, express-rate-limit, uuid, Jest + Supertest, ts-jest

---

## Project Layout (target)

```
api/
├── src/
│   ├── server.ts          # HTTP listen entry point
│   ├── app.ts             # Express app factory (testable)
│   ├── db.ts              # mysql2 pool singleton
│   ├── middleware/
│   │   ├── requestId.ts
│   │   ├── rateLimit.ts
│   │   └── cacheHeaders.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── users.ts
│   │   └── groups.ts
│   └── schemas/
│       └── validation.ts
├── tests/
│   ├── health.test.ts
│   ├── users.test.ts
│   ├── groups.test.ts
│   └── helpers/db.ts      # seed/teardown helpers
├── docker-compose.yml     # MySQL + phpMyAdmin
├── tsconfig.json
├── jest.config.ts
└── package.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/jest.config.ts`
- Create: `api/docker-compose.yml`

**Step 1: Create the `api/` directory and initialise package.json**

```bash
mkdir api && cd api && npm init -y
```

**Step 2: Install runtime dependencies**

```bash
npm install express mysql2 zod express-rate-limit uuid dotenv
```

**Step 3: Install dev dependencies**

```bash
npm install -D typescript ts-node @types/express @types/uuid @types/node \
  jest ts-jest @types/jest supertest @types/supertest
```

**Step 4: Write `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 5: Write `api/jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterFramework: [],
  testTimeout: 15000,
};

export default config;
```

**Step 6: Add scripts to `api/package.json`**

```json
"scripts": {
  "dev": "ts-node src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "test": "jest --runInBand --forceExit"
}
```

**Step 7: Write `api/docker-compose.yml`**

```yaml
version: "3.8"
services:
  mysql:
    image: mysql:8.0
    container_name: mysql-db
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: mydatabase
      MYSQL_USER: user
      MYSQL_PASSWORD: password
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10

  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    container_name: phpmyadmin
    ports:
      - "8080:80"
    environment:
      PMA_HOST: mysql
      PMA_USER: user
      PMA_PASSWORD: password

volumes:
  mysql-data:
```

**Step 8: Start the DB**

```bash
cd api && docker compose up -d
# Wait ~20s, then verify:
docker compose ps
# Both mysql-db and phpmyadmin should be "healthy" / running
```

**Step 9: Commit**

```bash
git add api/
git commit -m "chore: scaffold api project with ts, jest, mysql docker-compose"
```

---

### Task 2: Database Connection + Schema

**Files:**
- Create: `api/src/db.ts`
- Create: `api/tests/helpers/db.ts`

**Step 1: Write `api/src/db.ts`**

```ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'user',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_NAME ?? 'mydatabase',
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
```

**Step 2: Write `api/tests/helpers/db.ts`**

This helper seeds and tears down test data between tests.

```ts
import pool from '../../src/db';

export async function seed() {
  await pool.execute('DELETE FROM user_groups');
  await pool.execute('DELETE FROM users');
  await pool.execute('DELETE FROM `groups`');

  await pool.execute(`
    INSERT INTO users (id, name, email, status) VALUES
    (1, 'John Doe',   'john@example.com', 'active'),
    (2, 'Jane Smith', 'jane@example.com', 'pending')
  `);

  await pool.execute(`
    INSERT INTO \`groups\` (id, name, status) VALUES
    (1, 'Admins', 'empty'),
    (2, 'Users',  'NotEmpty')
  `);

  // Jane is in group 2
  await pool.execute(`INSERT INTO user_groups (user_id, group_id) VALUES (2, 2)`);
}

export async function teardown() {
  await pool.execute('DELETE FROM user_groups');
  await pool.execute('DELETE FROM users');
  await pool.execute('DELETE FROM `groups`');
  await pool.end();
}
```

**Step 3: Create schema via phpMyAdmin** (http://localhost:8080) or run directly:

```bash
docker exec -i mysql-db mysql -uuser -ppassword mydatabase <<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  status     ENUM('pending','active','blocked') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `groups` (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  status     ENUM('empty','NotEmpty') NOT NULL DEFAULT 'empty',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_groups (
  user_id  INT NOT NULL,
  group_id INT NOT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE
);
SQL
```

**Step 4: Verify connection**

```bash
cd api && npx ts-node -e "
import pool from './src/db';
pool.query('SELECT 1').then(() => { console.log('DB OK'); process.exit(0); });
"
# Expected: DB OK
```

**Step 5: Commit**

```bash
git add api/src/db.ts api/tests/helpers/db.ts
git commit -m "feat: add mysql2 pool and test seed/teardown helpers"
```

---

### Task 3: Express App Factory + Middleware

**Files:**
- Create: `api/src/middleware/requestId.ts`
- Create: `api/src/middleware/rateLimit.ts`
- Create: `api/src/middleware/cacheHeaders.ts`
- Create: `api/src/app.ts`
- Create: `api/src/server.ts`

**Step 1: Write `api/src/middleware/requestId.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = uuidv4();
  res.setHeader('X-Request-ID', id);
  next();
}
```

**Step 2: Write `api/src/middleware/rateLimit.ts`**

```ts
import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',   // sets RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});
```

**Step 3: Write `api/src/middleware/cacheHeaders.ts`**

```ts
import { Request, Response, NextFunction } from 'express';

export function readCache(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
  next();
}

export function noStore(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
```

**Step 4: Write `api/src/app.ts`**

```ts
import express from 'express';
import { requestId } from './middleware/requestId';
import { limiter } from './middleware/rateLimit';
import healthRouter from './routes/health';
import usersRouter from './routes/users';
import groupsRouter from './routes/groups';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestId);
  app.use(limiter);
  app.set('trust proxy', 1);

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.use('/health', healthRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/groups', groupsRouter);

  return app;
}
```

**Step 5: Write `api/src/server.ts`**

```ts
import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Step 6: Commit**

```bash
git add api/src/
git commit -m "feat: add express app factory with requestId, rateLimit, cors middleware"
```

---

### Task 4: Health Check Endpoint

**Files:**
- Create: `api/src/routes/health.ts`
- Create: `api/tests/health.test.ts`

**Step 1: Write the failing test `api/tests/health.test.ts`**

```ts
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with status healthy and a timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
cd api && npm test -- tests/health.test.ts
# Expected: FAIL — cannot find module '../src/routes/health'
```

**Step 3: Write `api/src/routes/health.ts`**

```ts
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-ID'),
  });
});

export default router;
```

**Step 4: Run test to confirm it passes**

```bash
cd api && npm test -- tests/health.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add api/src/routes/health.ts api/tests/health.test.ts
git commit -m "feat: add GET /health endpoint"
```

---

### Task 5: Validation Schemas

**Files:**
- Create: `api/src/schemas/validation.ts`

**Step 1: Write `api/src/schemas/validation.ts`**

```ts
import { z } from 'zod';

export const paginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

export const bulkStatusUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id:     z.number().int().positive(),
        status: z.enum(['pending', 'active', 'blocked']),
      })
    )
    .min(1)
    .max(500),
});
```

**Step 2: Verify schemas compile**

```bash
cd api && npx tsc --noEmit
# Expected: no errors
```

**Step 3: Commit**

```bash
git add api/src/schemas/validation.ts
git commit -m "feat: add zod validation schemas for pagination and bulk status update"
```

---

### Task 6: GET /api/v1/users

**Files:**
- Create: `api/src/routes/users.ts` (initial — GET only)
- Create: `api/tests/users.test.ts`

**Step 1: Write failing tests `api/tests/users.test.ts`**

```ts
import request from 'supertest';
import { createApp } from '../src/app';
import { seed, teardown } from './helpers/db';

const app = createApp();

beforeEach(seed);
afterAll(teardown);

describe('GET /api/v1/users', () => {
  it('returns paginated users with defaults', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toEqual({ limit: 10, offset: 0, total: 2 });
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      email: expect.any(String),
      status: expect.any(String),
      created_at: expect.any(String),
    });
  });

  it('respects limit and offset query params', async () => {
    const res = await request(app).get('/api/v1/users?limit=1&offset=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ limit: 1, offset: 1 });
  });

  it('rejects limit > 100', async () => {
    const res = await request(app).get('/api/v1/users?limit=101');
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: FAIL — cannot GET /api/v1/users
```

**Step 3: Write `api/src/routes/users.ts` — GET /api/v1/users section**

```ts
import { Router, Request, Response } from 'express';
import pool from '../db';
import { paginationSchema } from '../schemas/validation';
import { readCache, noStore } from '../middleware/cacheHeaders';

const router = Router();

router.get('/', readCache, async (req: Request, res: Response) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  const { limit, offset } = parsed.data;
  const [rows] = await pool.execute<any[]>(
    'SELECT id, name, email, status, created_at FROM users LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute<any[]>(
    'SELECT COUNT(*) AS total FROM users'
  );

  res.json({
    success: true,
    data: rows,
    pagination: { limit, offset, total: Number(total) },
  });
});

export default router;
```

**Step 4: Run tests to confirm they pass**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: PASS (3 tests)
```

**Step 5: Commit**

```bash
git add api/src/routes/users.ts api/tests/users.test.ts
git commit -m "feat: add GET /api/v1/users with pagination"
```

---

### Task 7: GET /api/v1/groups

**Files:**
- Create: `api/src/routes/groups.ts`
- Modify: `api/tests/groups.test.ts`

**Step 1: Write failing test `api/tests/groups.test.ts`**

```ts
import request from 'supertest';
import { createApp } from '../src/app';
import { seed, teardown } from './helpers/db';

const app = createApp();

beforeEach(seed);
afterAll(teardown);

describe('GET /api/v1/groups', () => {
  it('returns paginated groups with defaults', async () => {
    const res = await request(app).get('/api/v1/groups');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toEqual({ limit: 10, offset: 0, total: 2 });
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      status: expect.any(String),
      created_at: expect.any(String),
    });
  });

  it('respects limit param', async () => {
    const res = await request(app).get('/api/v1/groups?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd api && npm test -- tests/groups.test.ts
# Expected: FAIL
```

**Step 3: Write `api/src/routes/groups.ts`**

```ts
import { Router, Request, Response } from 'express';
import pool from '../db';
import { paginationSchema } from '../schemas/validation';
import { readCache } from '../middleware/cacheHeaders';

const router = Router();

router.get('/', readCache, async (req: Request, res: Response) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  const { limit, offset } = parsed.data;
  const [rows] = await pool.execute<any[]>(
    'SELECT id, name, status, created_at FROM `groups` LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute<any[]>(
    'SELECT COUNT(*) AS total FROM `groups`'
  );

  res.json({
    success: true,
    data: rows,
    pagination: { limit, offset, total: Number(total) },
  });
});

export default router;
```

**Step 4: Run tests to confirm pass**

```bash
cd api && npm test -- tests/groups.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add api/src/routes/groups.ts api/tests/groups.test.ts
git commit -m "feat: add GET /api/v1/groups with pagination"
```

---

### Task 8: DELETE /api/v1/users/:userId/groups/:groupId

**Files:**
- Modify: `api/src/routes/users.ts` (add DELETE route)
- Modify: `api/tests/users.test.ts` (add DELETE tests)

**Step 1: Add failing tests to `api/tests/users.test.ts`**

Append these describe blocks to the existing file:

```ts
describe('DELETE /api/v1/users/:userId/groups/:groupId', () => {
  it('removes user from group and returns groupStatus NotEmpty when others remain', async () => {
    // seed: user 2 is in group 2 which also has others — but our seed only has user 2
    // Add user 1 to group 2 first so removing user 2 leaves group 2 NotEmpty
    const db = await import('./helpers/db');
    // manually add user 1 to group 2
    // We test removal of user 2 from group 2, but group 2 still has user 1
    // For simplicity re-seed with both users in group 2
    const pool = (await import('../src/db')).default;
    await pool.execute('INSERT INTO user_groups (user_id, group_id) VALUES (1, 2)');

    const res = await request(app).delete('/api/v1/users/2/groups/2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, removed: true, groupStatus: 'NotEmpty' });
  });

  it('removes last user from group — groupStatus becomes empty', async () => {
    // seed has user 2 in group 2 only
    const res = await request(app).delete('/api/v1/users/2/groups/2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, removed: true, groupStatus: 'empty' });
  });

  it('returns 404 when user does not exist', async () => {
    const res = await request(app).delete('/api/v1/users/999/groups/2');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('999');
  });

  it('returns 404 when group does not exist', async () => {
    const res = await request(app).delete('/api/v1/users/2/groups/999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('999');
  });

  it('returns 404 when user is not in the group', async () => {
    const res = await request(app).delete('/api/v1/users/1/groups/2');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('not a member');
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: FAIL on DELETE tests
```

**Step 3: Add DELETE route to `api/src/routes/users.ts`**

Add this block before `export default router`:

```ts
router.delete('/:userId/groups/:groupId', noStore, async (req: Request, res: Response) => {
  const userId  = Number(req.params.userId);
  const groupId = Number(req.params.groupId);

  // Validate user exists
  const [[user]] = await pool.execute<any[]>(
    'SELECT id FROM users WHERE id = ?', [userId]
  );
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `User with id ${userId} not found` },
    });
  }

  // Validate group exists
  const [[group]] = await pool.execute<any[]>(
    'SELECT id FROM `groups` WHERE id = ?', [groupId]
  );
  if (!group) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Group with id ${groupId} not found` },
    });
  }

  // Validate membership
  const [[membership]] = await pool.execute<any[]>(
    'SELECT 1 FROM user_groups WHERE user_id = ? AND group_id = ?', [userId, groupId]
  );
  if (!membership) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `User ${userId} is not a member of group ${groupId}` },
    });
  }

  // Remove
  await pool.execute(
    'DELETE FROM user_groups WHERE user_id = ? AND group_id = ?', [userId, groupId]
  );

  // Check remaining members
  const [[{ count }]] = await pool.execute<any[]>(
    'SELECT COUNT(*) AS count FROM user_groups WHERE group_id = ?', [groupId]
  );
  const groupStatus = Number(count) === 0 ? 'empty' : 'NotEmpty';

  // Update group status
  await pool.execute(
    'UPDATE `groups` SET status = ? WHERE id = ?', [groupStatus, groupId]
  );

  res.json({ success: true, removed: true, groupStatus });
});
```

**Step 4: Run tests to confirm pass**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: PASS (all tests)
```

**Step 5: Commit**

```bash
git add api/src/routes/users.ts api/tests/users.test.ts
git commit -m "feat: add DELETE /api/v1/users/:userId/groups/:groupId"
```

---

### Task 9: PATCH /api/v1/users/status (Bulk Update)

**Files:**
- Modify: `api/src/routes/users.ts` (add PATCH route — must be registered BEFORE /:userId to avoid routing conflict)
- Modify: `api/tests/users.test.ts` (add PATCH tests)

**Step 1: Add failing tests to `api/tests/users.test.ts`**

```ts
describe('PATCH /api/v1/users/status', () => {
  it('updates all found users and returns updated count', async () => {
    const res = await request(app)
      .patch('/api/v1/users/status')
      .send({ updates: [{ id: 1, status: 'blocked' }, { id: 2, status: 'active' }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, updated: 2, notFound: [] });
  });

  it('partial success — notFound contains missing ids', async () => {
    const res = await request(app)
      .patch('/api/v1/users/status')
      .send({ updates: [{ id: 1, status: 'active' }, { id: 999, status: 'blocked' }] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.notFound).toContain(999);
  });

  it('returns 400 when updates array is empty', async () => {
    const res = await request(app)
      .patch('/api/v1/users/status')
      .send({ updates: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('updates');
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch('/api/v1/users/status')
      .send({ updates: [{ id: 1, status: 'unknown' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: FAIL on PATCH tests
```

**Step 3: Add PATCH route to `api/src/routes/users.ts`**

Add this block **before** the DELETE route (and before any `/:userId` routes to avoid conflicts):

```ts
router.patch('/status', noStore, async (req: Request, res: Response) => {
  const parsed = bulkStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  const { updates } = parsed.data;
  let updatedCount = 0;
  const notFound: number[] = [];

  for (const { id, status } of updates) {
    const [result] = await pool.execute<any>(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      notFound.push(id);
    } else {
      updatedCount++;
    }
  }

  res.json({ success: true, updated: updatedCount, notFound });
});
```

Also add `bulkStatusUpdateSchema` to the imports at the top of `users.ts`:

```ts
import { paginationSchema, bulkStatusUpdateSchema } from '../schemas/validation';
```

**Step 4: Run tests to confirm pass**

```bash
cd api && npm test -- tests/users.test.ts
# Expected: PASS (all tests)
```

**Step 5: Commit**

```bash
git add api/src/routes/users.ts api/tests/users.test.ts
git commit -m "feat: add PATCH /api/v1/users/status bulk update"
```

---

### Task 10: Full Test Suite + Manual Smoke Test

**Step 1: Run full test suite**

```bash
cd api && npm test
# Expected: all tests PASS
```

**Step 2: Start server**

```bash
cd api && npm run dev
# Expected: Server running on http://localhost:3000
```

**Step 3: Run smoke tests (bash script from spec)**

```bash
BASE_URL="http://localhost:3000/api/v1"

echo "=== 1. Get Users ==="
curl -s "$BASE_URL/users?limit=2" | jq .

echo "=== 2. Get Groups ==="
curl -s "$BASE_URL/groups?limit=2" | jq .

echo "=== 3. Bulk Update Status ==="
curl -s -X PATCH "$BASE_URL/users/status" \
  -H "Content-Type: application/json" \
  -d '{"updates":[{"id":1,"status":"active"},{"id":2,"status":"pending"}]}' | jq .

echo "=== 4. Remove User from Group ==="
curl -s -X DELETE "$BASE_URL/users/2/groups/2" | jq .

echo "=== 5. Health Check ==="
curl -s "http://localhost:3000/health" | jq .
```

Expected output for each: `"success": true` with correct structure.

**Step 4: Verify response headers**

```bash
curl -I "http://localhost:3000/api/v1/users" 2>/dev/null | grep -E "X-Request-ID|RateLimit|Cache-Control"
# Expected:
# X-Request-ID: <uuid>
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# Cache-Control: private, max-age=5, stale-while-revalidate=10
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete user management api — all endpoints implemented and tested"
```

---

## Summary of Endpoints

| Method | Path | Task |
|--------|------|------|
| GET | /health | Task 4 |
| GET | /api/v1/users | Task 6 |
| GET | /api/v1/groups | Task 7 |
| DELETE | /api/v1/users/:userId/groups/:groupId | Task 8 |
| PATCH | /api/v1/users/status | Task 9 |

## Environment Variables (optional override)

| Var | Default |
|-----|---------|
| PORT | 3000 |
| DB_HOST | localhost |
| DB_PORT | 3306 |
| DB_USER | user |
| DB_PASSWORD | password |
| DB_NAME | mydatabase |
