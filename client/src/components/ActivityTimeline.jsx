function actorName(event) {
  return event.actor ? event.actor.name : "Unknown user";
}

function userName(value, fallback = "an unknown technician") {
  return value?.user ? value.user.name : fallback;
}

function describeActivity(event) {
  switch (event.type) {
    case "ticket_created":
      return `${actorName(event)} created this ticket.`;
    case "status_changed":
      return `${actorName(event)} changed status from ${event.previousValue.status} to ${event.newValue.status}.`;
    case "priority_changed":
      return `${actorName(event)} changed priority from ${event.previousValue.priority} to ${event.newValue.priority}.`;
    case "technician_assigned":
      return `${actorName(event)} assigned the ticket to ${userName(event.newValue)}.`;
    case "technician_unassigned":
      return `${actorName(event)} unassigned ${userName(event.previousValue)}.`;
    case "comment_added":
      return `${actorName(event)} added a comment.`;
    default:
      return "Ticket activity recorded.";
  }
}

function activityTitle(type) {
  const titles = {
    ticket_created: "Ticket created",
    status_changed: "Status changed",
    priority_changed: "Priority changed",
    technician_assigned: "Technician assigned",
    technician_unassigned: "Technician unassigned",
    comment_added: "Comment added"
  };

  return titles[type] || "Ticket updated";
}

function ActivityTimeline({ events }) {
  if (events.length === 0) {
    return <p className="empty-state">No activity has been recorded for this ticket yet.</p>;
  }

  return (
    <ol className="activity-timeline">
      {events.map((event) => (
        <li className="activity-event" key={event.id}>
          <span className="activity-marker" aria-hidden="true" />
          <div>
            <div className="activity-event-header">
              <strong>{activityTitle(event.type)}</strong>
              {event.actor && <span className="badge">{event.actor.role}</span>}
            </div>
            <p>{describeActivity(event)}</p>
            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ActivityTimeline;
