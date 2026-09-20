-- Run this in your Supabase SQL Editor to set up the default Organization and Auth Trigger

-- 1. Create a Default Organization
INSERT INTO public.organizations (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'My Default Org')
ON CONFLICT (id) DO NOTHING;

-- 2. Create a function to automatically sync new signups to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, organization_id, role)
  VALUES (
    new.id, 
    new.email, 
    '00000000-0000-0000-0000-000000000000', -- Assigns them to the default org
    'admin'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger to fire whenever a new user is added to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
