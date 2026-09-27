# ReachInbox Outbound Email Scheduler — 5-Minute Demonstration Script

This document provides a reviewer walkthrough and step-by-step screen recording script designed to demonstrate all key assignment capabilities within **5 minutes**.

---

## ⏱ 5-Minute Recording Timeline & Action Guide

```
┌──────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│  Timestamp   │            Section            │             Key Actions to Show          │
├──────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 0:00 - 0:30  │ 1. Application & Auth Overview│ Login page, Google button, Demo Login    │
│ 0:30 - 1:30  │ 2. Compose Outbound Campaign  │ CSV upload, Delay (2000ms), Rate Limit   │
│ 1:30 - 2:15  │ 3. Bull Board & Scheduled Tab │ /admin/queues (Delayed Queue), UI State  │
│ 2:15 - 3:00  │ 4. Execution & Ethereal View  │ Active → Completed, Ethereal Web Preview │
│ 3:00 - 4:15  │ 5. Critical Server Restart    │ Kill backend, restart, job fires on time │
│ 4:15 - 5:00  │ 6. Search & Form Reset        │ Elasticsearch search, fresh form state   │
└──────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

---

### Step 1: Application & Auth Overview (`0:00 – 0:30`)

1. Navigate to **`http://localhost:5174`** (or `5173`).
2. Show the **Login Page**:
   - Highlight Email & Password inputs.
   - Point out the **"Continue with Google"** button (connected to real Google OAuth 2.0).
   - Click **"1-Click Demo Login"** for instant evaluator access.
3. Show the **Dashboard**:
   - Point out the user profile in the top-right header (`name`, `email`, `avatar`).
   - Point out the **Scheduled Emails** tab, **Sent Emails** tab, and **Admin Queues** link.

---

### Step 2: Compose Outbound Email Campaign (`0:30 – 1:30`)

1. Click the purple **"Schedule Email"** button to open the Compose Modal.
2. Select the **From Sender** account (e.g. `Alex Recruiter <alex@reachinbox.ai>`).
3. Enter:
   - **Subject:** `Accelerate your outbound pipelines with ReachInbox`
   - **Body:** `Hi there, scaling outbound delivery with BullMQ delayed queues and atomic rate limiting.`
4. Drag-and-drop a `.csv` file or paste 3 leads:
   ```text
   vvce23cse0208@vvc.ac.in
   monika300404@gmail.com
   evaluator.lead@reachinbox.test
   ```
5. Point out the live validation badge counters:
   - `3 Valid Recipients Detected`
   - Duplicate filtering badge
6. Point out the **Delay Between Sends (ms):** `2000` (spaces sends by 2 seconds).
7. Point out the **Hourly Rate Limit:** `200` (enforced per sender).
8. Click **"Schedule Outbound Campaign"**.

---

### Step 3: Scheduled Tab & Bull Board Inspector (`1:30 – 2:15`)

1. Observe the success alert and notice the Scheduled Emails table populated from MySQL.
2. Open a new browser tab at **`http://localhost:5000/admin/queues`**:
   - Show the **Bull Board** live queue monitor.
   - Click the **Delayed** tab: show the 3 jobs waiting in Redis sorted sets with their calculated future timestamps.

---

### Step 4: Worker Execution & Ethereal Web Preview (`2:15 – 3:00`)

1. Watch the Bull Board queue transition: `Delayed` → `Active` → `Completed`.
2. Return to the frontend Dashboard and switch to the **Sent Emails** tab:
   - Show the delivered emails marked with green **`SENT`** status and delivery timestamps.
3. Click the **"Ethereal Preview"** link on a sent email:
   - Opens the official Ethereal sandbox web view in browser (`https://ethereal.email/message/...`).
   - Point out exact headers: `To: monika300404@gmail.com`, `From: Alex Recruiter`, `Subject`, and formatted HTML body.

---

### Step 5: The Critical Server Restart Test (`3:00 – 4:15`)

> **Required by Official Assignment Specification:** Proves future scheduled emails survive process crashes without lost jobs or duplicates.

1. In the Compose Modal, choose **"Schedule for Future"** and set the start time **60 seconds ahead**.
2. Click **Schedule Outbound Campaign**.
3. In Bull Board, show the new job in the **Delayed** queue.
4. **Crash the Server:** Go to the backend terminal and press `Ctrl + C` to kill the backend and worker.
5. Wait 10 seconds while the backend is offline.
6. **Reboot the Server:** Run `npm run dev` in the backend terminal.
7. Refresh Bull Board: show that the delayed job remained safely intact in Redis.
8. When the 60-second timer expires, observe the worker automatically process the job.
9. Show the Sent Emails table updated with status **`SENT`** and verify only **ONE** email was delivered (no duplicates).

---

### Step 6: Elasticsearch Search & Form Reset (`4:15 – 5:00`)

1. **Full-Text Search:**
   - In the dashboard search bar, type `monika` or `outbound`.
   - Show that search queries Elasticsearch at `http://localhost:9200/reachinbox-emails` and renders matching records instantly.
2. **Form Reset Lifecycle:**
   - Click the **"Schedule Email"** button.
   - Show that all fields (subject, body, recipients, uploaded files, and badge counters) are completely clean and reset.
3. Conclude the demonstration.
