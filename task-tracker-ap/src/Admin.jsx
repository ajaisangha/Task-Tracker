import React, { useEffect, useState, useMemo } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  where,
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

export default function Admin({ onExit }) {
  /* ============ AUTH ============ */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  /* ============ VIEW ============ */
  const [view, setView] = useState("live");

  /* ============ LIVE DATA ============ */
  const [activeTasks, setActiveTasks] = useState([]);
  const [, forceTick] = useState(0);

  /* ============ LIVE FILTERS ============ */
  const [fEmp, setFEmp] = useState("");
  const [fDept, setFDept] = useState("");
  const [fTask, setFTask] = useState("");
  const [fDate, setFDate] = useState("");
  const [fMin, setFMin] = useState("");

  /* ============ SELECTION / BULK ============ */
  const [selected, setSelected] = useState([]);
  const [bulkDept, setBulkDept] = useState("");
  const [bulkTask, setBulkTask] = useState("");

  /* ============ HISTORY RANGE & DATA ============ */
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ============ HISTORY FILTERS ============ */
  const [hEmp, setHEmp] = useState("");
  const [hDept, setHDept] = useState("");
  const [hTask, setHTask] = useState("");

  /* ============ AUTH ============ */
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
    onExit();
  };

  const resetPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset password");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setError("");
    } catch (e) {
      if (e.code === "auth/user-not-found") setError("User not found");
      else setError("Failed to send reset email");
    }
  };

  /* ============ PERSISTENT LOGIN ============ */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoggedIn(true);
        setView("live");
      }
    });
    return unsubscribe;
  }, []);

  /* ============ LIVE SUBSCRIBE ============ */
  useEffect(() => {
    if (!loggedIn) return;

    return onSnapshot(collection(db, "activeTasks"), (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.task !== "Shift End") rows.push(data);
      });
      setActiveTasks(rows);
    });
  }, [loggedIn]);

  /* ============ TIMER ============ */
  useEffect(() => {
    const i = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  /* ============ HELPERS ============ */
  const durationSecs = (r) =>
    Math.max(0, Math.floor((Date.now() - new Date(r.startTime)) / 1000));

  // Always HH:MM:SS
  const fmt = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
      Math.floor((s % 3600) / 60)
    ).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const parseTerms = (t) =>
    t.toLowerCase().split(/[\s,]+/).filter(Boolean);

  const toLocalDateTimeParts = (iso) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { date, time };
  };

  /* ============ AGGREGATION HELPER ============ */
  const aggregateEmployeeLogs = (logs) => {
    const groups = {};

    logs.forEach((r) => {
      const key = `${r.task}|${r.department || ""}`;

      if (!groups[key]) {
        groups[key] = {
          task: r.task,
          department: r.department || "",
          startTime: r.startTime,
          endTime: r.endTime || null,
          totalSeconds: 0,
          lastShiftEndStart: null,
        };
      }

      const g = groups[key];

      if (r.task === "Shift End") {
        g.lastShiftEndStart =
          !g.lastShiftEndStart ||
          new Date(r.startTime) > new Date(g.lastShiftEndStart)
            ? r.startTime
            : g.lastShiftEndStart;
        return;
      }

      if (!r.endTime) return;

      const dur = (new Date(r.endTime) - new Date(r.startTime)) / 1000;
      g.totalSeconds += dur;

      if (!g.endTime || new Date(r.endTime) > new Date(g.endTime)) {
        g.endTime = r.endTime;
      }
    });

    const result = [];

    Object.values(groups).forEach((g) => {
      if (g.task === "Shift End") {
        if (g.lastShiftEndStart) {
          result.push({
            task: g.task,
            department: g.department,
            startTime: g.lastShiftEndStart,
            endTime: "",
            durationSeconds: 0,
          });
        }
      } else if (g.totalSeconds > 0) {
        result.push({
          task: g.task,
          department: g.department,
          startTime: g.startTime,
          endTime: g.endTime,
          durationSeconds: g.totalSeconds,
        });
      }
    });

    return result;
  };

  /* ============ LIVE FILTERED ROWS ============ */
  const filtered = activeTasks.filter((r) => {
    if (fEmp) {
      const terms = parseTerms(fEmp);
      if (!terms.some((t) => r.employeeId.toLowerCase().includes(t)))
        return false;
    }
    if (fDept && r.department !== fDept) return false;
    if (fTask && r.task !== fTask) return false;
    if (fDate && r.startTime.slice(0, 10) !== fDate) return false;
    if (fMin && durationSecs(r) / 60 < Number(fMin)) return false;
    return true;
  });

  const allSelected =
    filtered.length > 0 && selected.length === filtered.length;

  /* ============ BULK UPDATE ============ */
  const bulkUpdate = async () => {
    if (!selected.length || !bulkDept || !bulkTask) return;

    const now = new Date().toISOString();

    for (const emp of selected) {
      const old = activeTasks.find((r) => r.employeeId === emp);
      if (!old) continue;

      await addDoc(collection(db, "taskLogs"), {
        ...old,
        endTime: now,
      });

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

  /* ============ HISTORY RANGE LOAD ============ */
  const loadHistory = async () => {
    if (!startDate || !startTime || !endDate || !endTime) {
      alert("Please select full date and time range");
      return;
    }

    setLoadingHistory(true);

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    const q = query(
      collection(db, "taskLogs"),
      where("startTime", ">=", start.toISOString()),
      where("startTime", "<=", end.toISOString()),
      orderBy("startTime")
    );

    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => d.data());
    setHistoryData(rows);
    setLoadingHistory(false);

    setHEmp("");
    setHDept("");
    setHTask("");
  };

  /* ============ HISTORY FILTERED ROWS ============ */
  const historyFiltered = historyData.filter((r) => {
    if (hEmp) {
      const terms = parseTerms(hEmp);
      if (!terms.some((t) => r.employeeId.toLowerCase().includes(t)))
        return false;
    }
    if (hDept && r.department !== hDept) return false;
    if (hTask && r.task !== hTask) return false;
    return true;
  });

  /* ============ HISTORY AGGREGATED VIEW ============ */
  const historyAggregated = useMemo(() => {
    if (!historyFiltered.length) return [];

    const byEmployee = {};
    historyFiltered.forEach((r) => {
      if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = [];
      byEmployee[r.employeeId].push(r);
    });

    const rows = [];

    Object.keys(byEmployee)
      .sort()
      .forEach((emp) => {
        const logs = byEmployee[emp].sort(
          (a, b) => new Date(a.startTime) - new Date(b.startTime)
        );
        const aggregated = aggregateEmployeeLogs(logs);

        aggregated.forEach((row) => {
          rows.push({
            employeeId: emp,
            ...row,
          });
        });
      });

    return rows;
  }, [historyFiltered]);

  /* ============ EXPORT CSV (HISTORY) ============ */
  const exportCSV = () => {
    if (!historyAggregated.length) {
      alert("No data to export");
      return;
    }

    const byEmployee = {};
    historyAggregated.forEach((r) => {
      if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = [];
      byEmployee[r.employeeId].push(r);
    });

    let csv = "";

    Object.keys(byEmployee)
      .sort()
      .forEach((emp, empIndex) => {
        const rows = byEmployee[emp];

        csv += `${emp}\n`;
        csv += "task,department,startDate,startTime,endDate,endTime,duration\n";

        rows.forEach((row) => {
          const { date: sDate, time: sTime } = toLocalDateTimeParts(
            row.startTime
          );
          const { date: eDate, time: eTime } = toLocalDateTimeParts(
            row.endTime
          );

          const duration =
            row.task === "Shift End"
              ? ""
              : fmt(row.durationSeconds || 0);

          csv += `${row.task},${row.department},${sDate},${sTime},${eDate},${eTime},${duration}\n`;
        });

        if (empIndex < Object.keys(byEmployee).length - 1) {
          csv += "\n";
        }
      });

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "task-report.csv";
    a.click();
  };

  /* ============ LOGIN UI ============ */
  if (!loggedIn) {
    return (
      <div className="admin-overlay">
        <div className="admin-dialog">
          <h3 className="admin-dialog-title">Task Tracker Admin</h3>

          <input
            placeholder="Email address"
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
          {resetEmailSent && (
            <div className="admin-success">
              Password reset email sent successfully.
            </div>
          )}

          <div className="admin-dialog-buttons">
            <button onClick={login}>Login</button>
            <button className="secondary" onClick={resetPassword}>
              Reset Password
            </button>
            <button className="secondary" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ ADMIN PAGE ============ */
  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <h2 className="admin-title">Task Tracker</h2>
      </div>

      <button className="logout-btn" onClick={logout}>
        Logout
      </button>

      <div className="admin-toggle">
        <button
          className={view === "live" ? "active" : ""}
          onClick={() => setView("live")}
        >
          Live View
        </button>
        <button
          className={view === "history" ? "active" : ""}
          onClick={() => setView("history")}
        >
          History View
        </button>
      </div>

      {/* ============ LIVE VIEW ============ */}
      {view === "live" && (
        <>
          <div className="history-controls">
            <div className="filter-text">Live Filters</div>

            <div className="filter-inputs">
              <input
                placeholder="Employee(s)"
                value={fEmp}
                onChange={(e) => setFEmp(e.target.value)}
              />
              <select value={fDept} onChange={(e) => setFDept(e.target.value)}>
                <option value="">All Depts</option>
                {DEPARTMENT_ORDER.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <select
                value={fTask}
                onChange={(e) => setFTask(e.target.value)}
                disabled={!fDept}
              >
                <option value="">All Tasks</option>
                {fDept &&
                  DEPARTMENTS[fDept].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
              />
              <input
                type="number"
                placeholder="Min (minutes)"
                value={fMin}
                onChange={(e) => setFMin(e.target.value)}
              />
            </div>
          </div>

          {selected.length > 0 && (
            <div className="admin-actions">
              <select
                value={bulkDept}
                onChange={(e) => setBulkDept(e.target.value)}
              >
                <option value="">Department</option>
                {DEPARTMENT_ORDER.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <select
                value={bulkTask}
                onChange={(e) => setBulkTask(e.target.value)}
                disabled={!bulkDept}
              >
                <option value="">Task</option>
                {bulkDept &&
                  DEPARTMENTS[bulkDept].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
              </select>
              <button onClick={bulkUpdate}>Update Selected</button>
            </div>
          )}

          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col" className="select-all-th">
                  <label className="select-all-wrap">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? filtered.map((r) => r.employeeId)
                            : []
                        )
                      }
                    />
                    <span>Select All</span>
                  </label>
                </th>
                <th scope="col">Employee</th>
                <th scope="col">Task</th>
                <th scope="col">Dept</th>
                <th scope="col">Start</th>
                <th scope="col">Duration</th>
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

      {/* ============ HISTORY VIEW ============ */}
      {view === "history" && (
        <div className="history-view">
          <h3 className="history-title">History Range</h3>

          <div className="date-range-inputs">
            <div className="date-range-column">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <label>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="date-range-column">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <label>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={loadHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? "Loading..." : "View History"}
          </button>

          {historyData.length > 0 && (
            <div className="history-controls">
              <div className="filter-text">History Filters</div>
              <div className="filter-inputs">
                <input
                  placeholder="Employee(s)"
                  value={hEmp}
                  onChange={(e) => setHEmp(e.target.value)}
                />
                <select
                  value={hDept}
                  onChange={(e) => setHDept(e.target.value)}
                >
                  <option value="">All Depts</option>
                  {DEPARTMENT_ORDER.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={hTask}
                  onChange={(e) => setHTask(e.target.value)}
                  disabled={!hDept}
                >
                  <option value="">All Tasks</option>
                  {hDept &&
                    DEPARTMENTS[hDept].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {historyAggregated.length > 0 && (
            <>
              <button className="download-csv-btn" onClick={exportCSV}>
                Download CSV
              </button>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Department</th>
                    <th scope="col">Task</th>
                    <th scope="col">Start Date</th>
                    <th scope="col">Start Time</th>
                    <th scope="col">End Date</th>
                    <th scope="col">End Time</th>
                    <th scope="col">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {historyAggregated.map((r, i) => {
                    const { date: sDate, time: sTime } =
                      toLocalDateTimeParts(r.startTime);
                    const { date: eDate, time: eTime } =
                      toLocalDateTimeParts(r.endTime);

                    const duration =
                      r.task === "Shift End"
                        ? ""
                        : fmt(r.durationSeconds || 0);

                    return (
                      <tr key={i}>
                        <td>{r.employeeId}</td>
                        <td>{r.department}</td>
                        <td>{r.task}</td>
                        <td>{sDate}</td>
                        <td>{sTime}</td>
                        <td>{eDate}</td>
                        <td>{eTime}</td>
                        <td>{duration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {historyData.length > 0 &&
            historyAggregated.length === 0 && (
              <p className="no-records-text">
                No records match the selected filters.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
