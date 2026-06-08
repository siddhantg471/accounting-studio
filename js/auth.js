import { auth, googleProvider } from '../../backend/firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// DOM Elements
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordGroup = document.getElementById('password-group');
const submitBtn = document.getElementById('submit-btn');
const googleBtn = document.getElementById('google-btn');
const toggleModeLink = document.getElementById('toggle-mode-link');
const forgotLink = document.getElementById('forgot-link');
const forgotContainer = document.getElementById('forgot-container');
const errorMsg = document.getElementById('error-message');
const successMsg = document.getElementById('success-message');
const modeFooter = document.getElementById('mode-footer');
const googleDivider = document.getElementById('google-divider');

// State: 'login', 'signup', 'forgot'
let currentMode = 'login';

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Redirect to main app if logged in
        window.location.href = 'index.html#dashboard';
    }
});

// Check URL params for mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'signup') {
    setMode('signup');
} else {
    // initialize default state
    setMode('login');
}

function setMode(mode) {
    currentMode = mode;
    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');
    
    passwordInput.required = true;

    if (mode === 'login') {
        authTitle.textContent = 'Welcome Back';
        authSubtitle.textContent = 'Sign in to continue to Accounting Studio';
        submitBtn.textContent = 'Sign In';
        passwordGroup.style.display = 'block';
        forgotContainer.style.display = 'block';
        googleBtn.style.display = 'flex';
        googleDivider.style.display = 'flex';
        modeFooter.style.display = 'block';
        modeFooter.innerHTML = `Don't have an account? <a href="#" id="toggle-mode-link">Sign Up</a>`;
        document.getElementById('toggle-mode-link').addEventListener('click', (e) => { e.preventDefault(); setMode('signup'); });
    } else if (mode === 'signup') {
        authTitle.textContent = 'Create Account';
        authSubtitle.textContent = 'Start generating professional invoices';
        submitBtn.textContent = 'Sign Up';
        passwordGroup.style.display = 'block';
        forgotContainer.style.display = 'none';
        googleBtn.style.display = 'flex';
        googleDivider.style.display = 'flex';
        modeFooter.style.display = 'block';
        modeFooter.innerHTML = `Already have an account? <a href="#" id="toggle-mode-link">Sign In</a>`;
        document.getElementById('toggle-mode-link').addEventListener('click', (e) => { e.preventDefault(); setMode('login'); });
    } else if (mode === 'forgot') {
        authTitle.textContent = 'Reset Password';
        authSubtitle.textContent = 'Enter your email to receive a reset link';
        submitBtn.textContent = 'Send Reset Link';
        passwordGroup.style.display = 'none';
        passwordInput.required = false;
        forgotContainer.style.display = 'none';
        googleBtn.style.display = 'none';
        googleDivider.style.display = 'none';
        modeFooter.style.display = 'block';
        modeFooter.innerHTML = `Remember your password? <a href="#" id="toggle-mode-link">Sign In</a>`;
        document.getElementById('toggle-mode-link').addEventListener('click', (e) => { e.preventDefault(); setMode('login'); });
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    successMsg.classList.add('hidden');
}

function showSuccess(message) {
    successMsg.textContent = message;
    successMsg.classList.remove('hidden');
    errorMsg.classList.add('hidden');
}

// Event Listeners
forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    setMode('forgot');
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';

    try {
        if (currentMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle redirect
        } else if (currentMode === 'signup') {
            await createUserWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle redirect
        } else if (currentMode === 'forgot') {
            await sendPasswordResetEmail(auth, email);
            showSuccess('Password reset link sent! Check your email.');
            setMode('login');
        }
    } catch (error) {
        let msg = 'Authentication failed. Please try again.';
        if (error.code === 'auth/user-not-found') msg = 'No user found with this email.';
        else if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
        else if (error.code === 'auth/email-already-in-use') msg = 'Email is already in use.';
        else if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
        else msg = error.message; // Fallback
        
        showError(msg);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === 'login' ? 'Sign In' : (currentMode === 'signup' ? 'Sign Up' : 'Send Reset Link');
    }
});

googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    try {
        await signInWithPopup(auth, googleProvider);
        // onAuthStateChanged will handle redirect
    } catch (error) {
        showError('Google sign in failed. ' + error.message);
        googleBtn.disabled = false;
    }
});
