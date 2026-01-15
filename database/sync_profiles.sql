-- Sync profiles table with auth.users
-- This creates missing profile entries for users that exist in auth.users but not in profiles

-- Step 1: Check which users are missing profiles
SELECT au.id, au.email, au.created_at 
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Step 2: Insert missing profiles for all users
INSERT INTO public.profiles (id, email, role, is_active, created_at)
SELECT 
    au.id,
    au.email,
    'user', -- Default role for new users
    true,   -- Set as active
    au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify all users now have profiles
SELECT 
    p.id,
    p.email,
    p.role,
    p.is_active,
    p.created_at
FROM public.profiles p
ORDER BY p.created_at DESC;

-- Expected: All 12+ users from auth.users should now appear
