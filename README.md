# IT Help Desk Ticket Tracker

[![CI](https://github.com/jordancode0105/helpdesk-ticket-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/jordancode0105/helpdesk-ticket-tracker/actions/workflows/ci.yml)

A full-stack software engineering portfolio simulator that demonstrates authentication, role-based workflows, database persistence, and production deployment. The app uses a help desk ticketing workflow as the product domain, where requesters submit issues, technicians work assigned tickets, and admins manage the queue.

## Live Demo

- Frontend: [https://helpdesk-ticket-tracker.vercel.app](https://helpdesk-ticket-tracker.vercel.app)
- Backend API: [https://it-help-desk-api.onrender.com](https://it-help-desk-api.onrender.com)

The live demo uses seeded demo data and may be reset periodically. The Render backend may take a few seconds to wake up on the first request.

## Project Overview

This project demonstrates a practical role-based web application instead of a generic CRUD app. It includes authentication, protected API routes, role-aware ticket visibility, explicit workflow transitions, a durable ticket audit trail, MongoDB persistence, comments, assignment workflow, priority filtering, deployment configuration, and a clean React interface.

### Simulator Intent and Threat Model

This application is intentionally a public portfolio simulator. During signup, a reviewer chooses `requester`, `technician`, or `admin` to explore that persona's workflow. These roles do not represent privileges in a real organization, and the application contains only synthetic demo data.

After a persona is selected, the backend enforces that role's permissions on every API request. Requesters can act only on tickets they created, technicians can act only on tickets assigned to them and can change only status, and admins manage the synthetic queue. Changing the UI or calling the API directly must not bypass those rules.

## Why I Built This

I built this project to practice and demonstrate full-stack application development from end to end: React UI, Express API design, MongoDB persistence, JWT authentication, password hashing, role-based workflows, environment configuration, and deployment with Vercel, Render, and MongoDB Atlas. The help desk domain gives the app a realistic workflow with ownership, prioritization, and status tracking, while the technical patterns apply broadly to many software engineering roles and product domains.

## Features

- Persona signup, login, and logout
- Password hashing with `bcryptjs`
- JWT authentication stored in `localStorage`
- Role-based users:
  - `requester`
  - `technician`
  - `admin`
- Requesters can create tickets and view their own tickets
- Technicians can view assigned tickets and update status
- Admins can view all tickets, assign technicians, and update status/priority
- MongoDB-backed tickets and comments
- Ticket statuses:
  - Open
  - In Progress
  - Resolved
  - Closed
- Ticket priorities:
  - Low
  - Medium
  - High
  - Critical
- Server-side pagination, search, filtering, and validated sorting
- Dashboard cards for visible tickets
- Comments on ticket detail pages
- Structured activity history for creation, workflow, assignment, priority, and comment events
- Explicit server-enforced status transitions for technicians and admins
- Strict server-side validation and role enforcement
- HTTP security headers, request-size limits, and authentication rate limiting
- Liveness/readiness health checks and structured request logs with correlation IDs
- Reproducible Docker Compose stack with persistent local MongoDB
- Responsive, portfolio-friendly UI

## Activity History and Workflow Rules

Every meaningful ticket mutation appends a structured, immutable activity subdocument to the ticket. Events use an enum-backed type instead of free-form descriptions and record the ticket, actor, timestamp, deterministic per-ticket sequence, typed previous/new values, and relevant metadata such as the comment id. The current event types are ticket creation, status change, priority change, technician assignment, technician unassignment, and comment addition.

The activity array is excluded from normal ticket list/detail queries and is exposed through a dedicated authorized endpoint. It is embedded because ticket fields, comments, and their corresponding audit events can then be committed in one atomic MongoDB document write. Optimistic concurrency prevents two stale document saves from silently overwriting one another. This is an append-only audit trail, not full event sourcing: the ticket document remains the source of current state. The existing hard-delete operation removes the ticket and its embedded history together; it does not create an immediately inaccessible deletion event. A future archival workflow could preserve and record that lifecycle event.

Status transitions are defined centrally on the server:

| Current status | Allowed technician transitions | Allowed admin transitions |
| --- | --- | --- |
| Open | In Progress, Resolved | In Progress, Resolved, Closed |
| In Progress | Open, Resolved | Open, Resolved, Closed |
| Resolved | In Progress | Open, In Progress, Closed |
| Closed | None | Open, In Progress, Resolved |

Technicians must also be assigned to the ticket and may change only status. Requesters cannot change workflow fields. Submitting an unchanged value is a no-op and does not create a misleading event. These rules, the auditable history, and atomic multi-field admin updates demonstrate domain invariants and consistency concerns beyond ordinary CRUD handlers.

## Ticket Query API

`GET /api/tickets` uses page/limit pagination rather than returning the entire visible queue. Page-based pagination fits the current numbered previous/next interface and multiple sort options without adding cursor-token complexity. The API defaults to 10 tickets, accepts up to 50 per page, caps page numbers at 10,000, and uses `_id` as a deterministic tie-breaker for every sort.

Supported query parameters:

| Parameter | Accepted values | Default |
| --- | --- | --- |
| `page` | Integer from 1 to 10,000 | `1` |
| `limit` | Integer from 1 to 50 | `10` |
| `search` | Normalized 2–80 character text query or exact ObjectId | None |
| `status` | `Open`, `In Progress`, `Resolved`, `Closed` | All |
| `priority` | `Low`, `Medium`, `High`, `Critical` | All |
| `category` | `Hardware`, `Software`, `Network`, `Account Access`, `Email`, `Other` | All |
| `assignedTo` | Technician ObjectId or `unassigned`; admin only | All |
| `sort` | `newest`, `oldest`, `priority-high`, `priority-low` | `newest` |

Search uses MongoDB's native weighted text index across title and description, with title weighted more heavily. It does not execute client-provided regular expressions. A valid 24-character ObjectId performs an exact ticket-id lookup. Search, filters, pagination, and sorting are composed with the role predicate first: requesters remain limited to `createdBy`, technicians to `assignedTo`, and admins can query the synthetic queue broadly.

The list response is deliberately different from the detail response:

```json
{
  "tickets": [
    {
      "id": "...",
      "title": "VPN connection fails",
      "descriptionPreview": "The VPN client times out...",
      "descriptionTruncated": false,
      "category": "Network",
      "status": "Open",
      "priority": "High",
      "createdBy": { "id": "...", "name": "Demo Requester", "role": "requester" },
      "assignedTo": null,
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 24,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "stats": {
    "total": 24,
    "open": 10,
    "inProgress": 8,
    "resolved": 5,
    "closed": 1
  }
}
```

List rows contain a bounded description preview and only the user id, name, and role needed by the queue UI. Full descriptions and comments remain on `GET /api/tickets/:id`; activity remains on its separately authorized endpoint. Ticket responses no longer expose user emails.

### Query indexes

The Ticket schema defines indexes around actual queue access patterns:

| Index | Query pattern and field-order rationale |
| --- | --- |
| `{ createdBy, createdAt, _id }` | Requester ownership equality followed by stable newest/oldest traversal. |
| `{ assignedTo, createdAt, _id }` | Technician assignment equality and admin technician filtering followed by stable date order. |
| `{ createdAt, _id }` | Default admin queue ordering without an ownership predicate. |
| `{ status, createdAt, _id }` | Common workflow-status triage followed by stable date order. |
| `{ priority, createdAt, _id }` | Priority-filtered queues followed by stable date order. |
| Weighted `{ title: "text", description: "text" }` | Native term search without unsafe regex or an external service. |

Category is intentionally not indexed because it is low-cardinality and less central than status/priority triage. Requester and technician category queries are still bounded by their role predicates. Each additional index consumes storage and adds write maintenance, so the schema does not create a standalone index for every filter. Custom priority ordering uses the domain order rather than alphabetical storage order and therefore requires a computed sort over the matched set; newest/oldest paths can use the queue indexes directly.

This design avoids unbounded list responses and provides intentional query paths as the demo dataset grows. It is not a claim of production-scale performance; page/offset pagination becomes less efficient on very deep pages, and a cursor design would be the next step if that became an observed workload.

## Tech Stack

- React
- Vite
- React Router
- Node.js
- Express
- MongoDB Atlas
- Mongoose
- bcryptjs
- JSON Web Tokens
- CSS

## Screenshots

### Login

![Login screen for demo users](docs/screenshots/login.png)

### Requester Dashboard

![Requester dashboard with visible tickets and summary cards](docs/screenshots/requester-dashboard.png)

### Admin Assignment

![Admin ticket workflow with technician assignment controls](docs/screenshots/admin-assignment.png)

### Technician Workflow

![Technician dashboard showing assigned tickets and status workflow](docs/screenshots/technician-ticket-view.png)

### Ticket Detail

![Ticket detail page with comments and workflow history](docs/screenshots/ticket-detail.png)

## Folder Structure

```txt
client/
  Dockerfile
  nginx.conf
  index.html
  package.json
  vite.config.js
  src/
    api/
    components/
    context/
    pages/
    styles/
server/
  Dockerfile
  config/
  domain/
  middleware/
  models/
  routes/
  utils/
```

## Environment Variables

Create `server/.env`:

```env
NODE_ENV=development
LOG_LEVEL=info
PORT=9000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_this_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173
```

Optional frontend override in `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:9000/api
```

Do not commit `.env` files. This project ignores `.env` in `.gitignore`.

### Production Environment Variables

Backend production variables:

```txt
MONGO_URI=your_mongodb_atlas_production_connection_string
JWT_SECRET=a_long_random_production_secret
LOG_LEVEL=info
CLIENT_URL=https://your-vercel-app.vercel.app
CLIENT_URLS=https://your-vercel-app.vercel.app
```

Frontend production variables:

```txt
VITE_API_BASE_URL=https://your-render-backend.onrender.com/api
```

Notes:

- `JWT_SECRET` must contain at least 32 characters.
- `JWT_SECRET` must be different from local/demo values.
- `MONGO_URI` should point to the production MongoDB Atlas database.
- `CLIENT_URL` should match the deployed frontend URL exactly.
- Use `CLIENT_URLS` for comma-separated production or preview frontend URLs.

## Setup Instructions

Install backend dependencies:

```bash
cd server
npm install
```

On Windows PowerShell, use:

```bash
npm.cmd install
```

Start the backend:

```bash
npm run dev
```

On Windows PowerShell:

```bash
npm.cmd run dev
```

Install frontend dependencies in a second terminal:

```bash
cd client
npm install
```

On Windows PowerShell:

```bash
npm.cmd install
```

Start the frontend:

```bash
npm run dev
```

On Windows PowerShell:

```bash
npm.cmd run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Docker Local Stack

The repository includes a one-command local stack for reviewers who have Docker Desktop or another Docker Engine with Compose v2. The backend image uses Node.js 22, installs locked production dependencies with `npm ci --omit=dev`, and runs as the non-root `node` user. The frontend uses a multi-stage build because Vite compilation and static serving are genuinely separate concerns: Node builds the assets and an unprivileged Nginx process serves the SPA. Production frontend hosting remains Vercel; the frontend container exists for reproducible local review.

Create the ignored local Compose environment file:

```bash
cp .env.compose.example .env.compose
```

Windows PowerShell:

```powershell
Copy-Item .env.compose.example .env.compose
```

The example secret is intentionally local and public. Replace it before using the stack on a shared machine, and never reuse it in a deployed environment.

Build and start the complete stack:

```bash
docker compose --env-file .env.compose up --build
```

Local endpoints:

```txt
Frontend:        http://127.0.0.1:5173
Backend API:     http://127.0.0.1:9000
MongoDB:         mongodb://127.0.0.1:27017/helpdesk_tracker
API liveness:    http://127.0.0.1:9000/health/live
API readiness:   http://127.0.0.1:9000/health/ready
```

Compose waits for MongoDB to become healthy before starting the API and waits for API readiness before starting the frontend. The `mongo-data` named volume preserves local database records across normal stops and container recreation.

Useful commands:

```bash
docker compose --env-file .env.compose logs -f api
docker compose --env-file .env.compose down
```

`docker compose down` preserves the database volume. Running `docker compose down --volumes` deliberately deletes the local MongoDB data.

## Runtime Health and Observability

`GET /health/live` returns `200 {"status":"ok"}` whenever the Express process can serve requests. It deliberately does not depend on MongoDB, making it suitable for process/container liveness.

`GET /health/ready` checks both Mongoose's connected state and a bounded MongoDB ping. It returns `200` with `{"status":"ready","checks":{"mongodb":"up"}}` when traffic can be served, or `503` with `{"status":"not_ready","checks":{"mongodb":"down"}}` when the database is unavailable. Health responses use `Cache-Control: no-store` and expose no connection strings or database host details.

Every response includes `X-Request-ID`. Safe caller-provided IDs containing 1–100 letters, numbers, `.`, `_`, `:`, or `-` are propagated; unsafe values are replaced with a UUID. Each completed request emits a Pino JSON log containing the request ID, method, path without query parameters, response status, and duration. Request bodies, passwords, JWTs, authorization headers, and user emails are not part of request logs. Unexpected application errors use a distinct structured error event and return the request ID with the generic 500 response.

Production logs are written to standard output/error for Render or another container runtime to collect. `LOG_LEVEL` supports `trace`, `debug`, `info`, `warn`, `error`, `fatal`, and `silent`.

SIGTERM and SIGINT initiate bounded graceful shutdown: the HTTP listener stops accepting new connections, active requests are allowed to finish, Mongoose disconnects, and the process exits cleanly. A 10-second application timeout prevents indefinite shutdown; the Render Blueprint allows 15 seconds before platform termination.

## Architecture and Deployment

Local Compose traffic flows from the browser to the unprivileged Nginx frontend, then to the Node API, which connects to the private `mongo` service and its persistent volume. Only localhost ports are published.

Production remains intentionally split by hosting responsibility:

```txt
Browser -> Vercel static frontend -> Render Docker API -> MongoDB Atlas
```

The root `render.yaml` describes the Docker build context, Dockerfile, readiness path, shutdown allowance, generated JWT secret, and required dashboard-supplied values. Adopting the Blueprint is a manual Render Dashboard action; committing the file does not modify the existing service by itself.

## Automated Backend Tests

The backend integration suite contains 118 tests using Vitest, Supertest, and an automatically managed in-memory MongoDB instance. It creates its own test users and tickets, clears the ephemeral database between tests, and never uses seeded, development, or production data.

Run the complete suite:

```bash
cd server
npm test
```

Run in watch mode:

```bash
npm run test:watch
```

Generate the V8 coverage report:

```bash
npm run test:coverage
```

The suite covers persona signup, JWT rejection cases, role-scoped ticket visibility, requester/technician/admin permissions, both assignment paths, database non-mutation on rejected requests, API boundary validation, the complete technician transition matrix, representative admin transitions, activity authorization, event contents and ordering, pagination boundaries, deterministic sorting, role-safe search, composable filters, list/detail response separation, declared query indexes, health behavior, and request-ID propagation/sanitization.

Coverage regression protection currently requires at least 80% statements, 70% branches, 80% functions, and 80% lines. These thresholds are deliberately below the current coverage so they catch substantial regressions without encouraging tests written only to preserve an arbitrary percentage.

## Continuous Integration

The `CI` GitHub Actions workflow is configured to run for pull requests targeting `main` and pushes to `main`. The status badge above will reflect GitHub's result after the workflow is available on the default branch; this documentation does not assume that a remote run has already passed.

The backend job uses Node.js 22.19.0 to:

- install locked dependencies with `npm ci`
- check server and test JavaScript syntax
- run all backend integration tests against only the ephemeral MongoDB instance
- run coverage and enforce the configured thresholds
- fail on high or critical npm dependency advisories

The frontend job independently uses Node.js 22.19.0 to:

- install locked dependencies with `npm ci`
- create the production Vite build
- fail on high or critical npm dependency advisories

The container job independently:

- validates the Compose configuration with the committed example environment
- builds the backend and frontend images without publishing them

Run the principal checks locally from the repository root:

```bash
npm run check
npm run audit
```

## Deployment Notes

This project is deployed with Vercel for the frontend, Render for the backend API, and MongoDB Atlas for the database.

Current deployment URLs:

```txt
Frontend: https://helpdesk-ticket-tracker.vercel.app
Backend API: https://it-help-desk-api.onrender.com
```

The Render backend may spin down when inactive, so the first live demo request can take a few seconds.

### Render Backend

The repository-defined `render.yaml` configures a Docker web service built from `server/Dockerfile`, uses `/health/ready` for deploy/runtime checks, and gives the application 15 seconds to handle Render's SIGTERM. To adopt it, create or connect a Render Blueprint from the repository. Do not attach the same service to multiple Blueprints.

The Blueprint generates `JWT_SECRET`. These values remain dashboard-managed and must be supplied during initial Blueprint setup or maintained on the existing service:

```txt
MONGO_URI=your_mongodb_atlas_connection_string
CLIENT_URL=https://your-vercel-app.vercel.app
CLIENT_URLS=https://your-vercel-app.vercel.app,https://your-preview-domain.vercel.app
```

Render provides a `PORT` value for web services, so the backend reads `process.env.PORT` automatically.

After the backend deploys, copy the Render service URL. The frontend needs the API URL with `/api` at the end:

```txt
https://your-render-backend.onrender.com/api
```

### Vercel Frontend

Recommended Vercel settings:

```txt
Framework preset: Vite
Root directory: client
Build command: npm run build
Output directory: dist
```

Set this environment variable in Vercel:

```txt
VITE_API_BASE_URL=https://your-render-backend.onrender.com/api
```

Vite only exposes frontend environment variables that start with `VITE_`, so do not put backend secrets in frontend variables.

After Vercel deploys, copy the frontend URL and add it to the backend `CLIENT_URL` value in Render. If you have multiple allowed frontend URLs, add them to `CLIENT_URLS` separated by commas.

Official docs:

- [Render Docker deployment](https://render.com/docs/docker)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render environment variables](https://render.com/docs/configure-environment-variables)
- [Render health checks](https://render.com/docs/health-checks)
- [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

## Demo Account Instructions

Create local demo users and sample tickets with:

```bash
cd server
npm run seed
```

On Windows PowerShell:

```bash
npm.cmd run seed
```

The seed script does not run automatically. It only runs when you manually call `npm run seed`.

The live deployment uses only seeded or reviewer-created synthetic data. Demo records may be reset periodically to keep the project clean for portfolio review.

Demo-only accounts:

```txt
Requester
Email: requester@example.com
Password: Password123!
Role: requester

Technician
Email: technician@example.com
Password: Password123!
Role: technician

Admin
Email: admin@example.com
Password: Password123!
Role: admin
```

The password `Password123!` is for local demo use only. Do not reuse it for real accounts or production deployments.

The seed script hashes demo passwords with `bcryptjs`, upserts the demo users, removes old demo tickets for those demo users, and recreates a small sample ticket queue with representative activity histories.

## Testing The Role Workflow

1. Login as the requester.
2. Create a ticket.
3. Confirm the requester dashboard shows the ticket.
4. Logout and login as the technician.
5. Confirm the technician does not see the ticket yet.
6. Logout and login as the admin.
7. Open the ticket and assign it to the technician.
8. Optionally change the priority or status as admin.
9. Logout and login as the technician.
10. Confirm the assigned ticket appears.
11. Update the ticket status.
12. Logout and login as the requester.
13. Confirm the requester can still track their ticket status.
14. Open the ticket detail page and confirm the activity timeline identifies each actor and change.

## API Routes

Health:

```txt
GET /health/live
GET /health/ready
```

Auth:

```txt
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/technicians
```

Tickets:

```txt
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
GET    /api/tickets/:id/activity
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
PATCH  /api/tickets/:id/assign
```

## Future Improvements

- File attachments
- Email notifications
- Admin user management page
