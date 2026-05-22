import { useState } from "react";

const categories = ["Hardware", "Software", "Network", "Account Access", "Email", "Other"];
const priorities = ["Low", "Medium", "High", "Critical"];

function TicketForm({ onSubmit, isSaving }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Other",
    priority: "Medium"
  });
  const [validationMessage, setValidationMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (formData.title.trim().length < 5) {
      setValidationMessage("Ticket title must be at least 5 characters.");
      return;
    }

    if (formData.description.trim().length < 10) {
      setValidationMessage("Description must be at least 10 characters.");
      return;
    }

    setValidationMessage("");
    onSubmit(formData);
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {validationMessage && <p className="error-message">{validationMessage}</p>}

      <label>
        Ticket title
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Example: Printer will not connect"
          required
        />
        <span className="field-hint">Use a short summary of the issue.</span>
      </label>

      <label>
        Description
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe the issue and any troubleshooting already tried."
          rows="5"
          required
        />
        <span className="field-hint">Include device, app, error message, and what changed.</span>
      </label>

      <div className="form-grid">
        <label>
          Category
          <select name="category" value={formData.category} onChange={handleChange}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          Priority
          <select name="priority" value={formData.priority} onChange={handleChange}>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="button" type="submit" disabled={isSaving}>
        {isSaving ? "Creating..." : "Create Ticket"}
      </button>
    </form>
  );
}

export default TicketForm;
