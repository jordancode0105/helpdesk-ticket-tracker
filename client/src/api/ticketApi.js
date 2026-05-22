const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

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

export async function getTickets() {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
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
