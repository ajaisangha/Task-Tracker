import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  getDoc,
  collection,
} from "firebase/firestore";

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

  // --------------------- Persistent Admin Login ---------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setPage("admin"); // automatically show admin page if logged in
      }
    });
    return () => unsubscribe();
  }, []);

  const isEmployeeIdValid = (v) =>
    /^[a-z]+(?:\.[a-z]+)(?:\d+)?$/.test(v);

  /* ===== HANDLE TASK ===== */
  const handleTaskChange = async (task, department) => {
    if (!employeeId || inputError) return;

    const now = new Date().toISOString();
    const activeRef = doc(db, "activeTasks", employeeId);

    try {
      const snap = await getDoc(activeRef);

      // 🔴 SHIFT END
      if (task === "Shift End") {
        // log shift end (timestamp only) in taskLogs
        await addDoc(collection(db, "taskLogs"), {
          employeeId,
          department: "Others",
          task: "Shift End",
          startTime: now,
          endTime: now,
        });

        // delete active task for this employee
        if (snap.exists()) {
          await deleteDoc(activeRef);
        }

        setEmployeeId(""); // clear input
        return;
      }

      // 🔵 NORMAL TASK CHANGE
      if (snap.exists()) {
        await addDoc(collection(db, "taskLogs"), {
          ...snap.data(),
          endTime: now,
        });
      }

      await setDoc(activeRef, {
        employeeId,
        task,
        department,
        startTime: now,
        endTime: null,
      });

      setEmployeeId("");
    } catch (err) {
      console.error("Task change failed:", err);
    }
  };

  /* ================= RENDER ================= */
  if (page === "admin") {
    return <Admin onExit={() => setPage("main")} />;
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
