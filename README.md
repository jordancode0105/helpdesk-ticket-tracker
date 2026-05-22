# IT Help Desk Ticket Tracker

A full-stack IT help desk ticket tracker built for internship and entry-level IT/job applications. The app models a realistic support workflow where requesters submit issues, technicians work assigned tickets, and admins manage the queue.

## Project Overview

This project demonstrates a practical internal support tool instead of a generic CRUD app. It includes authentication, role-based ticket visibility, MongoDB persistence, ticket comments, assignment workflow, status updates, priority filtering, and a clean React interface.

## Why I Built This

I built this project to show that I can connect software development skills to real IT support workflows. Help desk teams need clear intake, ownership, prioritization, and status tracking, so this app gave me a focused way to practice full-stack development while building something relevant to IT internships and junior technical roles.

## Features

- Signup, login, and logout
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
- Priority filtering
- Dashboard cards for visible tickets
- Comments on ticket detail pages
- Responsive, portfolio-friendly UI

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

Add screenshots here before publishing to GitHub:

```txt
screenshots/
  login.png
  requester-dashboard.png
  create-ticket.png
  admin-ticket-workflow.png
  technician-assigned-ticket.png
  ticket-comments.png
```

Suggested README image layout:

```md
![Login screen](screenshots/login.png)
![Requester dashboard](screenshots/requester-dashboard.png)
![Admin workflow](screenshots/admin-ticket-workflow.png)
```

## Folder Structure

```txt
client/
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
  config/
  middleware/
  models/
  routes/
  utils/
```

## Environment Variables

Create `server/.env`:

```env
PORT=9000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_this_with_a_long_random_secret
```

Optional frontend override in `client/.env`:

```env
VITE_API_URL=http://localhost:9000/api
```

Do not commit `.env` files. This project ignores `.env` in `.gitignore`.

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

## Demo Account Instructions

For a clean demo, create three accounts from the Signup page:

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

These are suggested demo credentials only. The app does not seed users automatically yet, so create them manually through the UI.

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

## API Routes

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
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
PATCH  /api/tickets/:id/assign
```

## Future Improvements

- Seed script for demo users and sample tickets
- Better role permissions for closing or reopening tickets
- Search by title or description
- Pagination for large ticket queues
- File attachments
- Email notifications
- Admin user management page
- Deployment to Render/Vercel
- Automated tests with Jest, Supertest, or Playwright
