# ReachInbox Email Job Scheduler

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.7-orange.svg)](https://bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue.svg)](https://www.mysql.com/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11-yellow.svg)](https://www.elastic.co/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2-purple.svg)](https://vitejs.dev/)

A production-ready, distributed outbound email job scheduler built for the **ReachInbox Software Development Intern Assignment**. The system orchestrates high-volume, reliable outbound email campaigns with configurable delays, atomic sender rate limiting, server-restart persistence, full-text Elasticsearch search, and live Bull Board queue monitoring.

---

## 1. Overview

- **Backend:** Express + TypeScript REST API with Prisma ORM and MySQL 8+ database.
- **Frontend:** React 18 + TypeScript + Tailwind CSS SPA with responsive dark mode UI and live loading states.
- **Job Queue:** BullMQ + Redis for distributed, persistent delayed job scheduling (**NO CRON JOBS ARE USED**).
- **Restart Persistence:** Future scheduled jobs survive backend/worker crashes without lost jobs or duplicates.
- **Email Delivery:** Ethereal SMTP sandbox provider generating live web preview URLs (`https://ethereal.email/message/...`) with support for real SMTP.
- **Rate Limiting:** Atomic Redis Lua-backed hourly quota and minimum delay spacing with automatic window rescheduling.
- **Search & Monitoring:** Elasticsearch 8+ multi-field search and Bull Board real-time queue inspector at `/admin/queues`.
- **Integrations:** Real Google OAuth 2.0 and Slack OAuth 2.0 with live rate-limit notifications.

---

## 2. Architecture & Flow Diagrams

### High-Level Architecture

```mermaid
graph TD
    FE["Frontend (React + Vite + TypeScript)"] -->|REST / JWT| BE["Backend (Express + TypeScript)"]
    BE -->|Prisma ORM| DB[("MySQL 8+ Database")]
    BE -->|Job Enqueue| RD[("Redis 7.0")]
    RD -->|Delayed / Active Jobs| BQ["BullMQ Queue"]
    BQ -->|Distribute Jobs| WK["Email Worker (Concurrency = N)"]
    WK -->|Atomic Lua Rate Limit| RD
    WK -->|SMTP Message| ET["Ethereal SMTP Sandbox"]
    ET -->|Web Preview Link| WK
    WK -->|Update Status: SENT| DB
    BE -->|Index / Query| ES[("Elasticsearch 8.11")]
    WK -->|Index Document| ES
    BE -->|OAuth 2.0| GO["Google OAuth"]
    WK -->|Rate Limit Alert| SL["Slack API"]
```

### Scheduling & Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend
    participant Backend as Express API
    participant MySQL
    participant Redis as Redis / BullMQ
    participant Worker as BullMQ Worker
    participant Ethereal as Ethereal SMTP
    participant Elastic as Elasticsearch

    User->>Frontend: Fill Compose Form & Click Schedule
    Frontend->>Backend: POST /api/emails/schedule
    Backend->>Backend: Validate payload & CSV leads (Zod)
    Backend->>MySQL: Create Campaign & ScheduledEmail records (Status: SCHEDULED)
    Backend->>Redis: Enqueue BullMQ Delayed Jobs (delay = startTime - now + i * delayMs)
    Backend-->>Frontend: HTTP 201 Scheduled Confirmation
    Frontend->>Frontend: Reset Compose Form & Refresh Tables

    Note over Redis,Worker: Scheduled Timestamp Arrives (No Cron!)
    Redis->>Worker: Dispatch Due Job
    Worker->>MySQL: Fetch Record & Verify Idempotency (status != SENT)
    Worker->>Redis: Check Hourly Rate Limit (Atomic Lua)
    alt Hourly Limit Exceeded
        Worker->>MySQL: Update scheduledAt to Next Hour Window
        Worker->>Redis: Re-enqueue Job for Next Window
        Worker->>Slack: Send Rate Limit Alert (Deduplicated)
    else Rate Limit OK
        Worker->>MySQL: Transition Status: PROCESSING
        Worker->>Ethereal: Deliver SMTP Message (to: recipientEmail)
        Ethereal-->>Worker: 250 OK + Message ID + Preview URL
        Worker->>MySQL: Update Status: SENT, sentAt, messageId, etherealUrl
        Worker->>Elastic: Index Email Document
    end
```

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Axios.
- **Backend:** Node.js 20+, Express.js, TypeScript, Prisma ORM, Zod, Passport.js.
- **Database:** MySQL 8.0+.
- **Queue & Caching:** BullMQ v5, Redis 7.0 (with AOF persistent volume).
- **Search Engine:** Elasticsearch 8.11.0.
- **Email Provider:** Ethereal Email (Nodemailer with connection pooling).
- **Queue Monitoring:** `@bull-board/express` mounted at `/admin/queues`.
- **Testing:** Vitest, Supertest.

---

## 4. Prerequisites

- **Node.js:** `v20.x` or higher
- **npm:** `v10.x` or higher
- **Docker Desktop:** with Docker Compose (for MySQL, Redis, Elasticsearch)
- **Git**

---

## 5. Clone & Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Monika-1136/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# 2. Configure environment variables
cp .env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start supporting infrastructure (MySQL, Redis, Elasticsearch)
docker-compose up -d mysql redis elasticsearch

# 4. Install backend dependencies and push Prisma schema
cd backend
npm install
npx prisma db push
npx prisma generate

# 5. Install frontend dependencies
cd ../frontend
npm install

# 6. Start development servers
# Terminal 1: Backend API + BullMQ Worker (Port 5000)
cd ../backend
npm run dev

# Terminal 2: Frontend Web App (Port 5174 / 5173)
cd ../frontend
npm run dev
```

- **Frontend App:** [http://localhost:5174](http://localhost:5174)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **Bull Board Dashboard:** [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 6. Environment Variables

| Variable | Type | Description | Required |
|---|---|---|:---:|
| `PORT` | `number` | Express backend port (default: `5000`) | Yes |
| `DATABASE_URL` | `string` | MySQL connection URL (`mysql://root:root@localhost:3306/reachinbox`) | Yes |
| `REDIS_URL` | `string` | Redis connection URL (`redis://localhost:6379`) | Yes |
| `ELASTICSEARCH_URL` | `string` | Elasticsearch URL (`http://localhost:9200`) | Yes |
| `WORKER_CONCURRENCY` | `number` | Concurrent jobs processed by worker (default: `5`) | Yes |
| `MIN_EMAIL_DELAY_MS` | `number` | Minimum delay between sends in ms (default: `2000`) | Yes |
| `MAX_EMAILS_PER_HOUR` | `number` | Hourly sending quota per sender (default: `200`) | Yes |
| `SMTP_PROVIDER` | `string` | `ethereal` (testing) or `real` (production) | Yes |
| `SMTP_HOST` | `string` | SMTP host (`smtp.ethereal.email`) | Yes |
| `SMTP_PORT` | `number` | SMTP port (`587`) | Yes |
| `SMTP_USER` / `SMTP_PASSWORD` | `string` | Optional custom credentials (auto-provisioned if empty) | Optional |
| `GOOGLE_CLIENT_ID` | `string` | Google Cloud OAuth Client ID | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | `string` | Google Cloud OAuth Client Secret | For Google OAuth |
| `GOOGLE_CALLBACK_URL` | `string` | Google OAuth callback (`http://localhost:5000/api/auth/google/callback`) | For Google OAuth |
| `SLACK_CLIENT_ID` | `string` | Slack App Client ID | For Slack OAuth |
| `SLACK_CLIENT_SECRET` | `string` | Slack App Client Secret | For Slack OAuth |
| `SLACK_REDIRECT_URI` | `string` | Slack OAuth redirect URL (`http://localhost:5000/api/slack/callback`) | For Slack OAuth |

---

## 7. Ethereal SMTP Sandbox & Delivery Verification

- **Purpose:** Ethereal is used as the official sandbox SMTP server. It traps emails safely and provides web preview URLs without delivering unsolicited messages to live external inboxes.
- **Transporter Lifecycle:** Nodemailer connection pooling (`pool: true`, `maxConnections: 5`, `rateLimit: 14`) maintains warm sockets, eliminating connection drops (`421 Cannot connect`) and authentication errors (`Missing credentials for PLAIN`).
- **Account Persistence:** The dynamically provisioned Ethereal account is cached in memory and in `.ethereal-account.json` to persist across restarts.
- **Exact Recipient:** Messages are addressed directly to the recipient provided in the CSV (`to: recipientEmail`).
- **Viewing Sent Emails:** Every sent message includes a clickable **"Ethereal Preview"** link in the Sent Emails table opening the message at `https://ethereal.email/message/...`.

---

## 8. BullMQ Scheduling & Restart Persistence (No Cron)

> **CRITICAL ARCHITECTURAL GUARANTEE:**
> **NO CRON JOBS, NO `setInterval`, NO `setTimeout`, AND NO DATABASE POLLING ARE USED.**

1. **Scheduling Mechanism:** When scheduling for `T_future`, the exact delay is calculated as `delayMs = Math.max(0, T_future - Date.now())` and enqueued into BullMQ using Redis sorted sets with timestamp scores.
2. **Restart Persistence:** Redis persists delayed jobs in `bull:email-queue:delayed`. When the Node.js backend/worker stops and restarts:
   - The delayed job remains intact in Redis.
   - The worker reconnects to Redis and resumes timers without recreating jobs or losing scheduling state.
3. **No Blind Startup Recreation:** The server does not loop over MySQL to recreate jobs on startup, preventing duplicate job storms.

---

## 9. Rate Limiting, Throttling & Rescheduling

- **Delay Between Sends:** The Compose form contains a configurable **Delay Between Sends (ms)** (e.g. `2000 ms`). Jobs are staggered using BullMQ delayed offsets (`effectiveStartTime + i * delayMs`).
- **Hourly Quota:** Enforced per sender via atomic Redis Lua script (`email-rate:{senderId}:{hourWindow}`).
- **Rescheduling Behavior:** When the limit is reached:
  - Jobs are **NEVER dropped, deleted, or permanently marked failed**.
  - The worker computes `retryDelayMs` until the next hour window, updates `scheduledAt` in MySQL, and re-enqueues the BullMQ job for the next window.
  - A live Slack alert is posted to the user's connected workspace (deduplicated per sender and window).

---

## 10. Assignment Feature Mapping

| Assignment Requirement | Implementation Details | Status |
|---|---|:---:|
| **Express Backend** | TypeScript Express app with helmet, cors, and structured routing | **PASS** |
| **TypeScript** | Strict type safety across frontend and backend with shared interfaces | **PASS** |
| **MySQL 8+ Database** | Relational schema with Prisma models for `User`, `Sender`, `Campaign`, `Email`, `Slack` | **PASS** |
| **Redis** | Redis 7 container backing BullMQ delayed queues and atomic Lua counters | **PASS** |
| **BullMQ Queue** | Pure BullMQ delayed jobs with configurable concurrency and exponential backoff | **PASS** |
| **No Cron Jobs** | Purely event-driven BullMQ delayed scheduling without any polling or cron loops | **PASS** |
| **Restart Persistence** | Verified live: delayed jobs survive worker process kill and reboot | **PASS** |
| **Idempotency** | Compound deterministic keys (`campaignId:recipientEmail`) and atomic state transitions | **PASS** |
| **Worker Concurrency** | Configurable via `WORKER_CONCURRENCY` env var (default: `5`) | **PASS** |
| **Delay Between Sends** | Restored in UI and backend; spaces multi-recipient jobs via BullMQ delays | **PASS** |
| **Hourly Rate Limit** | Atomic Redis Lua counters track quota per sender | **PASS** |
| **Rate Limit Rescheduling** | Excess jobs are automatically re-enqueued for the next hour window | **PASS** |
| **Slack Real OAuth** | Implemented in `slackService.ts` & `slackController.ts` | **BLOCKED** (Needs App Credentials) |
| **Slack Rate-Limit Alert** | Dispatches Block Kit alert upon limit; deduplicated via Redis NX | **PASS** |
| **Slack Disconnect/Reconnect**| Full disconnect lifecycle clearing token in MySQL | **PASS** |
| **Google OAuth** | Implemented with account selection prompt in `authService.ts` | **BLOCKED** (Needs Client ID) |
| **Login / Signup & Auth** | Password auth with bcrypt, Demo 1-Click login, and `/api/auth/me` profile sync | **PASS** |
| **Ethereal SMTP Delivery** | Pool-managed transporter generating preview URLs stored in MySQL | **PASS** |
| **Elasticsearch** | Indexed on schedule/send; multi-field search with graceful DB fallback | **PASS** |
| **Bull Board** | Mounted at `/admin/queues` showing delayed, active, and completed queues | **PASS** |
| **Compose Form Reset** | `resetForm()` clears subject, body, recipients, uploaded files, and counts on close/success | **PASS** |
| **Scheduled Emails Table** | Displays pending emails with real-time MySQL state and cancellation action | **PASS** |
| **Sent Emails Table** | Displays delivered emails with timestamp, status badge, and clickable Ethereal preview link | **PASS** |

---

## 11. Automated Test Suite (34 Tests Passing)

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
   Duration  4.91s
```

---

## 12. Reproducible Demo Procedures

### A. The 60-Second Server Restart Test

1. Start the app: `npm run dev` (Backend on `5000`, Frontend on `5174`).
2. Open the Compose Modal, select 1 recipient, set start time to **2 minutes in the future**, and click **Schedule Outbound Campaign**.
3. Open Bull Board at [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) and observe the job in **Delayed** state.
4. Stop the backend terminal (`Ctrl + C`).
5. Wait 10 seconds. Notice Redis retains the delayed job.
6. Restart the backend: `npm run dev`.
7. Refresh Bull Board: the job remains in **Delayed** state with its original target timestamp.
8. When the target time arrives, the worker claims the job, delivers to Ethereal, and updates status to `SENT`.
9. Verify the Sent Emails table shows the new record with its Ethereal Preview link.

### B. The Rate-Limit & Delay Test

1. Open the Compose Modal.
2. Set **Hourly Limit: 3** and **Delay: 2000 ms**.
3. Paste 5 recipients and schedule immediately.
4. **Result:**
   - Emails 1, 2, and 3 are delivered in the current hour window staggered by 2 seconds.
   - Emails 4 and 5 hit the rate limit and are automatically rescheduled to the start of the next hour window.
   - If Slack is connected, a rate-limit alert is posted to the channel.

---

## 13. 5-Minute Video Recording Guide

For the submission video (maximum 5 minutes):

| Timestamp | Section | Key Interactions to Show |
|---|---|---|
| `0:00 - 0:30` | **App Overview** | Show Login page (Email + Password, Google button, Demo Login), Dashboard layout, Scheduled/Sent tabs, and Bull Board link. |
| `0:30 - 1:30` | **Compose Campaign** | Open Compose Modal. Show sender selector, subject, body, CSV drag-and-drop / paste, live valid/invalid badge counters, Delay Between Sends (2000ms), and Hourly Limit (200). Click Schedule. |
| `1:30 - 2:15` | **Scheduled Tab & Bull Board** | Show new entries in the Scheduled Emails table. Open `http://localhost:5000/admin/queues` showing the jobs in BullMQ Delayed queue. |
| `2:15 - 3:00` | **Delivery & Ethereal Preview** | Wait for job to process. Show Bull Board transitioning from Delayed → Active → Completed. Open Sent Emails tab and click the **Ethereal Preview** link to display the rendered email in browser. |
| `3:00 - 4:15` | **Critical Restart Demo** | Schedule an email 60s in future. Show job in Delayed queue. Kill backend process in terminal. Restart backend. Show job still in Delayed queue. Wait for timer to expire. Show job successfully executed and marked `SENT`. |
| `4:15 - 5:00` | **Elasticsearch Search & Form Reset** | Type recipient keyword in Elasticsearch search bar. Click New Schedule Mail and verify all form fields and badges are completely reset. |

---

## 14. Assumptions & Trade-offs

1. **Ethereal Email Provider:** Ethereal is chosen as the official assignment provider because it allows end-to-end SMTP delivery verification without sending unsolicited messages to real inboxes. Production real SMTP can be toggled by setting `SMTP_PROVIDER=real`.
2. **Persistent Ethereal Account:** Ethereal account credentials are automatically cached to `.ethereal-account.json` to ensure restart resilience.
3. **Elasticsearch Resilience:** If Elasticsearch is temporarily starting, queries fall back to indexed MySQL lookups without throwing errors.
4. **BullMQ v5 Job Identifiers:** BullMQ v5 disallows colons in Job IDs; UUIDs are used for BullMQ `jobId` and compound strings (`campaignId:recipientEmail`) are stored as MySQL `idempotencyKey`.
