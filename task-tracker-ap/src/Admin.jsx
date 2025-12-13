import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import "./App.css";

export default function Admin({ onLogout }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoggedIn(true);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("User not found");
      } else if (err.code === "auth/wrong-password") {
        setError("Wrong password");
      } else {
        setError(err.message);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    onLogout();
  };

  if (!loggedIn) {
    return (
      <div className="dialog-overlay">
        <div className="dialog-box">
          <h3>Admin Login</h3>

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div className="input-error">{error}</div>}

          <div className="dialog-buttons">
            <button onClick={login}>Login</button>
            <button className="cancel-clear" onClick={onLogout}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="root">
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <button className="exit-admin" onClick={logout}>
          Logout
        </button>
      </div>

      <h1>Admin Dashboard</h1>

      {/* NEXT STEP: live view, history, filters */}
      <p>Admin features go here (live view, history, filters).</p>
    </div>
  );
}
