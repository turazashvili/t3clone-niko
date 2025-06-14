
-- Create an enum type for user plans
CREATE TYPE public.app_plan AS ENUM ('free', 'pro');

-- Create a table for public user profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT,
  plan public.app_plan NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  basic_model_monthly_limit INT NOT NULL DEFAULT 100,
  premium_model_monthly_limit INT NOT NULL DEFAULT 0,
  current_basic_model_count INT NOT NULL DEFAULT 0,
  current_premium_model_count INT NOT NULL DEFAULT 0,
  chat_count INT NOT NULL DEFAULT 0,
  usage_period_start_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- This trigger automatically creates a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable realtime updates for profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

