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
    requester: "Requester view: you can create tickets and track only the tickets you opened.",
    technician: "Technician view: your queue shows tickets an admin assigned to you.",
    admin: "Admin view: you can review every ticket, assign technicians, and adjust workflow fields."
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
          <small>{user.role === "admin" ? "All tickets" : "Visible to you"}</small>
        </article>
        <article className="stat-card">
          <span>Open tickets</span>
          <strong>{dashboardStats.open}</strong>
          <small>Waiting for triage</small>
        </article>
        <article className="stat-card">
          <span>In Progress</span>
          <strong>{dashboardStats.inProgress}</strong>
          <small>Currently being worked</small>
        </article>
        <article className="stat-card">
          <span>Resolved</span>
          <strong>{dashboardStats.resolved}</strong>
          <small>Ready for closure</small>
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

      {isLoading && (
        <div className="state-card">
          <strong>Loading tickets</strong>
          <p>Checking your role and pulling the matching ticket queue.</p>
        </div>
      )}
      {error && (
        <p className="error-message">
          {error}. Please confirm the backend is running and try again.
        </p>
      )}

      {!isLoading && !error && tickets.length === 0 && (
        <div className="state-card">
          <strong>No tickets found</strong>
          <p>
            {priorityFilter === "All"
              ? "There are no tickets in this view yet."
              : `No ${priorityFilter.toLowerCase()} priority tickets match this view.`}
          </p>
          {user.role === "requester" && (
            <Link className="button secondary" to="/tickets/new">
              Create your first ticket
            </Link>
          )}
        </div>
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
