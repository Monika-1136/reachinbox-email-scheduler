# ReachInbox Outbound Email Scheduler — 5-Minute Demo Script

This document provides a precise, timestamped 5-minute demonstration script for evaluators and reviewers.

---

## 🎬 5-Minute Evaluation Walkthrough

### ⏱ 0:00–0:30 — Authentication & Google Login
1. Open the frontend application at [http://localhost:5173](http://localhost:5173).
2. Note the ReachInbox dark aesthetic matching the Figma design specifications.
3. Click **"Continue with Google"** for real Google OAuth login, or click **"1-Click Demo Login"** for instant evaluator access without entering external credentials.
4. Observe immediate redirect to the dashboard with an authenticated JWT session and user profile.

---

### ⏱ 0:30–1:15 — Dashboard & User Information
1. In the header, note the authenticated user avatar, display name, and email address.
2. Review the top 4 live metrics cards:
   - **Scheduled in Queue**
   - **Successfully Sent**
   - **Delivery Failed**
   - **BullMQ Active/Delayed**
3. Notice the live global search bar powered by **Elasticsearch** and the real-time queue counter badge.

---

### ⏱ 1:15–2:00 — Compose Email & CSV Upload
1. Click the primary **"Schedule Email"** button in the header.
2. In the modal:
   - Enter a Subject (e.g. `Scaling Outbound Pipeline with ReachInbox AI`).
   - Enter Email Body content.
3. Test CSV Lead Detection:
   - Click **"Insert 5 Sample Leads"** (or drag & drop a `.csv` / `.txt` file).
   - Observe the live parser: valid emails detected badge, duplicate detector, malformed address filter, and preview chips.
4. Note the sender account selector showing configured hourly limits.

---

### ⏱ 2:00–2:30 — Scheduling Parameters & Delay Controls
1. In the Compose Modal:
   - Select **Send Now** (or choose **Schedule** with a future timestamp).
   - Configure **Delay Between Sends**: `2000ms`.
   - Configure **Hourly Limit**: `5` (to easily demonstrate rate limiting).
2. Click **"Schedule Outbound Campaign"**.
3. Watch the progress spinner and success confirmation. The modal closes and switches to the **Scheduled Emails** tab.

---

### ⏱ 2:30–3:15 — Scheduled Emails Queue & Live Processing
1. Review the **Scheduled Emails** table:
   - Columns: Recipient Lead, Subject, Sender, Scheduled Execution with relative countdown (`in 2s`, `in 4s`), Status badge (`SCHEDULED` / `PROCESSING`).
2. Notice the live auto-polling: as the BullMQ worker processes jobs, the emails smoothly transition to `PROCESSING` and then disappear from the scheduled list as they complete.

---

### ⏱ 3:15–3:45 — Sent Emails & Live Ethereal SMTP Preview
1. Switch to the **"Sent & Delivered"** tab.
2. Observe all delivered emails with timestamps and message IDs.
3. Click the **"View in Ethereal ↗"** button on any sent email.
4. An Ethereal Web preview tab opens, displaying the rendered HTML email delivered over real SMTP!

---

### ⏱ 3:45–4:20 — 💥 Server Restart Resilience Demonstration
1. Open the Compose Modal and schedule 3 emails for **3 minutes in the future**.
2. Switch to the **"BullMQ Live Queue"** tab or visit [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) and see the 3 jobs in the **Delayed** queue.
3. **Stop the backend server:** In the backend terminal, press `Ctrl + C`.
4. Wait 10 seconds. Note that Redis preserves all delayed jobs in memory without loss.
5. **Start the backend server:** Run `npm run dev:backend`.
6. BullMQ worker reconnects to Redis, picks up the future timers, and sends the emails when their scheduled time arrives!

---

### ⏱ 4:20–4:50 — Rate Limiting & Automatic Rescheduling
1. Click the **"Quick Seed 10 Emails"** button on the dashboard (configured with an hourly limit of `5`).
2. BullMQ processes the first 5 emails within the current hour.
3. When the 6th email is processed, the Redis atomic Lua rate-limiter detects the limit is exhausted.
4. **Rescheduling:** The worker automatically reschedules jobs 6–10 to the next hourly window (`currentHour + 1`).
5. **No Data Loss:** The jobs remain safely in the queue and the Scheduled table updates their scheduled time!

---

### ⏱ 4:50–5:00 — Slack Live Notification & BullMQ Dashboard
1. Switch to the **"Slack Alerts"** tab.
2. Click **"Connect Slack Workspace"** to initiate official Slack OAuth.
3. When connected, note the live rate-limit alert sent to your channel whenever a sender reaches its hourly limit.
4. Note the Redis deduplication key `slack-rate-limit-notified:{senderId}:{hourWindow}` preventing message flooding.
5. Switch to the **"BullMQ Live Queue"** tab and click **"Open Bull Board Dashboard"** to inspect waiting, delayed, active, completed, and failed jobs.

---

## ⚡ Quick Test Commands

```bash
# Seed 20 demo emails with 2000ms delay in 1 command
npm run seed

# Run automated unit and integration tests
npm test

# Launch BullMQ dashboard
open http://localhost:5000/admin/queues
```
