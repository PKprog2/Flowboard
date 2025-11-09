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
