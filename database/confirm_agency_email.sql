-- ============================================
-- MANUALLY CONFIRM AGENCY EMAIL
-- ============================================

-- This command marks the user's email as verified so they can log in.
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmation_token = NULL
WHERE email = 'agency@solstium.com';

-- Verify the role is also set correctly while we are at it
UPDATE profiles 
SET role = 'agency' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'agency@solstium.com');
