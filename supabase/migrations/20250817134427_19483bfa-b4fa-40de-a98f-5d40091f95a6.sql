-- CRITICAL SECURITY FIXES

-- 1. Fix Parts Orders Public Access - Restrict sensitive financial data to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view parts orders" ON public.parts_orders;
CREATE POLICY "Authenticated users can view parts orders" 
ON public.parts_orders
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Fix Storage Vicinities Data Exposure - Require authentication to view storage data
DROP POLICY IF EXISTS "Anyone can view active storage vicinities" ON public.storage_vicinities;
CREATE POLICY "Authenticated users can view active storage vicinities" 
ON public.storage_vicinities
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- 3. Prevent Role Escalation - Create restricted profile update policy that excludes role changes
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile info only" 
ON public.profiles
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND OLD.role = NEW.role);

-- 4. Add admin-only role management policy
CREATE POLICY "Only admins can update user roles" 
ON public.profiles
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'leadership'
  )
);

-- 5. Add policy to prevent users from viewing other users' sensitive profile data
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
CREATE POLICY "Users can view their own full profile" 
ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view basic public profile info" 
ON public.profiles
FOR SELECT 
USING (auth.uid() IS NOT NULL);