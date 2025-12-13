// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4GAhQM-7HwpGLt3XsqWfN7j4uzwF9DnQ",
  authDomain: "task-tracker-2a227.firebaseapp.com",
  projectId: "task-tracker-2a227",
  storageBucket: "task-tracker-2a227.firebasestorage.app",
  messagingSenderId: "528802922878",
  appId: "1:528802922878:web:7c6b9c1db046859b9f732f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);