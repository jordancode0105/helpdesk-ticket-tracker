const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

async function handleResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export async function getTickets() {
  const response = await fetch(`${API_BASE_URL}/tickets`);
  return handleResponse(response);
}

export async function getTicket(id) {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`);
  return handleResponse(response);
}

export async function createTicket(ticketData) {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(ticketData)
  });

  return handleResponse(response);
}

export async function addComment(ticketId, text) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  return handleResponse(response);
}
