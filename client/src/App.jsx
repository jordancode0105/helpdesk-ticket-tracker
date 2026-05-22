import { NavLink, Route, Routes } from "react-router-dom";
import CreateTicket from "./pages/CreateTicket.jsx";
import TicketDetails from "./pages/TicketDetails.jsx";
import Tickets from "./pages/Tickets.jsx";

function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">IT Support</p>
          <h1>Help Desk Ticket Tracker</h1>
        </div>

        <nav className="site-nav">
          <NavLink to="/" end>
            Tickets
          </NavLink>
          <NavLink to="/tickets/new">Create Ticket</NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Tickets />} />
          <Route path="/tickets/new" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<TicketDetails />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
