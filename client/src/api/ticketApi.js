const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:9000/api";

function getAuthHeaders() {
  const token = localStorage.getItem("helpdeskToken");

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

async function handleResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export async function getTickets(priority = "All") {
  const params = new URLSearchParams();

  if (priority !== "All") {
    params.set("priority", priority);
  }

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/tickets?${queryString}` : `${API_BASE_URL}/tickets`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getTicket(id) {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function createTicket(ticketData) {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(ticketData)
  });

  return handleResponse(response);
}

export async function addComment(ticketId, text) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ text })
  });

  return handleResponse(response);
}

export async function updateTicket(ticketId, ticketData) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(ticketData)
  });

  return handleResponse(response);
}

export async function assignTicket(ticketId, assignedTo) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/assign`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ assignedTo })
  });

  return handleResponse(response);
}
