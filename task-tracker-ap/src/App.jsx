import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import "./App.css";

const ADMIN_IDS = ["ajaypal.sangha", "abin.thomas", "camilo.torres"];

const DEPARTMENT_ORDER = [
  "Others",
  "Tote Wash",
  "Pick",
  "Bagging",
  "Decant",
  "Freezer",
  "Dispatch",
];

const DEPARTMENTS = {
  Others: ["Shift End", "Washroom", "Break", "Move To Another Department"],
  "Tote Wash": ["Tote Wash", "Tote Wash Cleanup", "Move Pallets"],
  Pick: ["Ambient Picking", "Ambient Pick Cleanup", "Chill Picking", "Chill Pick Cleanup"],
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
  ],
};

function App() {
  const [employeeId, setEmployeeId] = useState("");
  const [currentTasks, setCurrentTasks] = useState({});
  const [taskLogs, setTaskLogs] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [tick, setTick] = useState(0);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [inputError, setInputError] = useState("");

  const isCentered = !employeeId && !isAdmin;

  /* ------------------------------------
     FIRESTORE WRITE
  ------------------------------------ */
  const saveTaskToFirestore = async (task) => {
    try {
      await addDoc(collection(db, "taskLogs"), task);
      console.log("Saved to Firestore:", task);
    } catch (error) {
      console.error("🔥 Firestore Save Error:", error);
    }
  };

  /* ------------------------------------
     FIRESTORE CLEAR
  ------------------------------------ */
  const clearFirestoreData = async () => {
    try {
      const snap = await getDocs(collection(db, "taskLogs"));
      const deletions = snap.docs.map((d) =>
        deleteDoc(doc(db, "taskLogs", d.id))
      );
      await Promise.all(deletions);
      console.log("🔥 All Firestore logs cleared");
    } catch (err) {
      console.error("🔥 Error clearing Firestore:", err);
    }
  };

  /* ------------------------------------
     TICK FOR LIVE DURATIONS
  ------------------------------------ */
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ------------------------------------
     ADMIN DETECT
  ------------------------------------ */
  useEffect(() => {
    if (employeeId.trim() === "") return;
    setIsAdmin(ADMIN_IDS.includes(employeeId.trim()));
  }, [employeeId]);

  /* ------------------------------------
     EXIT ADMIN
  ------------------------------------ */
  const exitAdminMode = () => {
    setIsAdmin(false);
    setEmployeeId("");
    setShowLive(false);
  };

  /* ------------------------------------
     HANDLE TASK CHANGE + SHIFT END FIX
  ------------------------------------ */
  const handleTaskChange = async (task, department) => {
    const now = new Date();

    // Close previous task if active
    if (currentTasks[employeeId]) {
      const old = currentTasks[employeeId];

      const completed = {
        employeeId,
        task: old.task,
        department: old.department,
        startTime: old.startTime,
        endTime: now.toISOString(),
      };

      setTaskLogs((prev) => [...prev, completed]);
      saveTaskToFirestore(completed);
    }

    /* -------------------------------------------------------
       SHIFT END LOGIC:
       ✔ Store final "Shift End" entry with 0 duration
       ✔ Remove from currentTasks (no live counting)
       ✔ STOP creating new running tasks
    ------------------------------------------------------- */
    if (task.toLowerCase().includes("shift end")) {
      const finalTask = {
        employeeId,
        task: "Shift End",
        department,
        startTime: now.toISOString(),
        endTime: now.toISOString(), // duration = 0
      };

      setTaskLogs((prev) => [...prev, finalTask]);
      saveTaskToFirestore(finalTask);

      // REMOVE from currentTasks so Live View stops showing it
      setCurrentTasks((prev) => {
        const updated = { ...prev };
        delete updated[employeeId];
        return updated;
      });

      setEmployeeId("");
      setIsAdmin(false);
      setShowLive(false);
      return;
    }

    /* -------------------------------------------------------
       NORMAL TASK START
    ------------------------------------------------------- */
    const newTask = {
      employeeId,
      task,
      department,
      startTime: now.toISOString(),
      endTime: null,
    };

    setCurrentTasks((prev) => ({ ...prev, [employeeId]: newTask }));
    saveTaskToFirestore(newTask);

    setEmployeeId("");
    setIsAdmin(false);
    setShowLive(false);
  };

  /* ------------------------------------
     CALCULATE DURATION
  ------------------------------------ */
  const getDuration = (task) => {
    const start = new Date(task.startTime);
    const end = task.endTime ? new Date(task.endTime) : new Date();
    const diff = Math.floor((end - start) / 1000);

    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");

    return `${h}:${m}:${s}`;
  };

  /* ------------------------------------
     CSV EXPORT (NO RUNNING TASKS)
  ------------------------------------ */
  const exportCSV = (rows) => {
    if (rows.length === 0) return;

    // Filter out ongoing tasks (endTime = null)
    const completedOnly = rows.filter((r) => r.endTime !== null);

    const enriched = completedOnly.map((r) => ({
      ...r,
      duration: getDuration(r),
    }));

    const grouped = {};
    enriched.forEach((r) => {
      if (!grouped[r.employeeId]) grouped[r.employeeId] = [];
      grouped[r.employeeId].push(r);
    });

    const employees = Object.keys(grouped).sort();
    let csv = "";

    employees.forEach((emp) => {
      csv += `Employee: ${emp}\n`;

      const sorted = grouped[emp].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );

      const headers = Object.keys(sorted[0]).join(",");
      csv += headers + "\n";

      sorted.forEach((row) => {
        csv += Object.values(row)
          .map((v) => `"${v}"`)
          .join(",") + "\n";
      });

      csv += "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "task-report.csv";
    a.click();
  };

  /* ------------------------------------
     VALIDATE INPUT
  ------------------------------------ */
  const validEmployeeId = (id) => {
    const pattern = /^[a-z]+(?:\.[a-z]+)(?:\d+)?$/;
    return pattern.test(id);
  };

  /* ------------------------------------
     CLEAR DATA DIALOG
  ------------------------------------ */
  const ClearDataDialog = () => (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h3>Clear All Data?</h3>
        <p>This will delete all logs from Database and this device.</p>

        <div className="dialog-buttons">
          <button
            className="confirm-clear"
            onClick={async () => {
              setTaskLogs([]);
              setCurrentTasks({});
              await clearFirestoreData();
              setShowClearDialog(false);
            }}
          >
            Clear
          </button>

          <button
            className="cancel-clear"
            onClick={() => setShowClearDialog(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  /* ------------------------------------
     UI
  ------------------------------------ */
  return (
    <div id="root">

      {showClearDialog && <ClearDataDialog />}

      <div className={isCentered ? "center-screen" : "top-screen"}>
        <h1>Task Tracker</h1>

        {!isAdmin && (
          <>
            <input
              placeholder="Scan Employee ID"
              value={employeeId}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().trim();

                if (value === "") {
                  setEmployeeId("");
                  return;
                }

                if (!validEmployeeId(value)) {
                  setInputError(
                    "Invalid format. Use firstname.lastname or firstname.lastname2"
                  );
                  setEmployeeId(value);
                  return;
                }

                setInputError("");
                setEmployeeId(value);
              }}
              autoFocus
            />

            {inputError && (
              <div className="input-error">{inputError}</div>
            )}
          </>
        )}
      </div>

      {/* ADMIN UI */}
      {isAdmin && (
        <div style={{ textAlign: "center" }}>
          <h2>ADMIN MODE ({employeeId})</h2>

          <div className="admin-buttons">
            <button onClick={() => setShowLive((v) => !v)}>
              {showLive ? "Hide Live View" : "View Live"}
            </button>

            <button
              onClick={() =>
                exportCSV([...taskLogs, ...Object.values(currentTasks)])
              }
            >
              Download CSV
            </button>

            <button
              className="clear-data"
              onClick={() => setShowClearDialog(true)}
            >
              Clear Data
            </button>

            <button className="exit-admin" onClick={exitAdminMode}>
              Exit Admin Mode
            </button>
          </div>
        </div>
      )}

      {/* LIVE VIEW */}
      {isAdmin && showLive && (
        <div className="live-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Task</th>
                <th>Department</th>
                <th>Start Time</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(currentTasks).map((t, i) => (
                <tr key={i}>
                  <td>{t.employeeId}</td>
                  <td>{t.task}</td>
                  <td>{t.department}</td>
                  <td>{new Date(t.startTime).toLocaleString()}</td>
                  <td>{getDuration(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TASK BUTTONS */}
      {!isAdmin && employeeId && (
        <div className="task-grid">
          {DEPARTMENT_ORDER.map((dep) => (
            <div className="task-group" key={dep}>
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

export default App;
