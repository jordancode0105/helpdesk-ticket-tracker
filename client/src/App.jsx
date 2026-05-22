import { NavLink, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import CreateTicket from "./pages/CreateTicket.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import TicketDetails from "./pages/TicketDetails.jsx";
import Tickets from "./pages/Tickets.jsx";

function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">IT Support</p>
          <h1>Help Desk Ticket Tracker</h1>
        </div>

        <nav className="site-nav">
          {user && (
            <>
              <NavLink to="/" end>
                Tickets
              </NavLink>
              <NavLink to="/tickets/new">Create Ticket</NavLink>
            </>
          )}
          {!user && <NavLink to="/login">Login</NavLink>}
          {!user && <NavLink to="/signup">Signup</NavLink>}
        </nav>
      </header>

      {user && (
        <section className="user-bar">
          <span>
            Logged in as <strong>{user.name}</strong> ({user.role})
          </span>
          <button className="button secondary" type="button" onClick={logout}>
            Logout
          </button>
        </section>
      )}

      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Tickets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <ProtectedRoute>
                <CreateTicket />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <ProtectedRoute>
                <TicketDetails />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
