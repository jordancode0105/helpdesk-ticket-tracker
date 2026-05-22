# IT Help Desk Ticket Tracker

A portfolio-ready full-stack IT help desk ticket tracker for internship and job applications.

## Tech Stack

- React frontend with Vite
- Node.js and Express backend
- MongoDB with Mongoose connection setup
- JWT authentication with bcrypt password hashing

## Current Phase

Phase 3 includes signup, login, logout, JWT authentication, basic user roles, protected ticket routes, and MongoDB-backed tickets that track who created them.

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
```

Ticket routes:

```txt
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
```

Ticket routes require a JWT in the `Authorization` header:

```txt
Authorization: Bearer your_token_here
```

For Phase 3, tickets and comments use MongoDB through the Mongoose `Ticket` model.

## How To Test Phase 3

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

5. Click `Signup`, create an account, and confirm you are redirected to the ticket list.

6. Confirm your name and role appear in the logged-in user bar.

7. Click `New Ticket`, create a ticket, and confirm you are redirected to the ticket detail page.

8. Confirm the ticket shows who created it.

9. Add a comment on the ticket detail page and confirm it appears in the comments section.

10. Click `Logout` and confirm you are redirected to the login page when trying to view tickets.

11. Login with the same account and confirm the ticket list loads again.

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
