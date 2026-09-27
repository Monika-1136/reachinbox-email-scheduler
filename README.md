# ReachInbox Email Scheduler

A production-grade, full-stack asynchronous email scheduling platform built for high-throughput, reliable outbound campaign orchestration. The system processes and validates recipient lists, schedules delayed email jobs via persistent distributed queues, enforces granular rate limits, guarantees job survival across server restarts, dispatches emails through SMTP with live web previews, and indexes all communications into Elasticsearch for instant search.

The platform is designed to be **dual-deployable**:
1. **Serverless on Vercel**: Hosted as a unified full-stack application (Vite SPA frontend + Express Serverless API + Vercel Cron for scheduled email dispatch).
2. **Containerized / VPS**: Run via Docker Compose (or standalone Node.js processes) with BullMQ workers and persistent Redis queues.

---

## Features

- **User Authentication & Session Management**: Secure user signup, login with bcrypt password hashing, JWT-backed sessions, and protected REST API endpoints.
- **Email Campaign Creation**: Interactive campaign composer supporting rich subject lines, HTML bodies, sender profile selection, and timing controls.
- **CSV & TXT Recipient Upload**: Drag-and-drop or file upload parsing of large recipient files alongside direct multiline text entry.
- **Recipient Parsing & Validation**: Real-time email syntax validation, malformed address detection, and actionable badge summaries before dispatch.
- **Duplicate Removal**: Automatic deduplication of recipient lists per campaign to prevent unintended repeat deliveries.
- **Immediate & Future Email Scheduling**: Send instantly or schedule dispatches for any future timestamp (`T_future`) without client-side timers.
- **Configurable Delay Between Emails**: Staggered dispatch offsets between consecutive emails to simulate human pacing and avoid spam traps.
- **Configurable Hourly Sending Limits**: Customizable sending quotas per sender profile enforced atomically.
- **Redis-Backed Rate Limiting**: High-performance atomic Redis Lua scripts tracking hourly windows (`email-rate:{senderId}:{hourWindow}`).
- **BullMQ Delayed Jobs & Vercel Cron**: Distributed job queue orchestrating delayed email execution backed by Redis sorted sets, complemented by Vercel Cron (`/api/cron/process-due`) for serverless production dispatches.
- **Configurable Worker Concurrency**: Scalable background worker processing multiple concurrent jobs controlled via environment configuration.
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
| **Serverless Deployment** | Vercel Serverless Functions + Vercel Cron | Serverless API routes and automated periodic queue dispatches |
| **Database** | MySQL 8.0 + Prisma ORM | Relational persistence with migrations, indexes, and type-safe queries |
| **Queue** | BullMQ v5 | Distributed message queue managing delayed email execution and retries |
| **Cache & Queue Storage** | Redis 7.0 | In-memory data store for BullMQ job state and atomic rate-limit counters |
| **Search Engine** | Elasticsearch 8.11 | Distributed search and analytics engine for full-text email search |
| **Email Transport** | Ethereal SMTP / Nodemailer | Pooled SMTP transporter generating web preview URLs for safe testing |
| **Queue Monitoring** | Bull Board (`@bull-board/express`) | Real-time visual monitoring dashboard for BullMQ queue states |
| **Authentication** | JWT + Bcrypt + OAuth-Ready | Secure password authentication with Google & Slack OAuth architecture |

---

## System Architecture

```
React Frontend (SPA in frontend/dist)
      ↓ (HTTP / REST API / JWT Auth)
Express API Server / Vercel Serverless (api/index.ts)
      ↓ (Prisma ORM)
MySQL Database (Users, Senders, Campaigns, ScheduledEmails)
      ↓ (Job Enqueue & Cron Triggers)
Redis 7.0 / BullMQ / Vercel Cron (/api/cron/process-due)
      ↓ (Worker Consumer / Serverless Processor)
Rate Limiting & Delay Enforcer
      ↓ (SMTP Message)
Ethereal SMTP Server (Live Preview URL) / Real SMTP
      ↓ (Status Transition: SCHEDULED → PROCESSING → SENT)
MySQL Update (sentAt, messageId, etherealUrl)
      ↓ (Document Indexing)
Elasticsearch (Full-Text Search Index)
```

---

## Vercel Production Deployment

The project is pre-configured with `vercel.json` for seamless zero-configuration deployment to Vercel.

### How Vercel Deployment Works

1. **Frontend Output Directory**: The Vite build generates production static assets into `frontend/dist`. `vercel.json` sets `"outputDirectory": "frontend/dist"`.
2. **Serverless API Routes**: The entry point `api/index.ts` exports the Express app instance. All requests to `/api/*` and `/admin/*` are automatically routed to the serverless function.
3. **SPA Client Routing**: All non-API routes (e.g. `/dashboard`, `/login`, `/signup`) automatically fallback to `frontend/dist/index.html` to support React Router refresh.
4. **Vercel Cron Scheduling**: `vercel.json` defines a cron job triggering `/api/cron/process-due` every minute to process any pending scheduled emails that reach their dispatch time.
5. **Prisma Client Generation**: Root `package.json` includes a `"postinstall": "npm run prisma:generate --workspace=backend"` hook, ensuring the Prisma client is generated automatically during Vercel's build phase.

### Deploying to Vercel via Vercel Dashboard / CLI

1. Import your GitHub repository (`reachinbox-email-scheduler`) in [Vercel](https://vercel.com/new).
2. Configure **Environment Variables** in the Vercel Project Settings (see below).
3. Click **Deploy**.

---

## Environment Variables

### Frontend-Safe Variables (Client Bundle)

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_URL` | Base API URL for frontend (leave empty for same-domain Vercel deployment) | *(empty in Vercel, or `http://localhost:5000` in dev)* |

### Backend-Only Secrets (Server Environment)

| Variable | Type | Description | Required? |
|---|---|---|:---:|
| `DATABASE_URL` | Secret | MySQL connection string (e.g. PlanetScale, AWS RDS, Railway, or local MySQL) | **Yes** |
| `JWT_SECRET` | Secret | Secret key for signing authentication JWT tokens | **Yes** |
| `SESSION_SECRET` | Secret | Secret key for session management | **Yes** |
| `NODE_ENV` | String | Environment mode (`production` on Vercel) | **Yes** |
| `REDIS_URL` | Secret | Redis connection string (e.g. Upstash Redis or local Redis) | Optional |
| `ELASTICSEARCH_URL` | Secret | Elasticsearch endpoint URL | Optional |
| `WORKER_CONCURRENCY` | Number | Concurrency limit for email jobs (default: `5`) | Optional |
| `MIN_EMAIL_DELAY_MS` | Number | Default delay between sends in ms (default: `2000`) | Optional |
| `MAX_EMAILS_PER_HOUR`| Number | Hourly sending limit per sender (default: `200`) | Optional |
| `SMTP_PROVIDER` | String | `ethereal` for testing sandbox or `real` for production SMTP | Optional |
| `SMTP_HOST` | String | SMTP host (default: `smtp.ethereal.email`) | Optional |
| `SMTP_PORT` | Number | SMTP port (default: `587`) | Optional |
| `SMTP_USER` | Secret | Custom SMTP user (auto-generated if empty in Ethereal mode) | Optional |
| `SMTP_PASSWORD` | Secret | Custom SMTP password | Optional |
| `GOOGLE_CLIENT_ID` | String | Google OAuth 2.0 Client ID | Optional |
| `GOOGLE_CLIENT_SECRET`| Secret | Google OAuth 2.0 Client Secret | Optional |
| `GOOGLE_CALLBACK_URL`| String | Google OAuth redirect URI | Optional |
| `SLACK_CLIENT_ID` | String | Slack OAuth Client ID | Optional |
| `SLACK_CLIENT_SECRET` | Secret | Slack OAuth Client Secret | Optional |
| `SLACK_REDIRECT_URI` | String | Slack OAuth redirect URI | Optional |

---

## Google OAuth Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** (Web application).
3. Add **Authorized redirect URIs**:
   - For Local Development: `http://localhost:5000/api/auth/google/callback`
   - For Vercel Production: `https://<your-vercel-domain>.vercel.app/api/auth/google/callback`
4. Copy `Client ID` and `Client Secret` into your Vercel Environment Variables (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).

---

## Local Setup & Development

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For local MySQL, Redis, and Elasticsearch

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Monika-1136/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# 2. Install dependencies (root workspace)
npm install

# 3. Setup environment variables
cp .env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Start local infrastructure via Docker
docker compose up -d mysql redis elasticsearch

# 5. Push Prisma schema to MySQL
cd backend
npx prisma db push
npx prisma generate
cd ..

# 6. Start full-stack development environment
npm run dev
```

- **Frontend SPA**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Bull Board Dashboard**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Production Email Scheduler Architecture

### 1. Vercel Serverless Mode
- Immediate emails (`startTime <= now`) are dispatched asynchronously during scheduling.
- Future scheduled emails (`startTime > now`) are stored with `status: SCHEDULED` in MySQL.
- **Vercel Cron** (`vercel.json`) calls `/api/cron/process-due` every minute to claim and dispatch any emails whose `scheduledAt` timestamp has matured.

### 2. Dedicated Worker Mode (Docker / VPS)
- Uses **BullMQ** delayed jobs backed by **Redis sorted sets**.
- The worker loop (`src/workers/emailWorker.ts`) listens to Redis events and executes jobs at exact millisecond offsets without cron polling.
- Restart persistence ensures all delayed timers survive process reboots.

---

## Project Structure

```
reachinbox-email-scheduler/
├── vercel.json                     # Vercel deployment configuration & Cron definition
├── api/
│   └── index.ts                    # Vercel Serverless Function entry point
├── docker-compose.yml              # Local container stack (MySQL, Redis, Elasticsearch)
├── package.json                    # Root npm workspace with postinstall & build scripts
├── package-lock.json               # Committed root dependency lockfile
├── .gitignore                      # Security exclusions (no .env or credentials)
├── .env.example                    # Environment variable reference template
├── README.md                       # Comprehensive documentation
├── backend/
│   ├── package.json                # Backend dependencies & Prisma scripts
│   ├── tsconfig.json               # Backend TypeScript configuration
│   ├── Dockerfile                  # Standalone backend container definition
│   ├── prisma/
│   │   └── schema.prisma           # MySQL relational schema (User, Sender, Campaign, Email, Slack)
│   ├── src/
│   │   ├── server.ts               # Standalone Express & Worker entry point
│   │   ├── app.ts                  # Express application, CORS, and route mounting
│   │   ├── config/
│   │   │   ├── db.ts               # Prisma client singleton
│   │   │   ├── redis.ts            # IORedis configuration
│   │   │   ├── elasticsearch.ts    # Elasticsearch client & graceful fallback
│   │   │   ├── emailTransporter.ts # Nodemailer SMTP pool & Ethereal setup
│   │   │   └── env.ts              # Dynamic environment & Vercel domain resolution
│   │   ├── controllers/            # Route controllers (auth, emails, senders, slack)
│   │   ├── services/
│   │   │   ├── emailService.ts     # Email scheduling & serverless execution
│   │   │   ├── queueService.ts     # BullMQ queue management
│   │   │   ├── rateLimiterService.ts# Redis Lua atomic rate limiting
│   │   │   └── elasticService.ts   # Elasticsearch search service
│   │   └── workers/
│   │       ├── emailWorker.ts      # BullMQ background worker loop
│   │       └── runWorker.ts        # Standalone worker runner
│   └── tests/                      # Automated Vitest test suite (34 tests)
└── frontend/
    ├── package.json                # Frontend dependencies
    ├── vite.config.ts              # Vite configuration & proxy
    ├── tailwind.config.js          # Tailwind styling system
    └── src/
        ├── App.tsx                 # Main application routes
        ├── components/             # React components (ComposeModal, Tables, Senders)
        ├── context/                # Authentication context
        ├── pages/                  # Dashboard, Login, Signup pages
        └── services/               # Axios API client
```

---

## Automated Test Suite (34 Tests Passing)

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

---

## Security & Best Practices

- **Zero Tracked Secrets**: All `.env` files and `.ethereal-account.json` are excluded via `.gitignore`.
- **Password Hashing**: User passwords are saved as secure bcrypt hashes.
- **JWT Authorization**: Authenticated API routes require valid signed Bearer tokens.
- **Dynamic CORS Protection**: Whitelists configured frontend domains and Vercel preview URLs.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
