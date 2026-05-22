import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTickets } from "../api/ticketApi.js";
import TicketCard from "../components/TicketCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const priorities = ["All", "Low", "Medium", "High", "Critical"];

function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [dashboardTickets, setDashboardTickets] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      setIsLoading(true);
      setError("");

      try {
        const allTicketData = await getTickets("All");
        const ticketData =
          priorityFilter === "All" ? allTicketData : await getTickets(priorityFilter);

        setDashboardTickets(allTicketData);
        setTickets(ticketData);
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTickets();
  }, [priorityFilter]);

  const dashboardStats = {
    total: dashboardTickets.length,
    open: dashboardTickets.filter((ticket) => ticket.status === "Open").length,
    inProgress: dashboardTickets.filter((ticket) => ticket.status === "In Progress").length,
    resolved: dashboardTickets.filter((ticket) => ticket.status === "Resolved").length
  };

  const roleDescription = {
    requester: "Showing tickets you created.",
    technician: "Showing tickets assigned to you.",
    admin: "Showing all tickets."
  };

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Tickets</h2>
          <p className="helper-text">{roleDescription[user.role]}</p>
        </div>

        {user.role !== "technician" && (
          <Link className="button" to="/tickets/new">
            New Ticket
          </Link>
        )}
      </div>

      <section className="dashboard-grid">
        <article className="stat-card">
          <span>Total tickets</span>
          <strong>{dashboardStats.total}</strong>
        </article>
        <article className="stat-card">
          <span>Open tickets</span>
          <strong>{dashboardStats.open}</strong>
        </article>
        <article className="stat-card">
          <span>In Progress</span>
          <strong>{dashboardStats.inProgress}</strong>
        </article>
        <article className="stat-card">
          <span>Resolved</span>
          <strong>{dashboardStats.resolved}</strong>
        </article>
      </section>

      <div className="filter-bar">
        <label>
          Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="empty-state">Loading tickets...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && tickets.length === 0 && (
        <p className="empty-state">No tickets have been created yet.</p>
      )}

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </section>
  );
}

export default Tickets;
