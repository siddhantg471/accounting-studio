import { auth } from '../../backend/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const views = ['login', 'dashboard', 'invoice', 'analyzer', 'ledgers', 'inventory', 'daybook', 'reports', 'costcentres', 'godowns'];
const protectedRoutes = ['dashboard', 'invoice', 'analyzer', 'ledgers', 'inventory', 'daybook', 'reports', 'costcentres', 'godowns'];
let currentUser = null;

function showView(viewId) {
    views.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        if (el) {
            el.style.display = id === viewId ? 'block' : 'none';
        }
    });
}

function handleRoute() {
    let hash = window.location.hash.substring(1) || 'login';
    
    // Auth guard
    if (protectedRoutes.includes(hash) && !currentUser) {
        window.location.hash = '#login';
        return;
    }
    
    if (hash === 'login' && currentUser) {
        window.location.hash = '#dashboard';
        return;
    }

    if (!views.includes(hash)) {
        hash = 'login';
    }

    showView(hash);
}

window.addEventListener('hashchange', handleRoute);

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    if (user) {
        // Update user displays
        const emailDisplays = document.querySelectorAll('.user-email-display');
        const userName = user.displayName || user.email.split('@')[0];
        emailDisplays.forEach(el => el.textContent = userName);
        
        const fullEmailDisplay = document.getElementById('profile-email-full');
        if (fullEmailDisplay) fullEmailDisplay.textContent = user.email;

        const avatarInitial = document.getElementById('profile-avatar-initial');
        const navAvatarInitial = document.getElementById('nav-avatar-initial');
        
        if (user.photoURL) {
            const imgHtml = `<img src="${user.photoURL}" alt="${userName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            if (avatarInitial) avatarInitial.innerHTML = imgHtml;
            if (navAvatarInitial) navAvatarInitial.innerHTML = imgHtml;
        } else {
            const initial = userName.charAt(0).toUpperCase();
            if (avatarInitial) avatarInitial.textContent = initial;
            if (navAvatarInitial) navAvatarInitial.textContent = initial;
        }

        const profileCreated = document.getElementById('profile-created');
        if (profileCreated && user.metadata.creationTime) {
            const date = new Date(user.metadata.creationTime);
            profileCreated.textContent = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        
        const dashboardTitle = document.getElementById('dashboard-title');
        if (dashboardTitle) {
            if (user.metadata.creationTime === user.metadata.lastSignInTime) {
                dashboardTitle.innerHTML = `Welcome, <span>${userName}.</span>`;
            } else {
                dashboardTitle.innerHTML = `Welcome back, <span>${userName}.</span>`;
            }
        }
    }
    
    // Re-evaluate route once auth is known
    handleRoute();
});

// Setup global logout listeners and click away handlers
document.addEventListener('click', (e) => {
    // Handle dropdown closing
    const profileMenu = document.querySelector('.user-profile-menu');
    const dropdown = document.getElementById('profile-dropdown');
    if (profileMenu && dropdown && !profileMenu.contains(e.target)) {
        dropdown.classList.remove('show');
    }

    if (e.target.matches('.logout-btn')) {
        signOut(auth).then(() => {
            window.location.hash = '#login';
        }).catch((error) => {
            console.error('Sign Out Error', error);
        });
    }
});
