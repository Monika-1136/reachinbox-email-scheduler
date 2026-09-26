# ReachInbox Outbound Email Scheduler

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.7-orange.svg)](https://bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue.svg)](https://www.mysql.com/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11-yellow.svg)](https://www.elastic.co/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

A production-grade, distributed Outbound Email Job Scheduler built for **ReachInbox / Outbox Labs**. The system features real Google & Slack OAuth, BullMQ delayed queue processing, Redis-backed atomic hourly rate limiting, restart persistence, idempotency safeguards, Ethereal SMTP delivery, real Elasticsearch full-text indexing, and an interactive BullMQ live queue dashboard.

---

## 🏗 Architecture Overview

```
                      +---------------------------------------+
                      |         React 18 + Vite (SPA)        |
                      |   (Dark UI matching Figma spec)      |
                      +-------------------+-------------------+
                                          |
                        REST APIs / OAuth | Bearer JWT
                                          v
                      +---------------------------------------+
                      |      Express.js API Gateway           |
                      |   (Zod Validation, Helmet, CORS)      |
                      +---+---------------+---------------+---+
                          |               |               |
             Prisma ORM   |               | BullMQ Queue  | Elasticsearch Client
                          v               v               v
               +--------------+   +---------------+   +-------------------+
               |   MySQL 8+   |   |     Redis     |   |   Elasticsearch   |
               |  (Persistent |   | (Delayed Jobs |   |  (Full-Text Email |
               |   DB State)  |   |  & Rate Keys) |   |      Search)      |
               +--------------+   +-------+-------+   +-------------------+
                                          |
                                          | BullMQ Worker Pool
                                          v
                      +---------------------------------------+
                      |         BullMQ Email Worker           |
                      |    (Configurable Concurrency = N)     |
                      +---+---------------+---------------+---+
                          |               |               |
              Atomic Lua  |               | Nodemailer    | WebClient API
                          v               v               v
               +--------------+   +---------------+   +-------------------+
               |  Redis Rate  |   | Ethereal SMTP |   |     Slack API     |
               |   Limiter    |   | Delivery with |   |  (Live Rate-Limit |
               | (Hourly/Min) |   |  Preview URL  |   |  Deduplicated msg)|
               +--------------+   +---------------+   +-------------------+
```

---

## ✨ Features Checklist & Requirement Mapping

| Feature | Implementation Details | Status |
| :--- | :--- | :--- |
| **Real Google OAuth** | Passport / OAuth 2.0 flow with JWT session tokens and user profile sync | ✅ Complete |
| **Figma-Matched UI** | React 18, Tailwind CSS, dark aesthetic, loading skeletons, glassmorphism | ✅ Complete |
| **CSV/TXT Lead Upload** | Auto-detects email addresses, filters malformed syntax, cleans duplicates | ✅ Complete |
| **BullMQ Delayed Jobs** | Distributed Redis-backed delayed queue with zero in-memory polling | ✅ Complete |
| **Server Restart Resilience** | Redis keeps BullMQ delayed timers intact; worker auto-resumes after restart | ✅ Complete |
| **Idempotency Safeguard** | Unique deterministic keys per campaign + recipient; prevents double-sends | ✅ Complete |
| **Configurable Concurrency** | `WORKER_CONCURRENCY=...` dynamically controls worker parallelism | ✅ Complete |
| **Minimum Send Delay** | `MIN_EMAIL_DELAY_MS=...` throttles bursts atomically across all workers | ✅ Complete |
| **Hourly Rate Limiting** | Redis atomic Lua counters (`email-rate:{senderId}:{hourWindow}`) | ✅ Complete |
| **Smart Job Rescheduling** | Exceeded jobs automatically shift to next hour window without data loss | ✅ Complete |
| **Real Slack OAuth** | Connects Slack workspace with OAuth code exchange and token persistence | ✅ Complete |
| **Live Slack Rate-Limit Alert**| Posts message when hourly limit is reached; deduplicated per hour window | ✅ Complete |
| **Ethereal SMTP Delivery** | Real SMTP delivery via Nodemailer; exposes live web preview URLs | ✅ Complete |
| **Elasticsearch Indexing** | Documents indexed on schedule/send; multi-field search with graceful DB fallback | ✅ Complete |
| **Bull Board Dashboard** | Mounted at `/admin/queues` via Bull Board for real-time queue inspection | ✅ Complete |
| **Docker Compose** | One-command orchestration for MySQL 8+, Redis, Elasticsearch, API & Frontend | ✅ Complete |

---

## 📁 Monorepo Structure

```
reachinbox-email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment, Prisma DB, Redis, Nodemailer, Elasticsearch
│   │   ├── controllers/        # Auth, Campaigns, Emails, Senders, Slack, Bull Board
│   │   ├── middleware/         # JWT Auth, Zod Validation, Error Scrubbing
│   │   ├── routes/             # REST Express Routers
│   │   ├── services/           # Business logic: Auth, Queue, RateLimiter, Slack, Elastic, Email
│   │   ├── utils/              # Robust CSV / TXT lead parser
│   │   ├── workers/            # BullMQ Worker implementation and runner
│   │   ├── types/              # Domain and API TypeScript interfaces
│   │   ├── app.ts              # Express App setup
│   │   └── server.ts           # Server bootstrap & graceful shutdown
│   ├── prisma/
│   │   └── schema.prisma       # MySQL Relational models, enums, indexes
│   ├── tests/                  # Unit & integration tests with Vitest
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Header, ComposeModal, ScheduledTable, SentTable, SlackCard, Stats
│   │   ├── context/            # AuthContext (Google OAuth & Demo login)
│   │   ├── pages/              # LoginPage, DashboardPage
│   │   ├── services/           # Axios typed API client
│   │   ├── types/              # UI TypeScript models
│   │   ├── App.tsx             # Routes & ProtectedRoute
│   │   └── main.tsx            # React root entry
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
│
├── docker-compose.yml          # MySQL 8+, Redis, Elasticsearch, Backend, Frontend
├── DEMO.md                     # 5-minute step-by-step reviewer demo script
├── README.md                   # Full documentation
├── .gitignore
└── package.json                # Monorepo root scripts
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (or local MySQL 8+, Redis, and Elasticsearch)

### Step 1: Clone and Configure Environment

```bash
# Clone the repository
git clone https://github.com/Monika-1136/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# Configure backend environment
cp backend/.env.example backend/.env

# Configure frontend environment
cp frontend/.env.example frontend/.env
```

### Step 2: Launch Supporting Services with Docker

```bash
# Start MySQL, Redis, and Elasticsearch containers
docker compose up -d mysql redis elasticsearch
```

### Step 3: Initialize Database & Run Migrations

```bash
cd backend
npm install
npx prisma db push
```

### Step 4: Run Application in Development Mode

From the repository root:
```bash
# Runs backend API, BullMQ worker, and frontend Vite dev server concurrently
npm run dev
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **BullMQ Live Queue Dashboard:** [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🧪 Seeding a Demonstration Workload (1-Click)

To quickly enqueue 20 test emails with staggered 2000ms delays without manual data entry:

```bash
# Run backend seed script
npm run seed
```

Or simply click the **"Quick Seed 10 Emails"** button directly on the dashboard!

---

## 🔄 The Server Restart Resilience Test

One of the most critical requirements is proving that future scheduled emails survive a backend crash without losing state:

1. **Schedule an Email:** Open the Compose Modal, choose a start time 2 minutes in the future (e.g. 10:05), and click **Schedule Outbound Campaign**.
2. **Verify Queue State:** Open the BullMQ Dashboard at [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) and confirm the job is in the **Delayed** tab.
3. **Terminate Backend:** Press `Ctrl + C` in the backend terminal.
4. **Wait:** Wait past the original scheduled time (e.g. 10:06). Notice that Redis preserves the job timer in its sorted set.
5. **Restart Backend:** Run `npm run dev:backend`.
6. **Result:** BullMQ worker reconnects, detects that the delayed timer has passed, and immediately delivers the email exactly once! Status transitions to `SENT` in MySQL and the Ethereal preview link is generated.

---

## 🔒 Idempotency & Concurrency Design

Every email job has a deterministic idempotency key constructed as:
```
idempotencyKey = `${campaignId}:${recipientEmail.toLowerCase()}`
```

### Concurrency Protection Flow:
1. **BullMQ Job Deduplication:** BullMQ enforces unique `jobId = idempotencyKey`, preventing multiple duplicate jobs from being queued.
2. **Database State Check:** Before initiating SMTP communication, the worker checks `ScheduledEmail.status`. If already `SENT`, it immediately acknowledges the job and returns.
3. **Atomic Transition:** The worker executes an atomic update:
   ```sql
   UPDATE ScheduledEmail
   SET status = 'PROCESSING', attempts = attempts + 1
   WHERE id = :id AND status != 'SENT';
   ```
4. **Post-Send Finalization:** Only after Ethereal SMTP returns a success response is the record marked `SENT` with `sentAt` and `messageId`.

---

## ⏱ Rate Limiting & Throttling Architecture

Two distinct controls protect outbound reputation:

### 1. Minimum Send Delay (`MIN_EMAIL_DELAY_MS=2000`)
Enforces at least ~2 seconds spacing between successive sends for each sender across all concurrent workers using an atomic Redis key: `sender-last-send:{senderId}`.

### 2. Hourly Sender Rate Limit (`MAX_EMAILS_PER_HOUR=200`)
Tracks sending volume in real time using atomic Redis counters:
- **Hour Window Key:** `email-rate:{senderId}:{hourWindow}` (where `hourWindow = Math.floor(Date.now() / 3600000)` with 2-hour TTL).
- **Atomic Lua Script:** Checks current count and increments atomically in a single round-trip.
- **Handling Limit Exceeded:**
  - Calculates milliseconds until the next hour window (`(hourWindow + 1) * 3600000 - Date.now() + jitter`).
  - **Does NOT fail the email!**
  - Re-enqueues the BullMQ job with the calculated delay.
  - Updates `scheduledAt` in MySQL so the dashboard displays the rescheduled time.
  - Dispatches a live Slack notification.

---

## 💬 Slack Rate-Limit Notifications

When a sender exhausts its hourly sending limit:
1. A live Slack API call is made via `@slack/web-api` (`chat.postMessage`).
2. **Deduplication:** A Redis key `slack-rate-limit-notified:{senderId}:{hourWindow}` with a 2-hour TTL prevents spamming Slack when multiple jobs exceed the limit in the same hour window.
3. **Resilience:** If Slack is not connected or the user disconnects, the system logs a clean warning and continues processing without throwing errors or crashing the worker.

---

## 🔍 Elasticsearch Full-Text Search

- **Index:** `reachinbox-emails`
- **Indexed Fields:** `recipientEmail`, `subject`, `body`, `status`, `senderEmail`, `scheduledAt`, `sentAt`, `campaignId`, `userId`.
- **Search API:** `GET /api/emails/search?q=...&status=...`
- **Graceful Fallback:** If Elasticsearch is temporarily starting or offline, the search service automatically falls back to MySQL LIKE queries without throwing 500 errors.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
JWT_SECRET=reachinbox_super_secret_jwt_key_2026
SESSION_SECRET=reachinbox_super_secret_session_key_2026

# Database (MySQL 8+ & Prisma)
DATABASE_URL="mysql://reachinbox_user:reachinbox_secret_password@localhost:3306/reachinbox"
MYSQL_ROOT_PASSWORD=reachinbox_root_secret
MYSQL_DATABASE=reachinbox
MYSQL_USER=reachinbox_user
MYSQL_PASSWORD=reachinbox_secret_password

# Redis & BullMQ
REDIS_URL="redis://localhost:6379"

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack OAuth Credentials
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Ethereal Email SMTP
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_user@ethereal.email
SMTP_PASSWORD=your_ethereal_password
SMTP_FROM="ReachInbox Scheduler <outreach@reachinbox.test>"

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Worker & Throttling Controls
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
```

*Note: If no Ethereal credentials are provided in `.env`, the backend automatically calls `nodemailer.createTestAccount()` to provision a real Ethereal SMTP account on startup!*

---

## 🧪 Running Automated Tests

The test suite covers unit logic, rate limiters, idempotency, Slack deduplication, and auth protection:

```bash
cd backend
npm test
```

Test coverage includes:
- `csvParser.test.ts`: CSV parsing, duplicate detection, syntax validation
- `rateLimiter.test.ts`: Atomic Redis Lua hourly limits, minimum delay throttling, concurrent workers
- `idempotency.test.ts`: Deterministic keys, duplicate send prevention, atomic state transitions
- `slack.test.ts`: OAuth URL building, rate limit alert deduplication, disconnected resilience
- `auth.test.ts`: JWT signing/verification, protected route authorization
- `elasticsearch.test.ts`: Search queries and database fallback resilience
- `scheduler.test.ts`: Campaign scheduling, BullMQ delayed job enqueuing, restart persistence
- `e2eIntegration.test.ts`: Full end-to-end integration flows across MySQL, Redis, BullMQ, Ethereal, and Slack

---

## 📜 API Documentation

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, MySQL, Redis & Elastic status | No |
| `GET` | `/api/auth/me` | Current authenticated user profile | Yes |
| `GET` | `/api/auth/google` | Initiates real Google OAuth flow | No |
| `GET` | `/api/auth/google/callback` | Google OAuth redirect callback | No |
| `POST`| `/api/auth/dev-login` | 1-Click developer login | No |
| `POST`| `/api/auth/logout` | Clears authentication session/cookie | Yes |
| `GET` | `/api/senders` | List configured sender inboxes | Yes |
| `POST`| `/api/senders` | Create a sender with custom hourly limit | Yes |
| `DELETE`| `/api/senders/:id` | Delete a sender inbox | Yes |
| `POST`| `/api/emails/schedule` | Schedule outbound email campaign | Yes |
| `GET` | `/api/emails/scheduled` | Paginated list of scheduled/queued emails | Yes |
| `GET` | `/api/emails/sent` | Paginated list of delivered/failed emails | Yes |
| `GET` | `/api/emails/search?q=` | Elasticsearch full-text email search | Yes |
| `GET` | `/api/emails/stats` | Aggregate dashboard email counts | Yes |
| `POST`| `/api/emails/parse-csv` | Parse raw text / CSV and validate leads | Yes |
| `DELETE`| `/api/emails/:id` | Cancel a scheduled email in BullMQ | Yes |
| `GET` | `/api/slack/connect` | Initiates real Slack OAuth authorization | Yes |
| `GET` | `/api/slack/callback` | Handles Slack OAuth code exchange | No |
| `POST`| `/api/slack/disconnect`| Disconnects Slack connection | Yes |
| `GET` | `/api/slack/status` | Returns active Slack workspace info | Yes |
| `GET` | `/api/queues/stats` | Live BullMQ waiting/delayed/active stats | No |
| `ALL` | `/admin/queues` | Bull Board live BullMQ Web UI | No |

---

## ⚖️ Assumptions & Trade-offs

1. **Ethereal Dynamic Account Generation:** If explicit Ethereal credentials are not supplied in `.env`, the server automatically creates a live test account using `nodemailer.createTestAccount()`. This allows instant testing without manual registration.
2. **Elasticsearch Resilience:** To ensure high availability, Elasticsearch query errors gracefully fall back to indexed MySQL queries.
3. **Worker Concurrency:** Default concurrency is set to 5 workers (`WORKER_CONCURRENCY=5`), which can be scaled up or run as dedicated worker containers in production.

---

## 👩‍💻 Author & License

- Built for **ReachInbox / Outbox Labs** Software Engineering Assignment
- License: MIT
