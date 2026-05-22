import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addComment, getTicket } from "../api/ticketApi.js";
import CommentForm from "../components/CommentForm.jsx";
import CommentList from "../components/CommentList.jsx";

function TicketDetails() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTicket() {
      try {
        const ticketData = await getTicket(id);
        setTicket(ticketData);
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTicket();
  }, [id]);

  async function handleAddComment(text) {
    setIsSavingComment(true);
    setError("");

    try {
      const newComment = await addComment(id, text);

      setTicket((currentTicket) => ({
        ...currentTicket,
        comments: [...currentTicket.comments, newComment]
      }));
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setIsSavingComment(false);
    }
  }

  if (isLoading) {
    return <p className="empty-state">Loading ticket...</p>;
  }

  if (error && !ticket) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <section className="page-section">
      <Link className="text-link" to="/">
        Back to tickets
      </Link>

      <article className="detail-panel">
        <div className="ticket-detail-header">
          <div>
            <p className="eyebrow">Ticket #{ticket.id}</p>
            <h2>{ticket.title}</h2>
          </div>

          <div className="ticket-meta align-right">
            <span className="badge">{ticket.status}</span>
            <span className={`badge priority-${ticket.priority.toLowerCase()}`}>
              {ticket.priority}
            </span>
          </div>
        </div>

        <p className="detail-description">{ticket.description}</p>

        <dl className="detail-grid">
          <div>
            <dt>Category</dt>
            <dd>{ticket.category}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </article>

      <section className="comments-section">
        <div className="page-heading compact">
          <div>
            <p className="eyebrow">Updates</p>
            <h2>Comments</h2>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        <CommentList comments={ticket.comments} />
        <CommentForm onSubmit={handleAddComment} isSaving={isSavingComment} />
      </section>
    </section>
  );
}

export default TicketDetails;
