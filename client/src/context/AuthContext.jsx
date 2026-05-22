import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, loginUser, signupUser } from "../api/authApi.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("helpdeskToken"));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const data = await getCurrentUser(token);
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem("helpdeskToken");
        setToken(null);
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    loadUser();
  }, [token]);

  async function signup(formData) {
    const data = await signupUser(formData);

    localStorage.setItem("helpdeskToken", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function login(credentials) {
    const data = await loginUser(credentials);

    localStorage.setItem("helpdeskToken", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("helpdeskToken");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isCheckingAuth, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
