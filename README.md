# ReachInbox Email Scheduler

A production-grade, full-stack asynchronous email scheduling platform built for high-throughput, reliable outbound campaign orchestration. The system processes and validates recipient lists, schedules delayed email jobs via persistent distributed BullMQ queues backed by Redis sorted sets, enforces granular per-sender rate limits, guarantees job survival across server restarts, dispatches emails through SMTP with live web previews, and indexes all communications into Elasticsearch for instant search.

---

## Strict Assignment Compliance: No Cron Architecture

The scheduling architecture strictly fulfills the assignment mandate:
- **BullMQ Delayed Jobs**: Distributed job queue orchestrating delayed email execution backed by Redis sorted sets.
- **Worker-Based Processing**: Persistent background worker consuming jobs continuously.
- **No Cron / No Polling**: Zero cron jobs, zero `node-cron`, zero OS cron, zero Agenda, and zero periodic database polling schedulers. BullMQ delayed jobs + Redis + dedicated worker remain the sole source of scheduled execution.

---

## Features

- **User Authentication & Session Management**: Secure user signup, login with bcrypt password hashing, JWT-backed sessions, and protected REST API endpoints.
- **Email Campaign Creation**: Interactive campaign composer supporting rich subject lines, HTML bodies, sender profile selection, and timing controls.
- **CSV & TXT Recipient Upload**: Drag-and-drop or file upload parsing of large recipient files alongside direct multiline text entry.
- **Recipient Parsing & Validation**: Real-time email syntax validation, malformed address detection, and actionable badge summaries before dispatch.
- **Duplicate Removal**: Automatic deduplication of recipient lists per campaign to prevent unintended repeat deliveries.
- **Immediate & Future Email Scheduling**: Send instantly or schedule dispatches for any future timestamp (`T_future`) via BullMQ delayed jobs.
- **Configurable Delay Between Emails**: Staggered dispatch offsets between consecutive emails (`delayMs`) to simulate human pacing and avoid spam traps.
- **Configurable Hourly Sending Limits**: Customizable sending quotas per sender profile enforced atomically.
- **Redis-Backed Rate Limiting**: High-performance atomic Redis Lua scripts tracking hourly windows (`email-rate:{senderId}:{hourWindow}`). Excess emails are automatically rescheduled to the next valid window.
- **Configurable Worker Concurrency**: Scalable background worker processing multiple concurrent jobs controlled via environment configuration (`WORKER_CONCURRENCY`).
- **Multiple Sender Support**: Manage multiple outbound sender identities with independent rate limits and delivery tracking.
- **MySQL Persistence**: Relational data modeling via Prisma ORM for users, senders, campaigns, scheduled emails, and integration states.
- **Ethereal SMTP Integration**: Real SMTP handshake execution generating instant web preview URLs (`https://ethereal.email/message/...`) with toggle support for production SMTP.
- **Elasticsearch Indexing & Search**: Real-time Elasticsearch 8+ ingestion and multi-field fuzzy search across recipients, subjects, bodies, and statuses with graceful database fallback.
- **Scheduled Emails Dashboard**: Live monitoring table of pending, delayed, and processing email jobs with real-time status updates and cancellation support.
- **Sent & Delivered Dashboard**: Comprehensive audit log of delivered messages with exact delivery timestamps, message IDs, and direct Ethereal preview links.
- **Delivery Failure Tracking**: Granular error tracking and attempt counters for failed delivery attempts.
- **Bull Board Queue Monitoring**: Real-time queue inspector dashboard mounted at `/admin/queues` showing active, delayed, waiting, completed, and failed jobs.
- **Restart Persistence**: Guaranteed durability—scheduled and delayed jobs survive backend/worker crashes and server reboots without loss.
- **Idempotent Email Processing**: Compound deterministic idempotency keys (`campaignId:recipientEmail`) and atomic status transitions prevent duplicate sends under all conditions.
- **Responsive React Frontend**: Dark-themed SPA built with React 18, Vite, Tailwind CSS, and Lucide icons.

---

## Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Single Page Application with Tailwind CSS and responsive UI |
| **Backend** | Node.js + Express + TypeScript | RESTful API server with Zod validation, Helmet, CORS, and modular routes |
| **Queue** | BullMQ v5 | Distributed message queue managing delayed email execution and retries |
| **Cache & Queue Storage** | Redis 7.0 | In-memory data store for BullMQ job state and atomic rate-limit counters |
| **Database** | MySQL 8.0 + Prisma ORM | Relational persistence with migrations, indexes, and type-safe queries |
| **Search Engine** | Elasticsearch 8.11 | Distributed search and analytics engine for full-text email search |
| **Email Transport** | Ethereal SMTP / Nodemailer | Pooled SMTP transporter generating web preview URLs for safe testing |
| **Queue Monitoring** | Bull Board (`@bull-board/express`) | Real-time visual monitoring dashboard for BullMQ queue states |
| **Authentication** | JWT + Bcrypt + OAuth-Ready | Secure password authentication with Google & Slack OAuth architecture |

---

## System Architecture

```
React Frontend (SPA in Vite)
      ↓ (HTTP / REST API / JWT Auth)
Express API Server (port 5000)
      ↓ (Prisma ORM)
MySQL Database (Users, Senders, Campaigns, ScheduledEmails)
      ↓ (BullMQ addEmailJob with delayMs offset)
Redis 7.0 (Sorted Sets / Delayed Queue: email-scheduler-queue)
      ↓ (Continuous Event-Driven Consumer)
Dedicated Persistent BullMQ Worker (emailWorker.ts)
      ↓ (Atomic Rate Limiting & Delays)
Rate Limiter Service (Redis Lua Script)
      ↓ (SMTP Transport)
Ethereal SMTP Server (Live Preview URL) / Real SMTP Provider
      ↓ (Status Transition: SCHEDULED → PROCESSING → SENT)
MySQL Update (sentAt, messageId, etherealUrl)
      ↓ (Document Indexing)
Elasticsearch 8.11 (Full-Text Search Index)
```

---

## Deployment Architecture

A persistent BullMQ worker and Redis connection cannot run inside an ephemeral serverless function. Therefore, deployment responsibilities are cleanly separated:

### Frontend
- **Hosting**: Static web hosting such as **Vercel**, Netlify, or AWS S3/CloudFront.
- **Vercel Config**: `vercel.json` is configured strictly for the React/Vite SPA (`outputDirectory: "frontend/dist"`, SPA rewrites to `/index.html`).
- **Environment**: Set `VITE_API_URL` to point to your persistent backend API URL.

### Backend & Worker
- **Hosting**: Persistent Node.js container service (e.g. Docker Compose, Railway, Render, Fly.io, AWS ECS, or VPS).
- **Process Entrypoints**:
  - API Server: `npm start` (or `node dist/server.js`)
  - Standalone Worker: `npm run worker` (or `node dist/workers/runWorker.js`)
  - Unified (Server + Embedded Worker): `npm start` automatically initializes both the Express API and the BullMQ worker.

---

## Local Setup & Development

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For local MySQL, Redis, and Elasticsearch

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone https://github.com/Monika-1136/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# 2. Install dependencies (root workspace)
npm install

# 3. Setup environment variables
cp .env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Start local infrastructure via Docker (MySQL, Redis, Elasticsearch)
docker compose up -d mysql redis elasticsearch

# 5. Push Prisma schema to MySQL
cd backend
npx prisma db push
npx prisma generate
cd ..

# 6. Start full-stack development environment
npm run dev
```

### Access URLs
- **Frontend SPA**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Bull Board Dashboard**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Production Deployment Guide

### Option 1: Docker Compose (Full Stack on VPS / Server)

The repository provides a complete [`docker-compose.yml`](docker-compose.yml) running MySQL, Redis, Elasticsearch, Backend API, and Frontend Nginx:

```bash
# Build and run entire containerized stack
docker compose up -d --build

# View container logs
docker compose logs -f
```

### Option 2: Split Cloud Deployment (Vercel Frontend + Render/Railway Backend)

1. **Frontend on Vercel**:
   - Import repository on [Vercel](https://vercel.com/new).
   - Root directory: `./` (or `frontend`).
   - Build command: `npm run build:frontend`.
   - Output directory: `frontend/dist`.
   - Environment Variable: `VITE_API_URL=https://your-backend-api.com`.

2. **Backend & Worker on Railway / Render / Fly.io / VPS**:
   - Deploy backend using Dockerfile (`backend/Dockerfile`) or Node.js runtime.
   - Build command: `npm run build:backend`.
   - Start command: `npm start` (runs API + Worker).
   - Configure managed MySQL, managed Redis, and SMTP environment variables.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Backend HTTP port | `5000` |
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | MySQL connection string | `mysql://root:root@localhost:3306/reachinbox` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint | `http://localhost:9200` |
| `JWT_SECRET` | Secret key for JWT signing | `reachinbox_super_secret_jwt_key_2026` |
| `SESSION_SECRET` | Secret key for sessions | `reachinbox_super_secret_session_key_2026` |
| `FRONTEND_URL` | Whitelisted frontend origin | `http://localhost:5173` |
| `BACKEND_URL` | Public backend URL | `http://localhost:5000` |
| `WORKER_CONCURRENCY` | Concurrent worker jobs | `5` |
| `MIN_EMAIL_DELAY_MS` | Minimum send delay (ms) | `2000` |
| `MAX_EMAILS_PER_HOUR`| Hourly limit per sender | `200` |
| `SMTP_PROVIDER` | `ethereal` or `real` | `ethereal` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Optional |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | Optional |
| `GOOGLE_CALLBACK_URL`| Google OAuth Redirect URI | `http://localhost:5000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` | Slack OAuth Client ID | Optional |
| `SLACK_CLIENT_SECRET` | Slack OAuth Client Secret | Optional |
| `SLACK_REDIRECT_URI` | Slack OAuth Redirect URI | `http://localhost:5000/api/slack/callback` |

---

## Automated Tests & Verification

### Vitest Test Suite (34 Tests Passing)

```bash
cd backend
npm test
```

```text
 ✓ tests/csvParser.test.ts      (5 tests)
 ✓ tests/idempotency.test.ts    (3 tests)
 ✓ tests/rateLimiter.test.ts    (4 tests)
 ✓ tests/slack.test.ts          (3 tests)
 ✓ tests/elasticsearch.test.ts  (2 tests)
 ✓ tests/auth.test.ts           (5 tests)
 ✓ tests/scheduler.test.ts      (2 tests)
 ✓ tests/e2eIntegration.test.ts (10 tests)

 Test Files  8 passed (8)
      Tests  34 passed (34)
```

### 1000+ Load Test Verification

```bash
cd backend
npx tsx src/scripts/testLoad1000Live.ts
```

Verifies:
- 1000+ delayed jobs enqueued atomically into Redis.
- Zero synchronous blocking of the Express API.
- BullMQ worker concurrency and delay spacing respected.
- Zero dropped jobs and zero duplicate sends.

### Restart Persistence Test

```bash
cd backend
npx tsx src/scripts/testDelayedRestartLive.ts
```

Verifies:
- Scheduled future job enters BullMQ as `DELAYED`.
- Backend and worker processes are terminated.
- Redis preserves job state across restart.
- On restart, the same job fires at the exact scheduled time without duplication.

---

## Project Structure

```
reachinbox-email-scheduler/
├── vercel.json                     # Frontend Vercel SPA deployment configuration
├── docker-compose.yml              # Containerized multi-service stack (MySQL, Redis, ES, Backend, Frontend)
├── package.json                    # Monorepo root workspace configuration
├── package-lock.json               # Committed dependency lockfile
├── .gitignore                      # Security exclusions
├── .env.example                    # Environment variable template
├── README.md                       # Architecture & deployment documentation
├── backend/
│   ├── package.json                # Backend scripts & dependencies
│   ├── tsconfig.json               # TypeScript compiler options
│   ├── Dockerfile                  # Production backend container definition
│   ├── prisma/
│   │   └── schema.prisma           # MySQL schema (User, Sender, Campaign, ScheduledEmail, Slack)
│   ├── src/
│   │   ├── server.ts               # Production Express API & embedded BullMQ worker
│   │   ├── app.ts                  # Express routes, CORS, error handling
│   │   ├── config/                 # Redis, MySQL, Elasticsearch, Transporter configs
│   │   ├── controllers/            # REST controllers (auth, emails, senders, slack)
│   │   ├── services/
│   │   │   ├── emailService.ts     # Email scheduling & campaign management
│   │   │   ├── queueService.ts     # BullMQ queue client & job management
│   │   │   ├── rateLimiterService.ts # Redis Lua atomic rate limiting
│   │   │   └── elasticService.ts   # Elasticsearch indexing and search
│   │   ├── workers/
│   │   │   ├── emailWorker.ts      # BullMQ worker processor loop
│   │   │   └── runWorker.ts        # Standalone worker runner
│   │   └── scripts/                # Load tests & restart persistence verification scripts
│   └── tests/                      # Automated Vitest test suite
└── frontend/
    ├── package.json                # Frontend dependencies
    ├── vite.config.ts              # Vite configuration
    ├── tailwind.config.js          # Tailwind styling system
    └── src/
        ├── App.tsx                 # Root routes & auth protection
        ├── components/             # React components (ComposeModal, Tables, Header)
        ├── context/                # AuthContext
        ├── pages/                  # Dashboard, Login, Signup
        └── services/               # Axios API client
```

---

## License

This project is submitted for the ReachInbox Software Development Intern assignment.
