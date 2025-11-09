# FlowBoard Authentication Setup

## Overview
FlowBoard now includes Supabase authentication for secure user logins and cloud-based board storage. Each user's boards are stored in the cloud and synced across devices.

## New Files Added

### 1. `login.html`
- Beautiful login/signup page with water theme
- Tab-based interface for switching between login and signup
- Email/password authentication
- Error and success message handling
- Redirects to app.html after successful authentication

### 2. `supabase.js`
- Initializes Supabase client with your project credentials
- Exports the client for use across the app
- Uses ESM import from Supabase CDN

### 3. `auth.js`
- Handles login and signup form submissions
- Validates passwords match on signup
- Shows friendly error messages
- Auto-redirects authenticated users to the app
- Checks authentication status on page load

### 4. `db.js`
- `getCurrentUser()` - Gets the currently logged-in user
- `saveBoards(userId, boardsData)` - Saves boards to Supabase
- `loadBoards(userId)` - Loads boards from Supabase
- `signOut()` - Logs out and redirects to landing page

## Changes to Existing Files

### `app.html`
- Added user email display in header
- Added logout button
- Changed script tag to `type="module"` for ES6 imports

### `app.js`
- Imported database functions from `db.js`
- Added `currentUser` global variable
- Modified `saveData()` to save to Supabase instead of localStorage
- Added `initializeApp()` function that:
  - Checks if user is authenticated
  - Redirects to login if not authenticated
  - Loads boards from Supabase
  - Migrates local data to cloud on first login
  - Displays user email in header

### `index.html` (Landing Page)
- Added "Login" button to navigation
- Updated hero buttons to point to login page
- Changed feature badges to highlight "Cloud Sync" and "Secure Login"

## Supabase Configuration

Your Supabase project is already configured:
- **Project ID**: ukiwgiioafkilhcpaymb
- **Project URL**: https://ukiwgiioafkilhcpaymb.supabase.co
- **Anon Key**: (stored in supabase.js)

## Database Setup

Make sure you've created the `boards` table in Supabase with this SQL:

```sql
-- Create boards table
CREATE TABLE boards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  board_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own boards
CREATE POLICY "Users can view own boards" 
  ON boards FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own boards
CREATE POLICY "Users can insert own boards" 
  ON boards FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own boards
CREATE POLICY "Users can update own boards" 
  ON boards FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own boards
CREATE POLICY "Users can delete own boards" 
  ON boards FOR DELETE 
  USING (auth.uid() = user_id);
```

## Testing Locally

To test the authentication flow locally:

1. **Install a local web server** (needed for ES modules):
   ```bash
   # Option 1: Using Python
   python -m http.server 8080
   
   # Option 2: Using Node.js
   npx http-server -p 8080
   
   # Option 3: Using VS Code Live Server extension
   # Right-click index.html → "Open with Live Server"
   ```

2. **Open in browser**:
   - Navigate to `http://localhost:8080`
   - Click "Get Started Free" or "Login"
   - Create an account with your email
   - Check email for confirmation (if enabled in Supabase)
   - Login and test board creation/editing

3. **Test features**:
   - ✅ Sign up with new email
   - ✅ Login with existing account
   - ✅ Create boards and lists
   - ✅ Boards save automatically to Supabase
   - ✅ Logout and login again - boards persist
   - ✅ Open in different browser - same boards appear

## Deployment to GitHub Pages

Since GitHub Pages now hosts your app, users can:
1. Visit https://pkprog2.github.io/Flowboard/
2. Sign up or login
3. Use FlowBoard with cloud sync across devices

### Important Notes for GitHub Pages:
- ES modules work fine on GitHub Pages
- HTTPS is required for Supabase (GitHub Pages provides HTTPS)
- All authentication requests go directly to Supabase
- No backend server needed - fully client-side

## Security Features

✅ **Row-Level Security (RLS)**: Each user can only access their own boards
✅ **Secure Authentication**: Handled by Supabase (battle-tested)
✅ **HTTPS Only**: All requests encrypted in transit
✅ **Password Requirements**: Minimum 6 characters enforced
✅ **Email Confirmation**: Can be enabled in Supabase settings

## Data Migration

When a user logs in for the first time:
- App checks localStorage for existing boards
- If found, automatically migrates to Supabase
- User doesn't lose any data
- Future saves go to cloud

## Next Steps

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add Supabase authentication and cloud storage"
   git push origin main
   ```

2. **Test on GitHub Pages**:
   - Wait ~1 minute for deployment
   - Visit https://pkprog2.github.io/Flowboard/
   - Test signup/login flow

3. **Configure Supabase (Optional)**:
   - Email confirmation (Settings → Authentication)
   - Custom email templates
   - OAuth providers (Google, GitHub, etc.)
   - Password recovery emails

## Troubleshooting

### "Module not found" errors
- Make sure you're accessing the site via HTTP (http://localhost:8080)
- File:// URLs don't support ES modules

### "Failed to load boards"
- Check browser console for errors
- Verify Supabase credentials in supabase.js
- Confirm boards table exists in Supabase
- Check RLS policies are set up correctly

### Can't login after signup
- Check if email confirmation is required (Supabase → Authentication → Settings)
- Look for confirmation email in inbox/spam
- Disable email confirmation for testing

### Boards not syncing
- Open browser dev tools → Network tab
- Check for failed Supabase requests
- Verify user is authenticated (check localStorage for supabase.auth.token)

## Support

For issues with:
- **FlowBoard functionality**: Check app.js console logs
- **Authentication**: Check Supabase dashboard → Authentication → Users
- **Database**: Check Supabase dashboard → Table Editor → boards
- **Deployment**: Check GitHub Actions for build errors
