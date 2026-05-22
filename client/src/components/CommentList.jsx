function CommentList({ comments }) {
  if (comments.length === 0) {
    return <p className="empty-state">No comments yet.</p>;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <p>{comment.text}</p>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
        </article>
      ))}
    </div>
  );
}

export default CommentList;
