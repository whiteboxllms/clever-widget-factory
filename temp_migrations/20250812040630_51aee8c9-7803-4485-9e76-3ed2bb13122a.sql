-- Fix security vulnerability: Remove public access to checkouts and checkins tables
-- These tables contain sensitive user identity data that should not be publicly accessible

-- Drop the insecure public read policies
DROP POLICY IF EXISTS "Anyone can view checkouts" ON public.checkouts;
DROP POLICY IF EXISTS "Anyone can view checkins" ON public.checkins;

-- Create secure policies for checkouts table
-- Users can only view their own checkout records
CREATE POLICY "Users can view their own checkouts" ON public.checkouts
FOR SELECT 
USING (auth.uid() = user_id);

-- Leadership can view all checkouts for management purposes
CREATE POLICY "Leadership can view all checkouts" ON public.checkouts
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'leadership'
  )
);

-- Create secure policies for checkins table  
-- Users can view checkins for their own checkouts
CREATE POLICY "Users can view their own checkins" ON public.checkins
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.checkouts 
    WHERE id = checkins.checkout_id 
    AND user_id = auth.uid()
  )
);

-- Leadership can view all checkins for management purposes
CREATE POLICY "Leadership can view all checkins" ON public.checkins
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'leadership'
  )
);

-- Ensure the existing management policies remain intact
-- (These allow authenticated users to INSERT/UPDATE/DELETE their own records)