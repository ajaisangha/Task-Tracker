import React, { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import Admin from "./Admin";
import "./App.css";

/* ================= CONSTANTS ================= */
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

/* ================= APP ================= */
export default function App() {
  const [page, setPage] = useState("main"); // main | admin
  const [employeeId, setEmployeeId] = useState("");
  const [inputError, setInputError] = useState("");

  const isEmployeeIdValid = (v) =>
    /^[a-z]+(?:\.[a-z]+)(?:\d+)?$/.test(v);

  /* ===== HANDLE TASK ===== */
  const handleTaskChange = async (task, department) => {
    if (!employeeId || inputError) return;

    const now = new Date().toISOString();

    if (task === "Shift End") {
      await deleteDoc(doc(db, "activeTasks", employeeId));
      setEmployeeId("");
      return;
    }

    await setDoc(doc(db, "activeTasks", employeeId), {
      employeeId,
      task,
      department,
      startTime: now,
      endTime: null,
    });

    // 🔴 RESET PAGE FOR NEXT EMPLOYEE (IMPORTANT)
    setEmployeeId("");
  };

  /* ================= RENDER ================= */
  if (page === "admin") {
    return <Admin onLogout={() => setPage("main")} />;
  }

  return (
    <div id="root">
      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <button onClick={() => setPage("admin")}>Admin</button>
      </div>

      <div className={!employeeId ? "center-screen" : "top-screen"}>
        <h1>Task Tracker</h1>

        <input
          placeholder="Scan Employee ID"
          value={employeeId}
          autoFocus
          onChange={(e) => {
            const v = e.target.value.toLowerCase().trim();
            if (!v) {
              setEmployeeId("");
              setInputError("");
              return;
            }
            if (!isEmployeeIdValid(v)) {
              setInputError("Invalid format (firstname.lastname or +number)");
              setEmployeeId(v);
              return;
            }
            setInputError("");
            setEmployeeId(v);
          }}
        />

        {inputError && <div className="input-error">{inputError}</div>}
      </div>

      {/* TASK BUTTONS */}
      {employeeId && !inputError && (
        <div className="task-grid">
          {DEPARTMENT_ORDER.map((dep) => (
            <div key={dep} className="task-group">
              <h3>{dep}</h3>
              <div className="task-buttons">
                {DEPARTMENTS[dep].map((task) => (
                  <button
                    key={task}
                    onClick={() => handleTaskChange(task, dep)}
                  >
                    {task}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
