import { supabase } from './supabase.js';

// Tab switching
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    authTabs.forEach(t => t.classList.remove('active'));
    authForms.forEach(f => f.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${tabName}-form`).classList.add('active');
    
    hideMessages();
  });
});

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  document.getElementById('success-message').classList.remove('show');
}

// Show success message
function showSuccess(message) {
  const successDiv = document.getElementById('success-message');
  successDiv.textContent = message;
  successDiv.classList.add('show');
  document.getElementById('error-message').classList.remove('show');
}

// Hide messages
function hideMessages() {
  document.getElementById('error-message').classList.remove('show');
  document.getElementById('success-message').classList.remove('show');
}

// Check if user is already logged in
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = 'app.html';
  }
}

// Google Sign-In handler
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    googleLoginBtn.disabled = true;
    googleLoginBtn.textContent = 'Connecting to Google...';
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/Flowboard/app.html'
        }
      });
      
      if (error) throw error;
      
      // User will be redirected to Google for authentication
      // After auth, they'll be redirected back to app.html
    } catch (error) {
      showError(error.message || 'Failed to connect with Google');
      googleLoginBtn.disabled = false;
      googleLoginBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      `;
    }
  });
}

// Login handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = e.target.querySelector('.submit-btn');
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Redirect to app
    window.location.href = 'app.html';
  } catch (error) {
    showError(error.message || 'Failed to login. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});

// Signup handler
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;
  const submitBtn = e.target.querySelector('.submit-btn');
  
  // Validate passwords match
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) throw error;
    
    // Check if email confirmation is required
    if (data.user && !data.session) {
      showSuccess('Account created! Please check your email to confirm your account.');
      submitBtn.textContent = 'Create Account';
      e.target.reset();
    } else {
      // Auto-logged in, redirect to app
      window.location.href = 'app.html';
    }
  } catch (error) {
    showError(error.message || 'Failed to create account. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
});

// Check auth on page load
checkAuth();
