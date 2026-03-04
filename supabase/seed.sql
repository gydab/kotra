-- Seed helper for kotra.is
-- Use in Supabase SQL editor after creating auth users.
-- Replace the UUIDs with the auth.user.id values from Supabase Auth.

INSERT INTO admin_profiles (id, email, display_name, role)
VALUES ('8f47f9d9-96db-44a0-91be-ed05eaccbacf', 'gyda.bjorg@gmail.com', 'Gyda Admin', 'admin');

-- Regular user (no admin rights). Not needed in admin_profiles; kept here for reference.
-- INSERT INTO admin_profiles (id, email, display_name, role)
-- VALUES ('00000000-0000-0000-0000-000000000002', 'user@kotra.is', 'General User', 'editor');

-- Notes:
-- 1) First create the users in Supabase Auth (Authentication > Users > Add user)
-- 2) Copy the user UUIDs and plug them above
-- 3) Run this seed script once. You can delete or keep for future reference.