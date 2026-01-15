# Deployment Guide for Agency Dashboard

## 1. Database Schema Updates
You must run the `database/agency_schema.sql` migration to enable Agency Roles and Brand Management.

**Steps:**
1.  Go to your Supabase Project Dashboard.
2.  Open the **SQL Editor**.
3.  Copy the content of `database/agency_schema.sql`.
4.  Paste it into the editor and click **Run**.
5.  Check the output for success message: `"Agency schema migration completed successfully!"`.

## 2. Deploy Edge Functions
The `geo-audit` function has been updated to support improved AI Overview parsing and competitor discovery.

**Command:**
```powershell
supabase functions deploy geo-audit
```

## 3. Frontend Deployment
Since the build passed successfully (`npm run build`), you can deploy the frontend to your hosting provider (e.g., Netlify, Vercel).

**Command (Build):**
```powershell
npm run build
```
This produces the `dist` folder which should be published.

## 4. Verification
After deployment:
1.  Log in as a user with the `agency` role (or create one using the database override if needed).
    *   *Note: You may need to manually update a user's role to 'agency' in the `profiles` table if you haven't built a UI for role assignment yet.*
2.  Assign brands to this agency user (using the `agency_brands` table or admin functions provided in the schema).
3.  Verify the "Overview" tab shows the agency summary.
4.  Verify the "Brands" tab list allows navigating between clients.
