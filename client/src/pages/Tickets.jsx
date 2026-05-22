import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTickets } from "../api/ticketApi.js";
import TicketCard from "../components/TicketCard.jsx";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      try {
        const ticketData = await getTickets();
        setTickets(ticketData);
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTickets();
  }, []);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Tickets</h2>
        </div>

        <Link className="button" to="/tickets/new">
          New Ticket
        </Link>
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
