// Firebase setup for CRT/RRT Board Prep
// These values are safe to be public in frontend code (unlike the Stripe
// secret key) — Firebase security is enforced through Firestore security
// rules and Authentication, not by hiding this config.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDidpvRcC3hnMx_SH9gZldQRp3Y1iPZlFY",
  authDomain: "crt-rrt-board-exam-review.firebaseapp.com",
  projectId: "crt-rrt-board-exam-review",
  storageBucket: "crt-rrt-board-exam-review.firebasestorage.app",
  messagingSenderId: "1017003121016",
  appId: "1:1017003121016:web:ff30e4eaef1d96f557508d",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
