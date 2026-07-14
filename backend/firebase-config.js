// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// To get these keys: Go to Firebase Console -> Project Settings -> General -> Web App
const firebaseConfig = {
  apiKey: "AIzaSyAX3wa2ylpJfO-2Nvl2IvbYwwkvn3yblvQ",
  authDomain: "accounting-studio-6a411.firebaseapp.com",
  projectId: "accounting-studio-6a411",
  storageBucket: "accounting-studio-6a411.firebasestorage.app",
  messagingSenderId: "351007360878",
  appId: "1:351007360878:web:5a4eafa273e7bb5954a37f",
  measurementId: "G-J71Y61XCQE"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
