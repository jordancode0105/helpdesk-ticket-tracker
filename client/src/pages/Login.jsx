import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await login(formData);
      navigate("/");
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Welcome Back</p>
          <h2>Login</h2>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" value={formData.email} onChange={handleChange} required />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

        <button className="button" type="submit" disabled={isSaving}>
          {isSaving ? "Logging in..." : "Login"}
        </button>

        <p className="form-note">
          Need an account? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </section>
  );
}

export default Login;
