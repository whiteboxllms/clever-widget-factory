-- Create storage buckets for tool images
INSERT INTO storage.buckets (id, name, public) VALUES ('tool-images', 'tool-images', true);

-- Create enum for tool status
CREATE TYPE public.tool_status AS ENUM ('available', 'checked_out', 'broken', 'maintenance');

-- Create enum for tool condition
CREATE TYPE public.tool_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'broken');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tools table
CREATE TABLE public.tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  intended_storage_location TEXT NOT NULL,
  actual_location TEXT,
  status tool_status NOT NULL DEFAULT 'available',
  condition tool_condition NOT NULL DEFAULT 'good',
  serial_number TEXT,
  purchase_date DATE,
  last_maintenance DATE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parts/consumables table
CREATE TABLE public.parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  intended_storage_location TEXT NOT NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  minimum_quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  cost_per_unit DECIMAL(10,2),
  supplier TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkouts table
CREATE TABLE public.checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  intended_usage TEXT,
  checkout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_return_date DATE,
  before_image_url TEXT,
  notes TEXT,
  is_returned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkins table
CREATE TABLE public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_id UUID REFERENCES public.checkouts(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  checkin_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  condition_after tool_condition NOT NULL,
  location_found TEXT,
  returned_to_correct_location BOOLEAN NOT NULL DEFAULT false,
  problems_reported TEXT,
  after_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (farm workers can access all data)
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view tools" ON public.tools FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage tools" ON public.tools FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view parts" ON public.parts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage parts" ON public.parts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view checkouts" ON public.checkouts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage checkouts" ON public.checkouts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view checkins" ON public.checkins FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage checkins" ON public.checkins FOR ALL USING (auth.role() = 'authenticated');

-- Create storage policies for tool images
CREATE POLICY "Anyone can view tool images" ON storage.objects FOR SELECT USING (bucket_id = 'tool-images');
CREATE POLICY "Authenticated users can upload tool images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tool-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tool images" ON storage.objects FOR UPDATE USING (bucket_id = 'tool-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete tool images" ON storage.objects FOR DELETE USING (bucket_id = 'tool-images' AND auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();