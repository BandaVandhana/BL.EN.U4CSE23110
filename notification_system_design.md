# Campus Notification Platform — Technical Assessment

---

## Stage 1 — REST API Design

The platform exposes a JSON REST API. Three main resources: users, notifications, and subscriptions.

**Base URL:** `/api/v1`

---

### Endpoints

#### POST /notifications
Send a notification to one or more users.

Request:
```json
{
  "type": "Placement",
  "message": "Infosys drive scheduled for 14th June in Seminar Hall A.",
  "target_user_ids": ["u_101", "u_204", "u_309"]
}
```

Response `201 Created`:
```json
{
  "notification_id": "notif_8821",
  "type": "Placement",
  "message": "Infosys drive scheduled for 14th June in Seminar Hall A.",
  "sent_to": 3,
  "timestamp": "2025-06-10 09:45:00"
}
```

---

#### GET /notifications
Fetch notifications for the authenticated user. Supports filtering and pagination.

Query params: `page`, `limit`, `type`

Request: `GET /api/v1/notifications?page=2&limit=10&type=Result`

Response `200 OK`:
```json
{
  "page": 2,
  "limit": 10,
  "notifications": [
    {
      "id": "notif_7712",
      "type": "Result",
      "message": "Semester 4 results published on the portal.",
      "timestamp": "2025-06-09 18:00:00",
      "viewed": false
    }
  ]
}
```

---

#### PATCH /notifications/:id/viewed
Mark a notification as viewed.

Response `200 OK`:
```json
{
  "id": "notif_7712",
  "viewed": true
}
```

---

#### GET /notifications/priority
Returns top 10 notifications sorted by type priority (Placement > Result > Event) then by timestamp.

Response `200 OK`:
```json
{
  "notifications": [
    {
      "id": "notif_8821",
      "type": "Placement",
      "message": "Infosys drive scheduled for 14th June.",
      "timestamp": "2025-06-10 09:45:00",
      "viewed": false
    }
  ]
}
```

---

### Error responses

```json
{
  "error": "invalid_type",
  "message": "type must be one of: Event, Result, Placement"
}
```

HTTP codes used: `400` bad input, `401` unauthenticated, `404` not found, `500` server error.

---

### Design decisions

- Pagination via `page` + `limit` instead of cursor-based. Simpler to implement and good enough for campus scale. Cursor-based makes more sense if the feed is infinite or real-time sorted.
- `viewed` state is stored server-side in a join table so it survives across devices.
- `type` is an enum enforced at the DB level — no free-text types allowed.
- No soft deletes for now. Notifications are permanent records.

---

## Stage 2 — PostgreSQL Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_notifications (
  user_id         UUID NOT NULL REFERENCES users(id),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  viewed          BOOLEAN NOT NULL DEFAULT FALSE,
  viewed_at       TIMESTAMP,
  PRIMARY KEY (user_id, notification_id)
);
```

The `user_notifications` table is the join table. It keeps notifications normalized — the notification message is stored once, not once per recipient.

**Reasoning:**
- Storing the message in `notifications` and only the relationship + state in `user_notifications` avoids duplicating large text for bulk sends. If a notification goes to 3000 users, only one row in `notifications`.
- `viewed_at` is nullable — NULL means not viewed. Storing the timestamp is useful for analytics later.
- UUID primary keys are fine for campus scale. If performance becomes a concern, switching to BIGSERIAL is an option, but UUIDs avoid any auto-increment coordination issues.

---

### Insertion flow (pseudocode)

```
POST /notifications received
  BEGIN TRANSACTION
    INSERT INTO notifications (type, message) RETURNING id
    FOR each user_id in target_user_ids:
      INSERT INTO user_notifications (user_id, notification_id)
  COMMIT
```

---

## Stage 3 — Query Optimization and Indexing

### The slow query problem

When a user opens the notifications page, the query looks like:

```sql
SELECT n.id, n.type, n.message, n.created_at, un.viewed
FROM user_notifications un
JOIN notifications n ON n.id = un.notification_id
WHERE un.user_id = $1
ORDER BY n.created_at DESC
LIMIT 10 OFFSET 20;
```

Without indexes, this does a sequential scan on `user_notifications` to find all rows for the given `user_id`, then joins to `notifications` and sorts. With 50,000 students and 5,000,000 notifications, that scan gets expensive fast.

**EXPLAIN ANALYZE** will show `Seq Scan` on `user_notifications` and a sort step after the join. Both are avoidable.

---

### Indexes to add

```sql
-- Filter by user, sort by notification creation time
CREATE INDEX idx_un_user_created ON user_notifications (user_id, notification_id);

-- Notifications table: support ORDER BY created_at DESC
CREATE INDEX idx_notif_created ON notifications (created_at DESC);

-- Unread filter: WHERE un.viewed = false AND un.user_id = $1
CREATE INDEX idx_un_user_viewed ON user_notifications (user_id, viewed)
  WHERE viewed = FALSE;
```

The third one is a **partial index** — it only indexes rows where `viewed = FALSE`. Since the majority of reads are for unread notifications and the index doesn't waste space on viewed rows, this is more efficient than a full index on `(user_id, viewed)`.

---

### Why not index every column?

Each index is a separate B-tree that PostgreSQL has to maintain on every `INSERT`, `UPDATE`, and `DELETE`. For a table like `user_notifications` that gets heavy writes during bulk notification sends, adding unnecessary indexes slows down those writes and takes up disk space.

Only index columns that appear in `WHERE`, `JOIN ON`, or `ORDER BY` in actual queries. Indexing `viewed_at` for example is pointless unless you're regularly querying by that field.

---

### Pagination tradeoff

`LIMIT ... OFFSET` works but degrades at high offsets — the database still reads and discards all the rows before the offset. For page 200 with limit 10, it reads 2000 rows to return 10.

For a notification feed, this is usually acceptable since users rarely go beyond page 5 or 6. If it becomes a problem, switch to keyset pagination:

```sql
WHERE un.user_id = $1
  AND n.created_at < $last_seen_timestamp
ORDER BY n.created_at DESC
LIMIT 10;
```

This is O(log n) instead of O(n) because it uses the index directly. Downside: you can't jump to arbitrary pages, only "load more".

---

### Priority inbox query

```sql
SELECT n.id, n.type, n.message, n.created_at, un.viewed
FROM user_notifications un
JOIN notifications n ON n.id = un.notification_id
WHERE un.user_id = $1
ORDER BY
  CASE n.type
    WHEN 'Placement' THEN 1
    WHEN 'Result'    THEN 2
    WHEN 'Event'     THEN 3
  END ASC,
  n.created_at DESC
LIMIT 10;
```

The `CASE` expression in `ORDER BY` adds a sort step that can't use an index directly. For 10 results from potentially hundreds of notifications per user, this is fine. If it needs to be faster, a materialized view that pre-computes priority scores and refreshes on insert is an option.

---

## Stage 4 — Caching with Redis and Real-time Notifications

### Where caching helps

The two queries that get called most are:

1. `GET /notifications` — paginated list for a user
2. `GET /notifications/priority` — top 10 priority notifications

Both are reads. The data changes only when a new notification is sent to the user or they mark something as viewed. These are good cache candidates.

---

### Redis caching strategy

Cache key format:

```
notif:user:{user_id}:page:{page}:limit:{limit}:type:{type}
notif:priority:user:{user_id}
```

Pseudocode for the paginated endpoint:

```
GET /notifications?page=1&limit=10&type=Placement

  key = "notif:user:{user_id}:page:1:limit:10:type:Placement"
  cached = redis.get(key)

  if cached:
    return JSON.parse(cached)

  result = db.query(...)
  redis.set(key, JSON.stringify(result), EX=120)  // 2-minute TTL
  return result
```

TTL is set to 2 minutes. Notifications don't need to appear instantly for a campus platform — a short lag is fine.

**Cache invalidation:** When a new notification is inserted for a user, delete all their cached keys:

```
redis.del("notif:user:{user_id}:*")
```

Redis supports pattern-based deletion via `SCAN` + `DEL`. It's slightly expensive on large key spaces, so prefix keys by user_id to keep scans narrow.

When a user marks a notification as viewed, invalidate just their cache — not everyone's.

---

### Redis for rate limiting

Notification sends can be rate-limited per sender using a Redis counter:

```
key = "ratelimit:send:{sender_id}"
count = redis.incr(key)
if count == 1:
  redis.expire(key, 60)  // 1-minute window
if count > 10:
  return 429 Too Many Requests
```

Simple, and it doesn't touch the database.

---

### Real-time notifications: WebSockets vs polling

**Polling** is the naive approach: the frontend calls `GET /notifications` every 30 seconds. Simple to implement, but wasteful — most polls return nothing new. At 500 concurrent users polling every 30s, that's ~17 requests/second just for notifications.

**WebSockets** are better here. When a notification is created, the server pushes it directly to connected users. No wasted requests.

Implementation approach:

- Maintain a WebSocket connection per logged-in user.
- On the server, keep a map of `user_id → socket`.
- After inserting a notification, push it to any connected recipients.

```
// After notification insert:
for user_id in target_user_ids:
  socket = connected_sockets.get(user_id)
  if socket:
    socket.send(JSON.stringify({
      event: "new_notification",
      data: { id, type, message, timestamp }
    }))
```

Users not connected at the time still get the notification when they next open the app (it's in the DB). WebSockets just give the real-time push for active users.

**Scaling WebSockets:** A single Node.js server can hold ~10,000 WebSocket connections. For a campus with a few thousand concurrent users, one server is fine. If horizontal scaling is needed, use Redis Pub/Sub — each server subscribes, and publishing to a channel broadcasts to all servers, which then push to their local sockets.

---

## Stage 5 — Bulk Notification Flow with Kafka and Fault Tolerance

### The problem with synchronous bulk sends

In Stage 1, the bulk send inserts into `user_notifications` inside a single transaction. This works for 3 users. It doesn't work for 3000.

If we send a placement notification to 4000 students synchronously:
- The HTTP request hangs for seconds (or times out)
- One DB write failure rolls back the whole thing
- No way to retry partial failures
- The client gets no feedback while waiting

---

### Redesigned async flow

```
Client → POST /notifications → API Server → Kafka → Worker → DB + WS push
```

The API server validates the request, writes one row to the `notifications` table, publishes a message to Kafka, and returns `202 Accepted` immediately.

```json
{
  "notification_id": "notif_8821",
  "status": "queued",
  "message": "Notification is being delivered."
}
```

A separate worker service consumes the Kafka message and handles all the inserts and WebSocket pushes.

---

### Kafka topic and message format

Topic: `campus.notifications.send`

Message:
```json
{
  "notification_id": "notif_8821",
  "type": "Placement",
  "message": "Infosys drive scheduled for 14th June.",
  "target_user_ids": ["u_101", "u_204", ..., "u_4000"],
  "created_at": "2025-06-10 09:45:00"
}
```

The worker processes `target_user_ids` in batches of 100:

```
consume message from Kafka

for each batch of 100 user_ids:
  INSERT INTO user_notifications (user_id, notification_id)
  VALUES (...) ON CONFLICT DO NOTHING

  for each user_id in batch:
    push WebSocket event if user is connected
```

`ON CONFLICT DO NOTHING` makes the insert idempotent. If the worker crashes and reprocesses the same message, duplicate inserts are silently skipped.

---

### Retries and dead-letter queue

Kafka doesn't retry automatically, so the worker implements its own retry logic:

```
try:
  process_batch(batch)
except DB_error:
  if attempt < 3:
    sleep(2 ** attempt)  // exponential backoff: 1s, 2s, 4s
    retry
  else:
    publish to "campus.notifications.dlq"
    log error with notification_id and failed user_ids
```

The **dead-letter queue (DLQ)** topic `campus.notifications.dlq` collects messages that failed after all retries. An ops person (or a separate process) can inspect and replay them manually. This prevents silent data loss.

For transient failures (DB timeout, network blip), retries handle it. For persistent failures (schema error, message malformed), retrying forever just clogs the queue — the DLQ is the exit.

---

### Transactional outbox pattern

There's a race condition in the async flow: the API server inserts into `notifications` and then publishes to Kafka. If the server crashes between the two steps, the notification is in the DB but never sent.

The outbox pattern fixes this:

```sql
CREATE TABLE notification_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  payload         JSONB NOT NULL,
  published       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

The API handler does both writes in a single transaction:

```
BEGIN TRANSACTION
  INSERT INTO notifications (type, message) RETURNING id
  INSERT INTO notification_outbox (notification_id, payload)
COMMIT
```

A separate **outbox relay process** polls the outbox table for unpublished rows:

```
SELECT * FROM notification_outbox WHERE published = FALSE ORDER BY created_at LIMIT 50

for each row:
  kafka.publish("campus.notifications.send", row.payload)
  UPDATE notification_outbox SET published = TRUE WHERE id = row.id
```

Now the DB write and the Kafka publish are always in sync. If the relay crashes, it just picks up unpublished rows on restart. The relay should run every 1–2 seconds.

The main cost is the extra table and the polling loop. For a campus platform, this is completely fine.

---

### RabbitMQ as an alternative

If Kafka feels like overkill (it often is for smaller systems), RabbitMQ works fine here. Use a `notifications` exchange with a `send` queue and a `send.dlq` dead-letter queue configured at the queue level.

RabbitMQ natively supports per-message retries and DLQ routing through `x-dead-letter-exchange` headers, so retry logic is simpler to set up than in Kafka. The tradeoff is that RabbitMQ doesn't retain messages after they're consumed — Kafka does, which makes it easier to replay events or audit history.

For this platform, either works. Kafka is the better choice if you expect to add more consumers later (analytics, email service, push notification service all consuming the same event stream). RabbitMQ is simpler to operate at small scale.

---

### Summary of flow

```
POST /notifications (4000 users)
  → validate request
  → BEGIN TX
      INSERT notifications
      INSERT notification_outbox
    COMMIT TX
  → return 202 Accepted

Outbox relay (every 1s):
  → poll outbox for published=FALSE
  → publish to Kafka
  → mark published=TRUE

Kafka worker:
  → consume message
  → INSERT user_notifications in batches of 100 (idempotent)
  → push WebSocket events to online users
  → on failure: retry x3 with backoff → DLQ
```

This way, the HTTP response is fast, the DB writes are atomic, the message queue is the buffer, and failures are retried and surfaced cleanly.

---

## Stage 6 — Priority Inbox

To ensure the most important notifications are displayed first, the Priority Inbox algorithm requires fetching unread notifications and applying a multi-level sort.

**Approach:**
1. **Weight Assignment:** Each notification type is mapped to an integer priority weight. `Placement` receives the highest priority (e.g., 1), `Result` receives 2, and `Event` receives 3.
2. **Compound Sorting:** The sorting function first compares the assigned weight. If the weights are equal (meaning they are of the same type), it falls back to a recency sort by comparing the `Timestamp` fields in descending order (latest first).
3. **Truncation:** After sorting, the array is sliced to return exactly the top 10 notifications.

This algorithm has been implemented directly in the frontend within the `src/app/priority/page.tsx` file using TypeScript. Since new notifications keep coming in, the optimal production-ready mechanism would be to maintain a cached Sorted Set (e.g., in Redis) where the score is a composite of priority and timestamp, enabling `O(1)` or `O(log N)` retrieval of the top 10 elements without re-sorting the entire dataset on every request.

*(Screenshots of the Priority Inbox output have been captured and uploaded to the repository).*

---

## Stage 7 — Frontend Application

A fully responsive frontend application has been developed using **Next.js** and **Material UI**.

**Key Features:**
- **Routing:** Built with Next.js App Router. The main feed is available at `/` and the priority inbox at `/priority`.
- **Filtering & Pagination:** The main feed implements query parameters to fetch notifications by page and specific types (Event, Result, Placement).
- **Viewed State Management:** Distinguishing between new and already viewed notifications is handled gracefully on the frontend. When a user clicks a notification card, its ID is persisted to `localStorage` and its visual opacity/styling updates immediately. A "New" badge is also removed to signify it has been read.
- **Logging Middleware:** Every significant navigation and API request event natively uses the reusable `logging_middleware` package to push structured logs to the central evaluation server.
- **Styling:** Material UI components (Cards, Typography, Chips) were heavily utilized to ensure a clean, professional, and accessible user experience across both desktop and mobile viewports.

*(A video recording demonstrating the functionality of the pages has been recorded and included in the submission).*
