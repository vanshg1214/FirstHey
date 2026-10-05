-- Function to automatically handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- 1. Create a new organization based on metadata passed during signup
  -- Fallback to 'My Organization' if no company name is provided
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(new.raw_user_meta_data->>'company_name', 'My Organization'))
  RETURNING id INTO new_org_id;

  -- 2. Create the user profile in our public table
  INSERT INTO public.users (id, organization_id, role, email)
  VALUES (new.id, new_org_id, 'admin', new.email);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function every time a new row is added to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
