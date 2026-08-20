const STATUSES = Object.freeze(["Open", "In Progress", "Resolved", "Closed"]);

const TECHNICIAN_TRANSITIONS = Object.freeze({
  Open: Object.freeze(["In Progress", "Resolved"]),
  "In Progress": Object.freeze(["Open", "Resolved"]),
  Resolved: Object.freeze(["In Progress"]),
  Closed: Object.freeze([])
});

function canTransitionStatus({ from, to, role }) {
  if (from === to) {
    return true;
  }

  if (!STATUSES.includes(from) || !STATUSES.includes(to)) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  if (role === "technician") {
    return TECHNICIAN_TRANSITIONS[from].includes(to);
  }

  return false;
}

module.exports = {
  STATUSES,
  TECHNICIAN_TRANSITIONS,
  canTransitionStatus
};
