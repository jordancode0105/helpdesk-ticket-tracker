import { useState } from "react";

function CommentForm({ onSubmit, isSaving }) {
  const [text, setText] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (text.trim().length < 3) {
      setValidationMessage("Comment must be at least 3 characters.");
      return;
    }

    setValidationMessage("");
    onSubmit(text.trim());
    setText("");
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      {validationMessage && <p className="error-message">{validationMessage}</p>}

      <label>
        Add comment
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a troubleshooting note or update."
          minLength="3"
          maxLength="2000"
          rows="3"
          required
        />
      </label>

      <button className="button" type="submit" disabled={isSaving}>
        {isSaving ? "Adding..." : "Add Comment"}
      </button>
    </form>
  );
}

export default CommentForm;
