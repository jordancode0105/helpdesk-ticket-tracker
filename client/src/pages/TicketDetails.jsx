import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTechnicians } from "../api/authApi.js";
import { addComment, getTicket, getTicketActivity, updateTicket } from "../api/ticketApi.js";
import ActivityTimeline from "../components/ActivityTimeline.jsx";
import CommentForm from "../components/CommentForm.jsx";
import CommentList from "../components/CommentList.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const statuses = ["Open", "In Progress", "Resolved", "Closed"];
const priorities = ["Low", "Medium", "High", "Critical"];
const technicianStatusOptions = {
  Open: ["Open", "In Progress", "Resolved"],
  "In Progress": ["In Progress", "Open", "Resolved"],
  Resolved: ["Resolved", "In Progress"],
  Closed: ["Closed"]
};

function TicketDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [activity, setActivity] = useState([]);
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
        const [ticketData, activityData] = await Promise.all([
          getTicket(id),
          getTicketActivity(id)
        ]);
        setTicket(ticketData);
        setActivity(activityData.events);
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

  async function refreshActivity() {
    const activityData = await getTicketActivity(id);
    setActivity(activityData.events);
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
          priority: workflowData.priority,
          assignedTo: workflowData.assignedTo
        });
      }

      setTicket(updatedTicket);
      setWorkflowData({
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        assignedTo: updatedTicket.assignedTo ? updatedTicket.assignedTo.id : ""
      });
      await refreshActivity();
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
      await refreshActivity();
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

  const availableStatuses =
    user.role === "admin" ? statuses : technicianStatusOptions[ticket.status];

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
                : ticket.status === "Closed"
                  ? "Closed tickets can only be reopened by an admin."
                  : "Technicians can start work, resolve work, or reopen a resolution on assigned tickets."}
            </p>
          </div>

          <form className="workflow-form" onSubmit={handleWorkflowSubmit}>
            <label>
              Status
              <select name="status" value={workflowData.status} onChange={handleWorkflowChange}>
                {availableStatuses.map((status) => (
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

            <button
              className="button"
              type="submit"
              disabled={
                isSavingWorkflow ||
                (user.role === "technician" && availableStatuses.length === 1)
              }
            >
              {isSavingWorkflow ? "Saving..." : "Save Workflow"}
            </button>
          </form>
        </section>
      )}

      <section className="activity-section">
        <div className="page-heading compact">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>Activity</h2>
            <p className="helper-text">A chronological record of meaningful ticket changes.</p>
          </div>
        </div>

        <ActivityTimeline events={activity} />
      </section>

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
