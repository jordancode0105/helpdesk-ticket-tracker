import { useState } from "react";

function CommentForm({ onSubmit, isSaving }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(text);
    setText("");
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <label>
        Add comment
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a troubleshooting note or update."
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
