// =============================================
// Authentication Logic
// =============================================

// --- LOGIN ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('loginBtn');

    errorEl.style.display = 'none';

    if (!email || !password) {
        showAuthError(errorEl, 'Please fill in all fields.');
        return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in...';

    try {
        if (!supabaseClient) throw new Error("Supabase is not configured. Please add your credentials in supabase-config.js");
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
    } catch (err) {
        showAuthError(errorEl, err.message || 'Login failed. Please try again.');
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Sign In';
    }
}

// --- SIGNUP ---
async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');
    const btn = document.getElementById('signupBtn');

    errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';

    if (!email || !password || !confirm) {
        showAuthError(errorEl, 'Please fill in all fields.');
        return;
    }
    if (password.length < 6) {
        showAuthError(errorEl, 'Password must be at least 6 characters.');
        return;
    }
    if (password !== confirm) {
        showAuthError(errorEl, 'Passwords do not match.');
        return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating account...';

    try {
        if (!supabaseClient) throw new Error("Supabase is not configured. Please add your credentials in supabase-config.js");
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (successEl) {
            successEl.textContent = '✓ Account created! Check your email to verify, then sign in.';
            successEl.style.display = 'block';
        }
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Create Account';
    } catch (err) {
        showAuthError(errorEl, err.message || 'Signup failed. Please try again.');
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Create Account';
    }
}

// --- LOGOUT ---
async function handleLogout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    window.location.href = '/login';
}

// --- SESSION CHECK ---
async function requireAuth() {
    if (!supabaseClient) {
        console.warn("Supabase not configured. Mocking session for development.");
        return { user: { id: 'mock-id', email: 'mockuser@example.com' } };
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/login';
        return null;
    }
    return session;
}

async function redirectIfLoggedIn() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = '/dashboard';
    }
}

// --- HELPERS ---
function showAuthError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

// Toggle password visibility
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
