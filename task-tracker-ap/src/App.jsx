import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

const ADMIN_IDS = ["ajaypal.sangha", "abin.thomas"];

// Task groups in desired order
const DEPARTMENT_ORDER = [
  "Others",
  "Tote Wash",
  "Pick",
  "Bagging",
  "Decant",
  "Freezer",
  "Dispatch"
];

const DEPARTMENTS = {
  Others: ["Shift start", "Shift end", "washroom", "break", "move to another department"],
  "Tote Wash": ["tote wash", "tote wash cleanup", "move pallets"],
  Pick: ["Ambient picking", "ambient pick cleanup", "chill picking", "chill pick cleanup"],
  Bagging: ["bagging", "bagging runner", "bagging cleanup"],
  Decant: [
    "MHE",
    "ambient decant",
    "ambient decant cleanup",
    "Pallet cleanup",
    "Baler task",
    "chill decant",
    "chill decant cleanup"
  ],
  Freezer: ["freezer decant", "freezer putaway", "freezer pick", "freezer cleanup", "unload and icing trolly"],
  Dispatch: [
    "frameload",
    "MHE",
    "dekit",
    "van loading",
    "dispatch cleanup",
    "van dekit",
    "trailer dekit",
    "trailer loading"
  ]
};

function App() {
  const [employeeId, setEmployeeId] = useState("");
  const [currentTasks, setCurrentTasks] = useState({});
  const [taskLogs, setTaskLogs] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [timer, setTimer] = useState(0); // for live duration updates

  // Detect admin dynamically
  useEffect(() => {
    if (employeeId.trim() === "") return;
    setIsAdmin(ADMIN_IDS.includes(employeeId));
  }, [employeeId]);

  // Live timer to update ongoing task durations
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000); // update every second
    return () => clearInterval(interval);
  }, []);

  const handleTaskChange = async (task, department) => {
    const now = new Date();

    // Log previous task if exists
    if (currentTasks[employeeId]) {
      const oldTask = currentTasks[employeeId];
      const log = {
        employeeId,
        task: oldTask.task,
        department: oldTask.department,
        startTime: oldTask.startTime,
        endTime: now.toISOString()
      };
      setTaskLogs(prev => [...prev, log]);
      await addDoc(collection(db, "taskLogs"), log);
    }

    // Log new task
    const newTaskEntry = {
      employeeId,
      task,
      department,
      startTime: now.toISOString(),
      endTime: null
    };
    setCurrentTasks(prev => ({
      ...prev,
      [employeeId]: newTaskEntry
    }));
    await addDoc(collection(db, "taskLogs"), newTaskEntry);

    // Reset screen for next scan
    setEmployeeId("");
    setIsAdmin(false);
    setShowLive(false);
  };

  // Calculate duration string
  const getDuration = (task) => {
    const start = new Date(task.startTime);
    const end = task.endTime ? new Date(task.endTime) : new Date(); // ongoing task: use current time
    const diffMs = end - start;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  };

  // CSV Export
  const exportCSV = (data) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => {
      const rowCopy = { ...row };
      // calculate duration for CSV
      const start = new Date(row.startTime);
      const end = row.endTime ? new Date(row.endTime) : new Date();
      const diffMs = end - start;
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      rowCopy.duration = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
      return Object.values(rowCopy).map(val => `"${val}"`).join(",");
    });

    const csvContent = [headers + ",duration", ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "task-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Task Tracker App</h1>

      {/* Employee ID scan input */}
      <div>
        <input
          placeholder="Scan Employee ID"
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value.toLowerCase())}
          autoFocus
        />
      </div>

      {/* Admin UI */}
      {isAdmin && employeeId && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={() => setShowLive(!showLive)}>
            {showLive ? "Hide Live View" : "View Live"}
          </button>
          <button onClick={() => exportCSV([...taskLogs, ...Object.values(currentTasks)])} style={{ marginLeft: "10px" }}>
            Download CSV
          </button>
        </div>
      )}

      {/* Live view table */}
      {showLive && (
        <div style={{ marginTop: "20px", maxHeight: "400px", overflowY: "auto" }}>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Task</th>
                <th>Department</th>
                <th>Start Time</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(currentTasks).map((task, index) => (
                <tr key={index}>
                  <td>{task.employeeId}</td>
                  <td>{task.task}</td>
                  <td>{task.department}</td>
                  <td>{new Date(task.startTime).toLocaleString()}</td>
                  <td>{getDuration(task)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Task Selection */}
      {!isAdmin && employeeId && (
        <div style={{ marginTop: "20px" }}>
          {DEPARTMENT_ORDER.map(dep => (
            <div key={dep} style={{ marginBottom: "10px" }}>
              <h3>{dep}</h3>
              {DEPARTMENTS[dep].map(task => (
                <button
                  key={task}
                  onClick={() => handleTaskChange(task, dep)}
                  style={{ margin: "5px" }}
                >
                  {task}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
