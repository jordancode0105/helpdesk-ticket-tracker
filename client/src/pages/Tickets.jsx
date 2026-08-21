import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTechnicians } from "../api/authApi.js";
import { getTickets } from "../api/ticketApi.js";
import TicketCard from "../components/TicketCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const priorities = ["All", "Low", "Medium", "High", "Critical"];
const statuses = ["All", "Open", "In Progress", "Resolved", "Closed"];
const categories = [
  "All",
  "Hardware",
  "Software",
  "Network",
  "Account Access",
  "Email",
  "Other"
];
const sorts = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["priority-high", "Highest priority"],
  ["priority-low", "Lowest priority"]
];

const emptyStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0
};

function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [assignedToFilter, setAssignedToFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [technicians, setTechnicians] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().length >= 2 ? searchInput.trim() : "");
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (user.role !== "admin") {
      return;
    }

    getTechnicians()
      .then((data) => setTechnicians(data.users))
      .catch((apiError) => setError(apiError.message));
  }, [user.role]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTickets() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getTickets(
          {
            page,
            limit,
            search: debouncedSearch,
            status: statusFilter,
            priority: priorityFilter,
            category: categoryFilter,
            assignedTo: user.role === "admin" ? assignedToFilter : undefined,
            sort
          },
          { signal: controller.signal }
        );

        if (data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
          setPage(data.pagination.totalPages);
          return;
        }

        setTickets(data.tickets);
        setPagination(data.pagination);
        setStats(data.stats);
      } catch (apiError) {
        if (apiError.name !== "AbortError") {
          setError(apiError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadTickets();

    return () => controller.abort();
  }, [
    assignedToFilter,
    categoryFilter,
    debouncedSearch,
    limit,
    page,
    priorityFilter,
    sort,
    statusFilter,
    user.role
  ]);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function clearQuery() {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setAssignedToFilter("All");
    setSort("newest");
    setPage(1);
  }

  const hasActiveQuery =
    debouncedSearch ||
    statusFilter !== "All" ||
    priorityFilter !== "All" ||
    categoryFilter !== "All" ||
    assignedToFilter !== "All";

  const roleDescription = {
    requester: "Requester view: you can create tickets and track only the tickets you opened.",
    technician: "Technician view: your queue shows tickets an admin assigned to you.",
    admin: "Admin view: you can review every ticket, assign technicians, and adjust workflow fields."
  };

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Tickets</h2>
          <p className="helper-text">{roleDescription[user.role]}</p>
        </div>

        {user.role !== "technician" && (
          <Link className="button" to="/tickets/new">
            New Ticket
          </Link>
        )}
      </div>

      <section className="dashboard-grid">
        <article className="stat-card">
          <span>Total tickets</span>
          <strong>{stats.total}</strong>
          <small>{hasActiveQuery ? "Matching this query" : "Visible to you"}</small>
        </article>
        <article className="stat-card">
          <span>Open tickets</span>
          <strong>{stats.open}</strong>
          <small>Waiting for triage</small>
        </article>
        <article className="stat-card">
          <span>In Progress</span>
          <strong>{stats.inProgress}</strong>
          <small>Currently being worked</small>
        </article>
        <article className="stat-card">
          <span>Resolved</span>
          <strong>{stats.resolved}</strong>
          <small>Ready for closure</small>
        </article>
      </section>

      <div className="filter-bar">
        <div className="filter-grid">
          <label className="search-field">
            Search tickets
            <input
              type="search"
              value={searchInput}
              maxLength={80}
              placeholder="Title, description, or ticket ID"
              onChange={(event) => updateFilter(setSearchInput, event.target.value)}
            />
            {searchInput.trim().length === 1 && (
              <span className="field-hint">Enter at least 2 characters to search.</span>
            )}
          </label>

          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => updateFilter(setStatusFilter, event.target.value)}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select
              value={priorityFilter}
              onChange={(event) => updateFilter(setPriorityFilter, event.target.value)}
            >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
            </select>
          </label>

          <label>
            Category
            <select
              value={categoryFilter}
              onChange={(event) => updateFilter(setCategoryFilter, event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          {user.role === "admin" && (
            <label>
              Assigned technician
              <select
                value={assignedToFilter}
                onChange={(event) => updateFilter(setAssignedToFilter, event.target.value)}
              >
                <option value="All">All assignments</option>
                <option value="unassigned">Unassigned</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Sort
            <select value={sort} onChange={(event) => updateFilter(setSort, event.target.value)}>
              {sorts.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Per page
            <select
              value={limit}
              onChange={(event) => updateFilter(setLimit, Number(event.target.value))}
            >
              {[5, 10, 20, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="button secondary filter-reset" type="button" onClick={clearQuery}>
          Clear filters
        </button>
      </div>

      {isLoading && (
        <div className="state-card">
          <strong>Loading tickets</strong>
          <p>Checking your role and pulling the matching ticket queue.</p>
        </div>
      )}
      {error && (
        <p className="error-message">
          {error}. Please confirm the backend is running and try again.
        </p>
      )}

      {!isLoading && !error && tickets.length === 0 && (
        <div className="state-card">
          <strong>No tickets found</strong>
          <p>
            {!hasActiveQuery
              ? "There are no tickets in this view yet."
              : "No tickets match the current search and filters."}
          </p>
          {user.role === "requester" && (
            <Link className="button secondary" to="/tickets/new">
              Create your first ticket
            </Link>
          )}
        </div>
      )}

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {!isLoading && !error && pagination.totalItems > 0 && (
        <nav className="pagination" aria-label="Ticket pages">
          <button
            className="button secondary"
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} tickets
          </span>
          <button
            className="button secondary"
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

export default Tickets;
