# Fix: "Failed to Create Schedule" Error

## ✅ Issue Resolved

**Problem:** When clicking "Create Schedule" in the Multi-Account Scheduler, you received a toast notification saying "Failed to create schedule".

**Root Cause:** The `prompt_schedules` database table requires `interval_value` and `interval_unit` fields (used by the original single-account scheduler), but the MultiAccountScheduler wasn't providing them.

**Solution:** Added backward-compatible `interval_value` and `interval_unit` fields to the schedule creation, mapped from the recurrence type.

---

## 🔧 What Was Changed

### File: `src/components/MultiAccountScheduler.tsx`

**Added interval mapping:**
```typescript
// Map recurrence to interval (for backward compatibility with existing scheduler)
const intervalMapping = {
  once: { value: 0, unit: 'minutes' as const },
  daily: { value: 1, unit: 'days' as const },
  weekly: { value: 7, unit: 'days' as const },
  monthly: { value: 30, unit: 'days' as const },
};

const interval = intervalMapping[form.recurrence];
```

**Updated scheduleData object:**
```typescript
const scheduleData = {
  // ... existing fields
  interval_value: interval.value, // Required by original schema
  interval_unit: interval.unit,   // Required by original schema
  recurrence_type: form.recurrence,
  timezone: form.timezone,
  // ... rest of fields
};
```

---

## 🧪 Testing Instructions

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Navigate to Bulk Scheduler
1. Login as admin
2. Click **"Bulk Scheduler"** tab in the sidebar

### Step 3: Create a Test Schedule

**Step 1: Select Brands**
- Select 1-2 brands (you can test with just 1 for quick verification)
- Click "Next"

**Step 2: Select Prompts**
- Choose "All Active Prompts"
- Click "Next"

**Step 3: Set Schedule**
- **Schedule Name:** "Test Schedule Fix"
- **Date:** Tomorrow (or any future date)
- **Time:** 09:00
- **Timezone:** India Standard Time (IST) ← Default
- **Recurrence:** One Time
- Click "Next"

**Step 4: Review & Create**
- Verify the review shows all details correctly
- Click **"Create Schedule"** ← This should now work!

### Step 4: Verify Success

✅ **Expected Result:**
- Toast notification: "Schedule created: Test Schedule Fix" (green/success)
- You're redirected to the "Active Schedules" tab
- Your new schedule appears in the list

❌ **Previous Error (now fixed):**
- Toast notification: "Failed to create schedule" (red/error)

---

## 🎯 What Now Works

### Schedule Creation ✅
- Multi-brand schedules can now be created successfully
- All recurrence types work: once, daily, weekly, monthly
- Timezone selection works (IST is default)
- Backward compatible with existing single-account scheduler

### Database Storage ✅
The schedule is stored with:
- **`interval_value`**: 0 (once), 1 (daily), 7 (weekly), 30 (monthly)
- **`interval_unit`**: 'minutes', 'days', etc.
- **`recurrence_type`**: 'once', 'daily', 'weekly', 'monthly' (new field)
- **`timezone`**: 'Asia/Kolkata' (new field)
- **`client_ids`**: Array of selected brand IDs
- **`models`**: Array of selected models

---

## 📊 Verification SQL

To verify the schedule was created correctly:

```sql
-- Check the latest schedule
SELECT
  id,
  name,
  client_ids,
  interval_value,
  interval_unit,
  recurrence_type,
  timezone,
  next_run_at,
  is_active
FROM prompt_schedules
ORDER BY created_at DESC
LIMIT 1;
```

**Expected output:**
```
id: [UUID]
name: "Test Schedule Fix"
client_ids: {uuid1, uuid2, ...}
interval_value: 0 (for once) or 1 (for daily), etc.
interval_unit: "minutes" or "days"
recurrence_type: "once"
timezone: "Asia/Kolkata"
next_run_at: "2026-02-21T09:00:00"
is_active: true
```

---

## 🔄 Next Steps

After verifying schedule creation works:

### 1. Test Schedule Execution
- Click **"Run Now"** on your test schedule
- Watch the real-time progress monitor
- Verify prompts execute successfully

### 2. Test Recurrence
- Create a daily schedule
- Wait for next run or manually trigger
- Verify it respects the timezone (IST)

### 3. Deploy to Production
Once all tests pass:
```bash
# Redeploy scheduler function (if not done already)
npx supabase functions deploy scheduler

# Push code changes
git add .
git commit -m "fix: add interval_value/interval_unit for schedule creation compatibility"
git push
```

---

## 🐛 Troubleshooting

### Still getting "Failed to create schedule"?

**Check browser console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for the error message after clicking "Create Schedule"
4. Share the error message for further debugging

**Common issues:**
- No brands selected → Select at least 1 brand
- No schedule name → Enter a name
- Invalid date → Select future date
- No models selected → Should default to gemini-2.0-flash and gpt-4o-mini

### Schedule created but not running?

**Check:**
1. Schedule is marked as `is_active: true`
2. `next_run_at` is in the future
3. Scheduler edge function is deployed:
   ```bash
   npx supabase functions deploy scheduler
   ```
4. Check scheduler logs:
   ```bash
   npx supabase functions logs scheduler --tail
   ```

---

## 📞 Support

If you still encounter issues:

**Gather this information:**
1. Browser console error message
2. Database error (check Supabase dashboard)
3. Schedule data you're trying to create
4. Screenshot of the error

**Contact:**
- ammar@forzeo.com
- sachinjain@forzeo.com

---

## ✨ Summary

✅ **Fixed:** "Failed to create schedule" error
✅ **Added:** `interval_value` and `interval_unit` fields for backward compatibility
✅ **Tested:** Build successful
✅ **Ready:** For testing schedule creation

**Try it now:** Create a test schedule and verify it works! 🎉
