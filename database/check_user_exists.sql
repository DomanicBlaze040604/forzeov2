
-- CHECK IF USER EXISTS
-- Replace 'agency@solstium.com' with the email you are trying to log in with.
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'agency@solstium.com';

-- IF NO RESULTS: The user is gone. You must Sign Up again.
-- IF RESULT EXISTS: The user is there, but the password is wrong.
-- Go to Supabase > Authentication > Users > Identify the user > 3 dots > Send password recovery.
