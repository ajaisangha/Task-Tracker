import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Admin from "./Admin";
import "./App.css";

/* ===============================
   TASK CONSTANTS (UNCHANGED)
=============================== */
const DEPARTMENT_ORDER = [
  "Others",
  "Tote Wash",
  "Pick",
  "Bagging",
  "Decant",
  "Freezer",
  "Dispatch",
  "IC",
];

const DEPARTMENTS = {
  Others: ["Shift End", "Washroom", "Break", "Move To Another Department"],
  "Tote Wash": ["Tote Wash", "Tote Wash Cleanup", "Move Pallets"],
  Pick: [
    "Ambient Picking",
    "Ambient Pick Cleanup",
    "Chill Picking",
    "Chill Pick Cleanup",
  ],
  Bagging: ["Bagging", "Bagging Runner", "Bagging Cleanup"],
  Decant: [
    "MHE",
    "Ambient Decant",
    "Ambient Decant Cleanup",
    "Pallet Cleanup",
    "Baler Task",
    "Chill Decant",
    "Chill Decant Cleanup",
  ],
  Freezer: [
    "Freezer Decant",
    "Freezer Putaway",
    "Freezer Pick",
    "Freezer Cleanup",
    "Unload And Icing Trolly",
  ],
  Dispatch: [
    "Frameload",
    "MHE",
    "Dekit",
    "Van Loading",
    "Dispatch Cleanup",
    "Van Dekit",
    "Trailer Dekit",
    "Trailer Loading",
    "Consolidation",
  ],
  IC: [
    "IMS",
    "Inbound Office",
    "Investigating non-cons",
    "Investigating SKUs",
    "Tracking POs",
    "Purge tasks",
  ],
};

/* ===============================
   MAIN APP
=============================== */
export default function App() {
  const [employeeId, setEmployeeId] = useState("");
  const [inputError, setInputError] = useState("");

  /* ===== ADMIN UI STATE ===== */
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminUser, setAdminUser] = useState(null);

  /* ===== EMPLOYEE ID VALIDATION ===== */
  const isValidEmployeeId = (v) =>
    /^[a-z]+(?:\.[a-z]+)(?:\d{0,2})?$/.test(v);

  /* ===== ADMIN LOGIN ===== */
  const handleAdminLogin = async () => {
    setAdminError("");
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        adminEmail,
        adminPassword
      );
      setAdminUser(cred.user);
      setShowAdminLogin(false);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setAdminError("Admin user not found.");
      } else if (err.code === "auth/wrong-password") {
        setAdminError("Incorrect password.");
      } else {
        setAdminError("Login failed.");
      }
    }
  };

  /* ===============================
     ADMIN PAGE
  =============================== */
  if (adminUser) {
    return <Admin user={adminUser} onLogout={() => setAdminUser(null)} />;
  }

  /* ===============================
     EMPLOYEE PAGE
  =============================== */
  return (
    <div id="root">
      {/* TOP RIGHT ADMIN BUTTON */}
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <button onClick={() => setShowAdminLogin(true)}>Admin</button>
      </div>

      <h1>Task Tracker</h1>

      {/* EMPLOYEE INPUT */}
      <input
        placeholder="Scan Employee ID"
        value={employeeId}
        onChange={(e) => {
          const v = e.target.value.toLowerCase().trim();
          if (!v) {
            setEmployeeId("");
            setInputError("");
            return;
          }

          if (!isValidEmployeeId(v)) {
            setInputError(
              "Invalid format (firstname.lastname or firstname.lastname12)"
            );
            setEmployeeId(v);
            return;
          }

          setInputError("");
          setEmployeeId(v);
        }}
        autoFocus
      />

      {inputError && <div className="input-error">{inputError}</div>}

      {/* TASK BUTTONS — UNCHANGED */}
      {employeeId && !inputError && (
        <div className="task-grid">
          {DEPARTMENT_ORDER.map((dep) => (
            <div key={dep} className="task-group">
              <h3>{dep}</h3>
              <div className="task-buttons">
                {DEPARTMENTS[dep].map((task) => (
                  <button key={task}>{task}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADMIN LOGIN DIALOG */}
      {showAdminLogin && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>Admin Login</h3>

            <input
              type="email"
              placeholder="Email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />

            {adminError && (
              <div className="input-error">{adminError}</div>
            )}

            <div className="dialog-buttons">
              <button onClick={handleAdminLogin}>Login</button>
              <button
                className="cancel-clear"
                onClick={() => {
                  setShowAdminLogin(false);
                  setAdminError("");
                  setAdminEmail("");
                  setAdminPassword("");
                }}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
