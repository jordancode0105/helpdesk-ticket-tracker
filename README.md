# IT Help Desk Ticket Tracker

A portfolio-ready full-stack IT help desk ticket tracker for internship and job applications.

## Tech Stack

- React frontend with Vite
- Node.js and Express backend
- MongoDB with Mongoose connection setup
- JWT authentication with bcrypt password hashing

## Current Phase

Phase 4 includes role-based ticket workflow, technician assignment, status and priority updates, priority filtering, and dashboard cards.

Roles currently available: `requester`, `technician`, and `admin`.

## Folder Structure

```txt
client/
  index.html
  package.json
  vite.config.js
  src/
    api/
      authApi.js
      ticketApi.js
    components/
      CommentForm.jsx
      CommentList.jsx
      ProtectedRoute.jsx
      TicketCard.jsx
      TicketForm.jsx
    context/
      AuthContext.jsx
    pages/
      CreateTicket.jsx
      Login.jsx
      Signup.jsx
      TicketDetails.jsx
      Tickets.jsx
    styles/
      global.css
    App.jsx
    main.jsx
server/
  config/
    db.js
  models/
    Ticket.js
    User.js
  routes/
    authRoutes.js
    ticketRoutes.js
  middleware/
    authMiddleware.js
  utils/
    generateToken.js
  .env.example
  package.json
  server.js
README.md
```

## Backend Setup

1. Install backend dependencies:

```bash
cd server
npm install
```

On Windows PowerShell, use this if script execution blocks `npm`:

```bash
npm.cmd install
```

2. Create a backend environment file:

```bash
copy .env.example .env
```

On macOS or Linux, use:

```bash
cp .env.example .env
```

3. Update `server/.env`:

```env
PORT=9000
MONGO_URI=mongodb://127.0.0.1:27017/helpdesk_tracker
JWT_SECRET=replace_this_with_a_long_random_secret
```

4. Start the backend server:

```bash
npm run dev
```

On Windows PowerShell, use:

```bash
npm.cmd run dev
```

The backend should run at:

```txt
http://localhost:9000
```

## Frontend Setup

1. Open a second terminal from the project root.

2. Install frontend dependencies:

```bash
cd client
npm install
```

On Windows PowerShell, use:

```bash
npm.cmd install
```

3. Start the React app:

```bash
npm run dev
```

On Windows PowerShell, use:

```bash
npm.cmd run dev
```

4. Open the local Vite URL:

```txt
http://127.0.0.1:5173
```

The frontend connects to:

```txt
http://localhost:9000/api
```

To use a different API URL, create `client/.env` and add:

```env
VITE_API_URL=http://localhost:9000/api
```

## Backend Routes

Auth routes:

```txt
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/technicians
```

Ticket routes:

```txt
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
PATCH  /api/tickets/:id/assign
```

Ticket routes require a JWT in the `Authorization` header:

```txt
Authorization: Bearer your_token_here
```

For Phase 4, ticket routes are role-aware:

- Requesters can create tickets and view tickets they created.
- Technicians can view tickets assigned to them and update ticket status.
- Admins can view all tickets, assign tickets to technicians, and update status/priority.
- Ticket priority can be filtered with `GET /api/tickets?priority=High`.

## How To Test Phase 4

1. Start the backend in one terminal:

```bash
cd server
npm.cmd run dev
```

2. Start the frontend in another terminal:

```bash
cd client
npm.cmd run dev
```

3. Visit:

```txt
http://127.0.0.1:5173
```

4. Confirm that the ticket list loads.

5. Create three accounts from `Signup`:
   - one requester
   - one technician
   - one admin

6. Login as the requester.

7. Create a ticket and confirm it appears in the requester's ticket list.

8. Logout and login as the technician.

9. Confirm the technician does not see the requester's ticket yet.

10. Logout and login as the admin.

11. Open the requester's ticket, assign it to the technician, and optionally update priority/status.

12. Logout and login as the technician.

13. Confirm the assigned ticket now appears.

14. Open the ticket and update its status to `In Progress`, `Resolved`, or `Closed`.

15. Logout and login as the requester.

16. Confirm the requester still sees their own ticket with the updated status.

17. Use the priority dropdown on the ticket list to filter visible tickets by priority.

## How To Test Persistence

1. Start the backend and frontend.

2. Create a new ticket from the React app.

3. Confirm the new ticket appears on the ticket detail page.

4. Stop the backend terminal with `Ctrl+C`.

5. Start the backend again:

```bash
cd server
npm.cmd run dev
```

6. Refresh the React app at:

```txt
http://127.0.0.1:5173
```

7. Confirm the ticket you created still appears in the ticket list.

## Next Phase

The next phase can add fuller role-based permissions, dashboard metrics, filtering, and edit/delete controls in the frontend.
