# ReachInbox Email Scheduler

A production-grade, full-stack asynchronous email scheduling platform built for high-throughput, reliable outbound campaign orchestration. The system processes and validates recipient lists, schedules delayed email jobs via persistent distributed queues, enforces granular rate limits, guarantees job survival across server restarts, dispatches emails through SMTP with live web previews, and indexes all communications into Elasticsearch for instant search.

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
- **BullMQ Delayed Jobs**: Distributed job queue orchestrating delayed email execution backed by Redis sorted sets (**Zero Cron Jobs, Zero `setInterval`**).
- **Configurable Worker Concurrency**: Scalable background worker processing multiple concurrent jobs controlled via environment configuration.
- **Multiple Sender Support**: Manage multiple outbound sender identities with independent rate limits and delivery tracking.
- **MySQL Persistence**: Relational data modeling via Prisma ORM for users, senders, campaigns, scheduled emails, and integration states.
- **Ethereal SMTP Integration**: Real SMTP handshake execution generating instant web preview URLs (`https://ethereal.email/message/...`) with toggle support for production SMTP.
- **Elasticsearch Indexing & Search**: Real-time Elasticsearch 8+ ingestion and multi-field fuzzy search across recipients, subjects, bodies, and statuses.
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
React Frontend (SPA on Port 5173)
      ↓ (HTTP / REST API / JWT Auth)
Express API Server (Port 5000)
      ↓ (Prisma ORM)
MySQL Database (Users, Senders, Campaigns, ScheduledEmails)
      ↓ (Job Enqueue with calculated delayMs)
Redis 7.0 (BullMQ Delayed Sets & State)
      ↓ (Worker Consumer Loop with Concurrency = N)
Email Worker (Asynchronous Process)
      ↓ (Atomic Lua Rate Limit Check & Staggered Delay)
Ethereal SMTP Server (Real SMTP Handshake & Preview URL)
      ↓ (Status Transition: SCHEDULED → PROCESSING → SENT)
MySQL Update (sentAt, messageId, etherealUrl)
      ↓ (Document Indexing)
Elasticsearch (Full-Text Search Index)
```

### Component Responsibilities

1. **Express REST API (`backend/src/server.ts`)**: Validates requests, authenticates users, persists campaigns and scheduled email records to MySQL, and enqueues delayed jobs into Redis via BullMQ. It responds immediately with HTTP 201 without blocking on email delivery.
2. **Asynchronous Email Worker (`backend/src/workers/emailWorker.ts`)**: Operates independently from the HTTP API. It consumes due jobs from BullMQ, verifies idempotency, checks rate limits, executes SMTP delivery, updates MySQL, and indexes results into Elasticsearch.
3. **MySQL & Prisma (`backend/prisma/schema.prisma`)**: Acts as the primary system of record for application state, campaign metadata, delivery histories, and user credentials.
4. **Redis & BullMQ (`backend/src/services/queueService.ts`)**: Holds queue state in persistent sorted sets, firing events exactly when delayed jobs mature without CPU-heavy polling.
5. **Elasticsearch (`backend/src/services/elasticService.ts`)**: Provides multi-field search over sent and scheduled emails with automated index initialization and graceful database fallback.

---

## Email Scheduling Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Marketer
    participant FE as React Frontend
    participant API as Express API
    participant DB as MySQL (Prisma)
    participant Queue as BullMQ / Redis
    participant Worker as Email Worker
    participant SMTP as Ethereal SMTP
    participant ES as Elasticsearch

    User->>FE: Fill Compose modal & upload CSV
    FE->>FE: Parse CSV, validate emails, remove duplicates
    User->>FE: Click "Schedule Outbound Campaign"
    FE->>API: POST /api/emails/schedule (JWT Authenticated)
    API->>API: Validate payload with Zod schema
    API->>DB: Insert Campaign and ScheduledEmail records (Status: SCHEDULED)
    loop For each recipient (staggered by delayMs)
        API->>Queue: Enqueue BullMQ delayed job (delay = startTime - now + i * delayMs)
    end
    API-->>FE: HTTP 201 Created (Campaign ID & Summary)
    FE->>FE: Reset Compose modal & refresh dashboard tables

    Note over Queue,Worker: Target timestamp arrives in BullMQ
    Queue->>Worker: Dispatch ready job to worker
    Worker->>DB: Fetch ScheduledEmail record & verify idempotency
    Worker->>Queue: Check sender hourly rate limit via Redis Lua script
    alt Hourly Rate Limit Exceeded
        Worker->>DB: Update scheduledAt to start of next hour window
        Worker->>Queue: Re-enqueue job with delay until next window
        Worker-->>User: (Optional) Dispatch Slack notification
    else Rate Limit Permitted
        Worker->>DB: Update status to PROCESSING
        Worker->>SMTP: Send email via pooled SMTP connection
        SMTP-->>Worker: 250 OK + Message ID + Preview URL
        Worker->>DB: Update status to SENT, sentAt, messageId, etherealUrl
        Worker->>ES: Index email document for full-text search
    end
    FE->>DB: Polling / Refresh updates dashboard with SENT status & Ethereal preview
```

---

## Reliability & Persistence

- **Why BullMQ Delayed Jobs Instead of Cron/Timers**: Cron jobs and `setInterval` loops run on fixed periodic ticks and require polling entire database tables every minute, creating scale bottlenecks and potential timing jitter. Frontend timers (`setTimeout`) die whenever a browser tab closes. BullMQ relies on Redis sorted sets (`ZADD` with millisecond Unix timestamp scores) to dispatch jobs at the exact millisecond required with zero polling overhead.
- **Redis Queue Durability**: Redis is configured with Append-Only File (`AOF`) persistence (`--appendonly yes`), guaranteeing that scheduled jobs and timestamps survive system restarts.
- **Server Restart Resilience**: When the backend API or background worker stops or crashes:
  - All scheduled and delayed jobs remain intact inside Redis.
  - Upon restarting, the worker reconnects to Redis and immediately resumes monitoring existing delayed jobs without recreating or duplicating them.
  - Jobs whose target time elapsed during downtime are processed immediately upon restart.
- **Idempotency & Duplicate-Send Protection**:
  - Every scheduled email record has a unique deterministic idempotency key (`campaignId:recipientEmail`) enforced at the MySQL database level.
  - When a worker picks up a job, it performs an atomic check-and-set: if the status is already `SENT`, the job is skipped immediately to guarantee that no recipient receives duplicate emails.
- **State Transition Integrity**: Emails strictly follow the lifecycle: `SCHEDULED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SENT` (or `FAILED`).

---

## Rate Limiting & Throughput Controls

- **Worker Concurrency**: Controlled via `WORKER_CONCURRENCY` (default: `5`). Workers process multiple email dispatches concurrently without exceeding server resources.
- **Minimum Delay Between Sends (`delayMs`)**: Users can configure a custom delay in milliseconds (e.g., `2000 ms`) in the Compose modal. When scheduling a campaign of $N$ recipients, the API offsets each job by `effectiveStartTime + (i * delayMs)`, guaranteeing proper spacing between individual sends.
- **Hourly Quota per Sender (`hourlyLimit`)**: Senders have an hourly sending cap (default: `200` emails/hour).
- **Atomic Redis Lua Rate Limiting**: The worker verifies hourly quotas using an atomic Redis Lua script that checks and increments the counter `email-rate:{senderId}:{hourWindow}` in a single round-trip.
- **Automatic Rescheduling on Quota Limit**: When a sender hits their hourly limit:
  - **Jobs are never dropped or failed.**
  - The worker calculates the exact milliseconds remaining until the beginning of the next hour window (`nextWindowDelayMs = nextHourStart - Date.now()`).
  - The email record's `scheduledAt` timestamp is updated in MySQL, and the job is automatically re-enqueued into BullMQ for the next window.

---

## Elasticsearch Integration

- **Indexed Data**: Every email is indexed with fields: `id`, `campaignId`, `userId`, `senderId`, `senderEmail`, `recipientEmail`, `subject`, `body`, `status`, `scheduledAt`, `sentAt`, and `etherealUrl`.
- **Indexing Trigger**: Emails are indexed upon initial scheduling and updated immediately when marked `SENT` or `FAILED`.
- **Search Capabilities**: The dashboard search bar executes multi-field wildcard and fuzzy queries across `recipientEmail`, `subject`, `body`, and `status`.
- **Graceful Fallback**: Elasticsearch is configured for fast text retrieval; MySQL remains the primary source of truth. If Elasticsearch is unreachable during startup, queries automatically fall back to indexed MySQL queries without interrupting the user.

---

## Ethereal SMTP Integration

- **Sandbox Environment**: Ethereal Email (`smtp.ethereal.email`) provides a safe SMTP testing sandbox. Emails are transmitted using real SMTP protocols, but trapped safely without delivering messages to real inboxes.
- **Live Web Preview**: Every email sent through Ethereal returns a unique URL (e.g., `https://ethereal.email/message/...`). The application stores this URL in MySQL and displays a direct **"Ethereal Preview"** link in the Sent Emails dashboard.
- **Connection Pooling**: Nodemailer is configured with pooled connections (`pool: true`, `maxConnections: 5`, `rateLimit: 14`) to maintain warm TCP sockets and eliminate socket dropouts.
- **Production Ready**: Setting `SMTP_PROVIDER=real` along with standard SMTP environment variables allows instant switching to production providers (e.g., SendGrid, Mailgun, Amazon SES).

---

## Bull Board Queue Monitoring

Bull Board is integrated directly into the Express backend to provide real-time queue visibility.

- **URL**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **Features**:
  - Real-time counts of **Delayed**, **Active**, **Waiting**, **Completed**, and **Failed** jobs.
  - Inspection of job payloads, calculated delays, and execution return values.
  - Manual retry and job cleanup controls for administrative inspection.

---

## Project Structure

```
reachinbox-email-scheduler/
├── docker-compose.yml              # Multi-container setup (MySQL, Redis, Elasticsearch)
├── package.json                    # Root npm workspace configuration
├── .gitignore                      # Git exclusion rules (prevents secret leakage)
├── .env.example                    # Root environment configuration template
├── README.md                       # Comprehensive documentation
├── backend/
│   ├── package.json                # Backend dependencies and scripts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── Dockerfile                  # Production container definition
│   ├── .env.example                # Backend environment template
│   ├── prisma/
│   │   └── schema.prisma           # MySQL relational models (User, Sender, Campaign, Email, Slack)
│   ├── src/
│   │   ├── server.ts               # Express application entrypoint
│   │   ├── app.ts                  # Express app setup, middleware, and route mounting
│   │   ├── config/
│   │   │   ├── db.ts               # Prisma client singleton
│   │   │   ├── redis.ts            # IORedis connection configuration
│   │   │   ├── elasticsearch.ts    # Elasticsearch client configuration
│   │   │   ├── emailTransporter.ts # Nodemailer SMTP pool & Ethereal setup
│   │   │   └── env.ts              # Zod-validated environment schema
│   │   ├── controllers/
│   │   │   ├── authController.ts   # Signup, login, demo login, profile handlers
│   │   │   ├── campaignController.ts# Campaign creation and listing
│   │   │   ├── emailController.ts  # Email scheduling, listing, cancellation, search
│   │   │   ├── senderController.ts # Sender profile management
│   │   │   └── slackController.ts  # Slack OAuth connect/disconnect
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts   # JWT authentication verification
│   │   │   ├── validateMiddleware.ts# Zod request validation
│   │   │   └── errorMiddleware.ts  # Global error handler
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/
│   │   │   ├── queueService.ts     # BullMQ queue creation and job enqueuing
│   │   │   ├── rateLimiterService.ts# Redis Lua atomic rate limiting & window calculation
│   │   │   ├── elasticService.ts   # Elasticsearch index management and search
│   │   │   ├── emailService.ts     # Email persistence and status update logic
│   │   │   └── slackService.ts     # Slack API notifications and OAuth integration
│   │   ├── utils/
│   │   │   └── csvParser.ts        # RFC 4180 compliant CSV/TXT email parser
│   │   └── workers/
│   │       ├── emailWorker.ts      # BullMQ worker execution loop & error handling
│   │       └── runWorker.ts        # Standalone worker runner
│   └── tests/                      # Automated Vitest unit & integration test suites
└── frontend/
    ├── package.json                # Frontend dependencies and build scripts
    ├── vite.config.ts              # Vite configuration
    ├── tailwind.config.js          # Tailwind CSS design system tokens
    ├── Dockerfile                  # Frontend container definition
    └── src/
        ├── App.tsx                 # Main routing and authenticated layout
        ├── main.tsx                # React DOM entrypoint
        ├── index.css               # Global CSS & Tailwind imports
        ├── components/
        │   ├── ComposeModal.tsx    # Email composer with CSV upload & date picker
        │   ├── Header.tsx          # Top navigation bar with user profile & stats
        │   ├── ScheduledEmailTable.tsx# Table of pending / scheduled emails
        │   ├── SentEmailTable.tsx  # Table of delivered emails with Ethereal links
        │   ├── SendersView.tsx     # Sender account configuration view
        │   ├── StatsOverview.tsx   # Top-level metric cards
        │   └── SlackIntegrationCard.tsx# Slack OAuth connection card
        ├── context/
        │   └── AuthContext.tsx     # React authentication context & provider
        ├── pages/
        │   ├── DashboardPage.tsx   # Primary application dashboard
        │   ├── LoginPage.tsx       # User login & 1-click demo login
        │   └── SignupPage.tsx      # User registration
        ├── services/
        │   └── api.ts              # Axios API client with auth interceptors
        └── utils/
            └── csvParser.ts        # Client-side CSV/TXT parsing and validation
```

---

## Local Setup & Installation

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: Required for MySQL, Redis, and Elasticsearch containers

### Step 1: Clone Repository & Install Dependencies

```bash
git clone https://github.com/Monika-1136/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# Install root dependencies
npm install

# Install backend and frontend dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Step 2: Configure Environment Variables

Create `.env` in the `backend/` directory based on the template:

```bash
cp backend/.env.example backend/.env
```

#### Environment Variables Reference

| Variable | Description | Default / Example | Required? |
|---|---|---|:---:|
| `PORT` | Express backend listening port | `5000` | **Yes** |
| `NODE_ENV` | Environment mode | `development` | **Yes** |
| `FRONTEND_URL` | Client URL for CORS | `http://localhost:5173` | **Yes** |
| `BACKEND_URL` | Backend URL | `http://localhost:5000` | **Yes** |
| `JWT_SECRET` | Secret key for signing JWT tokens | `reachinbox_super_secret_jwt_key_2026` | **Yes** |
| `SESSION_SECRET` | Secret key for Express sessions | `reachinbox_super_secret_session_key_2026` | **Yes** |
| `DATABASE_URL` | MySQL connection string | `mysql://root:root@localhost:3306/reachinbox` | **Yes** |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | **Yes** |
| `ELASTICSEARCH_URL` | Elasticsearch cluster endpoint | `http://localhost:9200` | **Yes** |
| `WORKER_CONCURRENCY` | Worker concurrent jobs | `5` | **Yes** |
| `MIN_EMAIL_DELAY_MS` | Default send delay spacing (ms) | `2000` | **Yes** |
| `MAX_EMAILS_PER_HOUR`| Default sender hourly limit | `200` | **Yes** |
| `SMTP_PROVIDER` | `ethereal` for sandbox or `real` | `ethereal` | **Yes** |
| `SMTP_HOST` | SMTP server host | `smtp.ethereal.email` | **Yes** |
| `SMTP_PORT` | SMTP port | `587` | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `your_google_client_id_here` | Optional |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | `your_google_client_secret_here`| Optional |
| `GOOGLE_CALLBACK_URL`| Google OAuth Redirect URI | `http://localhost:5000/api/auth/google/callback` | Optional |
| `SLACK_CLIENT_ID` | Slack App Client ID | `your_slack_client_id_here` | Optional |
| `SLACK_CLIENT_SECRET`| Slack App Client Secret | `your_slack_client_secret_here` | Optional |
| `SLACK_REDIRECT_URI` | Slack OAuth Redirect URI | `http://localhost:5000/api/slack/callback` | Optional |

---

## Database & Infrastructure Setup

Start MySQL, Redis, and Elasticsearch containers using Docker Compose:

```bash
docker compose up -d mysql redis elasticsearch
```

Verify the containers are healthy:

```bash
docker compose ps
```

Push the Prisma database schema to MySQL:

```bash
cd backend
npx prisma db push
npx prisma generate
```

---

## Running the Application

### Option A: Run Full Stack Simultaneously (Recommended)

From the root project directory:

```bash
npm run dev
```

### Option B: Run Services in Separate Terminals

**Terminal 1 — Backend API & Worker:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend Application:**
```bash
cd frontend
npm run dev
```

### Default Application URLs

| Service | Local URL |
|---|---|
| **Frontend Application** | [http://localhost:5173](http://localhost:5173) |
| **Backend REST API** | [http://localhost:5000](http://localhost:5000) |
| **Bull Board Queue Dashboard** | [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) |
| **API Health Check** | [http://localhost:5000/api/health](http://localhost:5000/api/health) |

---

## Google OAuth & Slack Integrations

- **Google OAuth 2.0**: The backend includes a complete Passport.js Google OAuth 2.0 flow (`/api/auth/google`). To activate live Google authentication, configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the Google Cloud Console.
- **Slack OAuth 2.0 & Alerts**: The application includes OAuth connection logic and live rate-limit alerting. When configured with `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`, users can connect their Slack workspace to receive automated notifications whenever a sender reaches their hourly sending limit.
- **Credential-Ready Architecture**: Both integrations are fully implemented in code. In the absence of third-party credentials, local email/password authentication and 1-Click Demo Login provide full access to all scheduling features.

---

## Testing & Verification

The repository includes an automated Vitest test suite verifying unit logic, rate limiters, idempotency, and end-to-end scheduling scenarios.

```bash
cd backend
npm test
```

### Automated Test Coverage (34 Tests Passing)

```
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

## Assignment Feature Mapping

| Assignment Requirement | Repository Implementation | Verification Status |
|---|---|:---:|
| **Express Backend & TypeScript** | Express 4.19 with strict TypeScript and Zod validation schemas | **VERIFIED** |
| **MySQL Persistence & Prisma** | Relational database schema with Prisma ORM and indexed relations | **VERIFIED** |
| **BullMQ & Redis Queue** | Distributed BullMQ v5 queue on Redis 7 with sorted sets | **VERIFIED** |
| **No Cron Jobs** | Purely event-driven delayed scheduling without cron or interval loops | **VERIFIED** |
| **Restart Persistence** | Redis-persisted delayed queue survives process crash and restart | **VERIFIED** |
| **Idempotent Delivery** | Unique compound keys (`campaignId:recipientEmail`) preventing double sends | **VERIFIED** |
| **Configurable Concurrency** | Worker concurrency controlled via `WORKER_CONCURRENCY` | **VERIFIED** |
| **Delay Between Sends** | Multi-recipient staggering via calculated BullMQ delayed offsets | **VERIFIED** |
| **Hourly Rate Limiting** | Atomic Redis Lua script rate limiter per sender | **VERIFIED** |
| **Rate Limit Rescheduling** | Automatic rescheduling to next hour window instead of dropping jobs | **VERIFIED** |
| **Multiple Senders** | Full sender profile management with independent quotas | **VERIFIED** |
| **Ethereal SMTP Integration** | Pooled SMTP transport generating live web preview links | **VERIFIED** |
| **Elasticsearch Search** | Real-time indexing and multi-field fuzzy search | **VERIFIED** |
| **Bull Board Dashboard** | Real-time queue inspector mounted at `/admin/queues` | **VERIFIED** |
| **CSV & TXT File Upload** | File parsing, email validation, syntax checks, and deduplication | **VERIFIED** |
| **Scheduled & Sent Tables** | Dedicated tabs with real-time state, cancellations, and previews | **VERIFIED** |
| **User Authentication** | Secure password authentication with bcrypt and JWT tokens | **VERIFIED** |

---

## Security & Best Practices

- **Password Protection**: Passwords hashed with `bcryptjs` using a salt work factor of 10.
- **Route Protection**: REST API endpoints protected with JWT middleware verifying user token signatures.
- **Tenant Isolation**: Database queries enforce user isolation (`userId` checks on all operations).
- **Environment Isolation**: Secrets, database credentials, and API keys are managed purely via environment variables.
- **Zero Committed Secrets**: `.env` and `.ethereal-account.json` are strictly excluded through `.gitignore`.
- **API Defense**: Integrated `helmet` security headers and configured `cors` origins.

---

## Known Assumptions & Configuration

1. **SMTP Sandbox**: Ethereal is used as the assignment sandbox to verify SMTP handshakes without delivering spam to external recipients.
2. **Third-Party OAuth**: Google and Slack integrations require developer-provided OAuth credentials in `.env` to communicate with live external provider APIs.
3. **Database & Infrastructure**: MySQL 8.0+, Redis 7.0+, and Elasticsearch 8.11+ run locally via Docker Compose.

---

## Recommended Demo Flow

1. **Authentication**: Sign up or click **"1-Click Demo Login"** on the login page.
2. **Recipient Upload & Validation**: Open the Compose modal, upload a CSV or paste a mixed list of valid and duplicate email addresses, and observe automatic cleaning.
3. **Configure Timing & Throughput**: Set a 2000 ms delay between sends, configure an hourly limit, and select a future dispatch time or immediate sending.
4. **Schedule Campaign**: Click **"Schedule Outbound Campaign"** and observe records populate in the **Scheduled Emails** table.
5. **Inspect Bull Board**: Open `http://localhost:5000/admin/queues` to see delayed jobs in the queue.
6. **Verify Restart Persistence**: Stop the backend process (`Ctrl + C`), restart it with `npm run dev`, and observe the delayed job still pending in Bull Board at its target time.
7. **Email Delivery & Ethereal Preview**: Allow the job to execute, switch to the **Sent Emails** tab, and click the **Ethereal Preview** link to view the delivered email in the browser.
8. **Full-Text Search**: Enter search queries in the Elasticsearch search bar to instantly filter sent and scheduled records.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
