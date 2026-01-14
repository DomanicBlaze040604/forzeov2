# RBAC Deployment Guide

## Quick Start

### Step 1: Run Database Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database/auth_rbac.sql`
3. Paste and execute the SQL script
4. **IMPORTANT**: Update line 188-189 with your admin email:
   ```sql
   UPDATE profiles 
   SET role = 'admin' 
   WHERE email = 'YOUR_ADMIN_EMAIL@example.com';
   ```
5. Execute the admin setup queries (lines 188-199)

### Step 2: Verify Database Setup
Run these queries to verify:
```sql
-- Check role column exists
SELECT role FROM profiles LIMIT 1;

-- Check user_clients table exists
SELECT * FROM user_clients LIMIT 1;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'prompts', 'audit_results');
```

### Step 3: Test the Application
```bash
cd d:\client-dashboard
npm run dev
```

### Step 4: Test User Roles

**As Admin:**
- Should see ALL tabs (Overview, Prompts, Campaigns, Insights-beta, Intelligence, Analytics, Schedules, Signals, Citations, Content)
- Should see ALL brands in dropdown
- Should have access to all features

**As Normal User:**
- Should see ONLY 5 tabs (Overview, Prompts, Citations, Content, Insights-beta)
- Should see ONLY assigned brands in dropdown
- Cannot access admin-only features

### Step 5: Assign Users to Brands
As an admin, you can assign users to brands using SQL:
```sql
-- Method 1: Using helper function
SELECT assign_user_to_client(
  'USER_UUID'::uuid,
  'CLIENT_UUID'::uuid
);

-- Method 2: Direct insert
INSERT INTO user_clients (user_id, client_id, granted_by)
VALUES (
  'USER_UUID',
  'CLIENT_UUID',
  'ADMIN_UUID'
);
```

## Troubleshooting

### Issue: User can't see any brands
**Solution:** Assign the user to at least one brand:
```sql
INSERT INTO user_clients (user_id, client_id)
SELECT 'USER_ID', id FROM clients LIMIT 1;
```

### Issue: RLS blocking admin
**Solution:** Verify admin role is set:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'ADMIN_USER_ID';
```

### Issue: TypeScript errors
**Solution:** Ensure `useAuth.ts` is in `src/hooks/` directory

## Next Steps

1. **Create User Management UI** (Phase 4) - Admin dashboard to assign users
2. **Add Email Invitations** - Automated user onboarding
3. **Add Activity Logging** - Track user actions for audit trails

## Files Modified

- `database/auth_rbac.sql` - Database schema and RLS policies
- `src/hooks/useAuth.ts` - Authentication hook
- `src/pages/ClientDashboard.tsx` - Tab and client filtering

## Security Notes

✅ **RLS Enabled** - Row Level Security prevents unauthorized data access at database level
✅ **Frontend Filtering** - UI hides restricted content from normal users
✅ **Helper Functions** - Database functions use `SECURITY DEFINER` for elevated permissions
⚠️ **API Calls** - Frontend still trusted - consider adding backend permission checks for extra security
