import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

export default function Admin({ user, onLogout }) {
  const logout = async () => {
    await signOut(auth);
    onLogout();
  };

  return (
    <div id="root">
      {/* TOP RIGHT LOGOUT */}
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <button onClick={logout}>Logout</button>
      </div>

      <h1>ADMIN PANEL</h1>
      <p>Logged in as: {user.email}</p>

      {/* ADMIN FEATURES WILL BE ADDED NEXT */}
    </div>
  );
}
