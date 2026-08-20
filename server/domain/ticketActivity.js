const ACTIVITY_TYPES = Object.freeze({
  TICKET_CREATED: "ticket_created",
  STATUS_CHANGED: "status_changed",
  PRIORITY_CHANGED: "priority_changed",
  TECHNICIAN_ASSIGNED: "technician_assigned",
  TECHNICIAN_UNASSIGNED: "technician_unassigned",
  COMMENT_ADDED: "comment_added"
});

const ACTIVITY_TYPE_VALUES = Object.freeze(Object.values(ACTIVITY_TYPES));

function appendTicketActivity(
  ticket,
  { actor, type, previousValue, newValue, metadata }
) {
  const sequence = (ticket.activitySequence || 0) + 1;

  ticket.activitySequence = sequence;
  ticket.activities.push({
    ticket: ticket._id,
    actor,
    type,
    sequence,
    previousValue,
    newValue,
    metadata
  });

  return ticket.activities[ticket.activities.length - 1];
}

module.exports = {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_VALUES,
  appendTicketActivity
};
