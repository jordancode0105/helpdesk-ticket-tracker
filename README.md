# IT Help Desk Ticket Tracker

A portfolio-ready full-stack IT help desk ticket tracker for internship and job applications.

## Tech Stack

- React frontend
- Node.js and Express backend
- MongoDB with Mongoose
- JWT authentication planned for the next phase

## Current Phase

Phase 1 includes the basic project structure, backend Express server, MongoDB connection setup, user model, ticket model, starter ticket routes, and setup instructions.

## Folder Structure

```txt
it-help-desk-ticket-tracker/
├── client/
│   ├── public/
│   │   └── .gitkeep
│   └── src/
│       ├── api/
│       │   └── .gitkeep
│       ├── components/
│       │   └── .gitkeep
│       ├── context/
│       │   └── .gitkeep
│       ├── pages/
│       │   └── .gitkeep
│       ├── styles/
│       │   └── .gitkeep
│       └── utils/
│           └── .gitkeep
├── server/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── .gitkeep
│   ├── middleware/
│   │   └── .gitkeep
│   ├── models/
│   │   ├── Ticket.js
│   │   └── User.js
│   ├── routes/
│   │   └── ticketRoutes.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── .gitignore
├── package.json
└── README.md
```

## Setup Instructions

1. Install backend dependencies:

```bash
cd server
npm install
```

2. Create a backend environment file:

```bash
copy .env.example .env
```

On macOS or Linux, use:

```bash
cp .env.example .env
```

3. Update `server/.env` with your MongoDB connection string:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/helpdesk_tracker
```

4. Start the backend server:

```bash
npm run dev
```

5. Test the server in a browser or API tool:

```txt
GET http://localhost:5000/
GET http://localhost:5000/api/tickets
```

## Backend Routes Added

```txt
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
```

These routes are starter placeholders for Phase 1. Full database CRUD logic will be added in a later phase.

## Next Phase

The next phase should add authentication routes, password hashing, JWT token generation, protected middleware, and controller files for cleaner route logic.
