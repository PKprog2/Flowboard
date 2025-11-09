# 🔧 URGENT FIX: Redirect URL Error

## Problem
After signing up/logging in, you get "This site can't be reached" error.

## Cause
Supabase doesn't know your GitHub Pages URL as an allowed redirect destination.

## Solution - Configure Supabase URLs

### Step 1: Update Site URL in Supabase

1. Go to: https://supabase.com/dashboard/project/ukiwgiioafkilhcpaymb/auth/url-configuration

2. **Set Site URL to:**
   ```
   https://pkprog2.github.io/Flowboard/
   ```

3. **Add Redirect URLs** (click "Add URL" for each):
   ```
   https://pkprog2.github.io/Flowboard/app.html
   https://pkprog2.github.io/Flowboard/login.html
   https://pkprog2.github.io/Flowboard/
   http://localhost:8080/app.html
   ```

4. **Click SAVE**

### Step 2: Wait 1-2 Minutes
The configuration needs to propagate.

### Step 3: Test Again
1. Go to: https://pkprog2.github.io/Flowboard/
2. Click "Get Started Free"
3. Sign up with email/password
4. Should redirect to app.html successfully!

---

## Quick Test Right Now

**Alternative test URL that might work:**
- Try signing up at: https://pkprog2.github.io/Flowboard/login.html
- After clicking the email confirmation link (if required)
- It should redirect properly once URLs are configured

---

## What Each URL Does

- **Site URL**: The main URL of your application
- **Redirect URLs**: Where users can be sent after auth (must be explicitly allowed)

Without these configured, Supabase blocks the redirect for security.
