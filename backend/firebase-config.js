// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// To get these keys: Go to Firebase Console -> Project Settings -> General -> Web App
const firebaseConfig = {
  apiKey: "AIzaSyDPPj8h5gUX26u1i0if5kJRrz9SviKlAgE",
  authDomain: "harshit-engineering-work-efd27.firebaseapp.com",
  projectId: "harshit-engineering-work-efd27",
  storageBucket: "harshit-engineering-work-efd27.firebasestorage.app",
  messagingSenderId: "1250561178",
  appId: "1:1250561178:web:e4afa1c0321ac030432323",
  measurementId: "G-B1SEWFNG23"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
