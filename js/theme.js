// theme.js
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Dispatch event so charts can update
    window.dispatchEvent(new Event('themechange'));
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(systemPrefersDark ? 'dark' : 'light');
    }
}

// Run immediately
initTheme();

// Listen for system changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Attach toggler handlers
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure elements exist since it's an SPA
    setTimeout(() => {
        // Event listeners are handled by onclick attributes in HTML
    }, 100);
});

window.toggleTheme = toggleTheme;
