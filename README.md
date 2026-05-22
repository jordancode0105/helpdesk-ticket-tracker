# IT Help Desk Ticket Tracker

A portfolio-ready full-stack IT help desk ticket tracker for internship and job applications.

## Tech Stack

- React frontend with Vite
- Node.js and Express backend
- MongoDB with Mongoose connection setup
- JWT authentication planned for a later phase

## Current Phase

Phase 2.5 includes the React frontend plus MongoDB-backed ticket and comment routes, so tickets persist after the backend restarts.

Authentication is not included yet.

## Folder Structure

```txt
client/
  index.html
  package.json
  vite.config.js
  src/
    api/
      ticketApi.js
    components/
      CommentForm.jsx
      CommentList.jsx
      TicketCard.jsx
      TicketForm.jsx
    pages/
      CreateTicket.jsx
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
    ticketRoutes.js
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

```txt
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
```

For Phase 2.5, these routes use the Mongoose `Ticket` model so tickets and comments persist in MongoDB.

## How To Test Phase 2.5

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

5. Click `New Ticket`, create a ticket, and confirm you are redirected to the ticket detail page.

6. Add a comment on the ticket detail page and confirm it appears in the comments section.

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

The next phase should add authentication routes, password hashing, JWT token generation, protected middleware, and database-backed controller files.
