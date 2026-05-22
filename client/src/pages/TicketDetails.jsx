import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTechnicians } from "../api/authApi.js";
import { addComment, assignTicket, getTicket, updateTicket } from "../api/ticketApi.js";
import CommentForm from "../components/CommentForm.jsx";
import CommentList from "../components/CommentList.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const statuses = ["Open", "In Progress", "Resolved", "Closed"];
const priorities = ["Low", "Medium", "High", "Critical"];

function TicketDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [workflowData, setWorkflowData] = useState({
    status: "Open",
    priority: "Medium",
    assignedTo: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTicket() {
      try {
        const ticketData = await getTicket(id);
        setTicket(ticketData);
        setWorkflowData({
          status: ticketData.status,
          priority: ticketData.priority,
          assignedTo: ticketData.assignedTo ? ticketData.assignedTo.id : ""
        });
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTicket();
  }, [id]);

  useEffect(() => {
    async function loadTechnicians() {
      if (user.role !== "admin") {
        return;
      }

      try {
        const data = await getTechnicians();
        setTechnicians(data.users);
      } catch (apiError) {
        setError(apiError.message);
      }
    }

    loadTechnicians();
  }, [user.role]);

  function handleWorkflowChange(event) {
    const { name, value } = event.target;

    setWorkflowData((currentData) => ({
      ...currentData,
      [name]: value
    }));
  }

  async function handleWorkflowSubmit(event) {
    event.preventDefault();
    setIsSavingWorkflow(true);
    setError("");

    try {
      let updatedTicket = ticket;

      if (user.role === "technician") {
        updatedTicket = await updateTicket(id, { status: workflowData.status });
      }

      if (user.role === "admin") {
        updatedTicket = await updateTicket(id, {
          status: workflowData.status,
          priority: workflowData.priority
        });
        updatedTicket = await assignTicket(id, workflowData.assignedTo);
      }

      setTicket(updatedTicket);
      setWorkflowData({
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        assignedTo: updatedTicket.assignedTo ? updatedTicket.assignedTo.id : ""
      });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setIsSavingWorkflow(false);
    }
  }

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
          <div>
            <dt>Created By</dt>
            <dd>{ticket.createdBy ? ticket.createdBy.name : "Unknown"}</dd>
          </div>
          <div>
            <dt>Assigned To</dt>
            <dd>{ticket.assignedTo ? ticket.assignedTo.name : "Unassigned"}</dd>
          </div>
        </dl>
      </article>

      {(user.role === "technician" || user.role === "admin") && (
        <section className="workflow-panel">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>Update Ticket</h2>
            <p className="helper-text">
              {user.role === "admin"
                ? "Admins can assign technicians and adjust status or priority."
                : "Technicians can move assigned tickets through the status workflow."}
            </p>
          </div>

          <form className="workflow-form" onSubmit={handleWorkflowSubmit}>
            <label>
              Status
              <select name="status" value={workflowData.status} onChange={handleWorkflowChange}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {user.role === "admin" && (
              <>
                <label>
                  Priority
                  <select name="priority" value={workflowData.priority} onChange={handleWorkflowChange}>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Assigned technician
                  <select
                    name="assignedTo"
                    value={workflowData.assignedTo}
                    onChange={handleWorkflowChange}
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <button className="button" type="submit" disabled={isSavingWorkflow}>
              {isSavingWorkflow ? "Saving..." : "Save Workflow"}
            </button>
          </form>
        </section>
      )}

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
