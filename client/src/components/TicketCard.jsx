import { Link } from "react-router-dom";

function TicketCard({ ticket }) {
  return (
    <article className="ticket-card">
      <div className="ticket-card-header">
        <div>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
        </div>

        <Link className="button secondary" to={`/tickets/${ticket.id}`}>
          View
        </Link>
      </div>

      <div className="ticket-meta">
        <span className="badge">{ticket.status}</span>
        <span className={`badge priority-${ticket.priority.toLowerCase()}`}>
          {ticket.priority}
        </span>
        <span>{ticket.category}</span>
      </div>
    </article>
  );
}

export default TicketCard;
