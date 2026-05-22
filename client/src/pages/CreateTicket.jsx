import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket } from "../api/ticketApi.js";
import TicketForm from "../components/TicketForm.jsx";

function CreateTicket() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateTicket(ticketData) {
    setIsSaving(true);
    setError("");

    try {
      const newTicket = await createTicket(ticketData);
      navigate(`/tickets/${newTicket.id}`);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Intake</p>
          <h2>Create Ticket</h2>
          <p className="helper-text">
            Add enough detail for a technician to understand the issue without follow-up.
          </p>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      <TicketForm onSubmit={handleCreateTicket} isSaving={isSaving} />
    </section>
  );
}

export default CreateTicket;
