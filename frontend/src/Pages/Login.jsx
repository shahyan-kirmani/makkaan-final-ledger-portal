import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { setAuth } from "../auth";

// ✅ Vite image imports
import logo from "../assets/images/developmentlogo.png";
import sideImage from "../assets/images/Avenue18.jpg";

export default function Login({ setSession }) {
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || data.error || "Login failed");
        return;
      }

      if (!data.token || !data.user) {
        alert("Login response missing token/user");
        return;
      }

      // ✅ Save real token+user
      setAuth(data.token, data.user);
      setSession({ token: data.token, user: data.user });

      // ✅ Redirect by role
      if (data.user.role === "ACQUISITION") navigate("/admin");
      else navigate("/client");
    } catch (err) {
      alert("Backend not reachable. Is it running on port 5050?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className="login-card-grid">
        {/* LEFT */}
        <div style={styles.left} className="login-left">
          <img src={logo} alt="Makkaan Developments" style={styles.logo} />

          <h1 style={styles.title} className="login-title">
            Login
          </h1>
          <br></br>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
            />

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <div style={styles.footer}>
              © {new Date().getFullYear()} Makkaan Developments
            </div>
          </form>
        </div>

        {/* RIGHT */}
        <div style={styles.right} className="login-right">
          <div style={styles.rightOverlay} />
        </div>
      </div>

      {/* ✅ Mobile responsiveness */}
      <style>{`
        @media (max-width: 900px){
          .login-card-grid{
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .login-right{
            order: -1;
            min-height: 260px !important;
            border-radius: 22px 22px 0 0 !important;
          }
          .login-left{
            padding: 26px 20px 28px !important;
          }
          .login-title{
            font-size: 28px !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    background:
      "radial-gradient(1200px 600px at 20% 10%, #eef3ff 0%, #f5f7ff 35%, #eef2ff 100%)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },

  card: {
    width: "min(1100px, 100%)",
    minHeight: "620px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "#ffffff",
    borderRadius: "22px",
    overflow: "hidden",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
  },

  left: {
    padding: "48px 46px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  logo: {
    width: "180px",
    height: "auto",
    marginBottom: "10px",
  },

  title: {
    margin: "0",
    fontSize: "34px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },

  subtitle: {
    margin: "5px 0 22px",
    color: "#64748b",
    fontSize: "14.5px",
  },

  form: {
    maxWidth: "440px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    color: "#334155",
    margin: "0 0 5px",
    fontWeight: "600",
  },

  input: {
    width: "100%",
    padding: "14px 14px",
    marginBottom: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
  },

  button: {
    width: "100%",
    padding: "14px 16px",
    border: "none",
    borderRadius: "12px",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "15px",
    cursor: "pointer",
    marginTop: "6px",
    opacity: 1,
  },

  createRow: {
    marginTop: "14px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  createText: {
    color: "#64748b",
    fontSize: "13px",
  },

  createLink: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: "13px",
    textDecoration: "none",
  },

  footer: {
    marginTop: "18px",
    color: "#94a3b8",
    fontSize: "12px",
  },

  right: {
    position: "relative",
    backgroundImage: `url(${sideImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    borderRadius: "0 22px 22px 0",
  },
};
