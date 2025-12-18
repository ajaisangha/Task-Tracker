import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "./admin.css";

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

export default function Admin({ onExit }) {
  /* AUTH */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  /* VIEW */
  const [view, setView] = useState("live");

  /* LIVE DATA */
  const [activeTasks, setActiveTasks] = useState([]);
  const [tick, setTick] = useState(0);

  /* FILTERS */
  const [fEmp, setFEmp] = useState("");
  const [fDept, setFDept] = useState("");
  const [fTask, setFTask] = useState("");
  const [fDate, setFDate] = useState("");
  const [fMin, setFMin] = useState("");

  /* SELECTION */
  const [selected, setSelected] = useState([]);

  /* BULK */
  const [bulkDept, setBulkDept] = useState("");
  const [bulkTask, setBulkTask] = useState("");

  /* LOGIN */
  const login = async () => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoggedIn(true);
      setView("live");
    } catch (e) {
      if (e.code === "auth/user-not-found") setError("User not found");
      else if (e.code === "auth/wrong-password") setError("Wrong password");
      else setError("Login failed");
    }
  };

  const logout = async () => {
    await signOut(auth);
    onExit(); // 🔴 ALWAYS GO BACK TO MAIN PAGE
  };

  /* LIVE SUBSCRIBE */
  useEffect(() => {
    if (!loggedIn) return;
    return onSnapshot(collection(db, "activeTasks"), (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push(d.data()));
      setActiveTasks(rows);
    });
  }, [loggedIn]);

  /* TIMER */
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  /* HELPERS */
  const durationSecs = (r) =>
    Math.floor((Date.now() - new Date(r.startTime)) / 1000);

  const fmt = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
      Math.floor((s % 3600) / 60)
    ).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const parseTerms = (t) =>
    t.toLowerCase().split(/[\s,]+/).filter(Boolean);

  const filtered = activeTasks.filter((r) => {
    if (fEmp) {
      const terms = parseTerms(fEmp);
      if (!terms.some((t) => r.employeeId.toLowerCase().includes(t))) return false;
    }
    if (fDept && r.department !== fDept) return false;
    if (fTask && r.task !== fTask) return false;
    if (fDate && r.startTime.slice(0, 10) !== fDate) return false;
    if (fMin && durationSecs(r) / 60 < Number(fMin)) return false;
    return true;
  });

  const allSelected =
    filtered.length > 0 && selected.length === filtered.length;

  /* BULK UPDATE */
  const bulkUpdate = async () => {
    if (!selected.length || !bulkDept || !bulkTask) return;

    const now = new Date().toISOString();

    for (const emp of selected) {
      const old = activeTasks.find((r) => r.employeeId === emp);
      if (old) {
        await addDoc(collection(db, "taskLogs"), {
          ...old,
          endTime: now,
        });
      }
      await setDoc(doc(db, "activeTasks", emp), {
        employeeId: emp,
        task: bulkTask,
        department: bulkDept,
        startTime: now,
        endTime: null,
      });
    }

    setSelected([]);
    setBulkDept("");
    setBulkTask("");
  };

  /* CSV */
  const exportCSV = async () => {
    const snap = await getDocs(query(collection(db, "taskLogs"), orderBy("startTime")));
    const rows = snap.docs.map((d) => d.data());

    let csv = "employee,task,department,date,duration\n";
    rows.forEach((r) => {
      csv += `${r.employeeId},${r.task},${r.department},${r.startTime.slice(
        0,
        10
      )},${fmt((new Date(r.endTime) - new Date(r.startTime)) / 1000)}\n`;
    });

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "current-tasks.csv";
    a.click();
  };

  /* LOGIN UI */
  if (!loggedIn) {
    return (
      <div className="admin-overlay">
        <div className="admin-dialog">
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

          {error && <div className="admin-error">{error}</div>}

          <div className="admin-dialog-buttons">
            <button onClick={login}>Login</button>
            <button className="secondary" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ADMIN PAGE */
  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div />
        <h2 className="admin-title">Task Tracker</h2>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>

      <div className="admin-toggle">
        <button className={view === "live" ? "active" : ""} onClick={() => setView("live")}>
          Live View
        </button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
          History View
        </button>
      </div>

      {view === "live" && (
        <>
          <div className="history-controls">
            <div className="filter-text">Filters</div>
            <input placeholder="Employee(s)" value={fEmp} onChange={(e) => setFEmp(e.target.value)} />
            <select value={fDept} onChange={(e) => setFDept(e.target.value)}>
              <option value="">All Depts</option>
              {DEPARTMENT_ORDER.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={fTask} onChange={(e) => setFTask(e.target.value)} disabled={!fDept}>
              <option value="">All Tasks</option>
              {fDept && DEPARTMENTS[fDept].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            <input type="number" placeholder="Min" value={fMin} onChange={(e) => setFMin(e.target.value)} />
          </div>

          {selected.length > 0 && (
            <div className="admin-actions">
              <select value={bulkDept} onChange={(e) => setBulkDept(e.target.value)}>
                <option value="">Dept</option>
                {DEPARTMENT_ORDER.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select value={bulkTask} onChange={(e) => setBulkTask(e.target.value)} disabled={!bulkDept}>
                <option value="">Task</option>
                {bulkDept && DEPARTMENTS[bulkDept].map((t) => <option key={t}>{t}</option>)}
              </select>
              <button onClick={bulkUpdate}>Update Selected</button>
              <button onClick={exportCSV}>Download CSV</button>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(e.target.checked ? filtered.map((r) => r.employeeId) : [])
                    }
                  />
                </th>
                <th>Employee</th>
                <th>Task</th>
                <th>Dept</th>
                <th>Start</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.employeeId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.employeeId)}
                      onChange={() =>
                        setSelected((p) =>
                          p.includes(r.employeeId)
                            ? p.filter((x) => x !== r.employeeId)
                            : [...p, r.employeeId]
                        )
                      }
                    />
                  </td>
                  <td>{r.employeeId}</td>
                  <td>{r.task}</td>
                  <td>{r.department}</td>
                  <td>{new Date(r.startTime).toLocaleString()}</td>
                  <td>{fmt(durationSecs(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
