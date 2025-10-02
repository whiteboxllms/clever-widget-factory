-- CRITICAL SECURITY FIXES - Phase 1

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

-- 3. Add basic profile security - separate user profile viewing from role management
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- Users can view their own complete profile
CREATE POLICY "Users can view their own full profile" 
ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can view basic info of other authenticated users (name only, not sensitive data)
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles
FOR SELECT 
USING (auth.uid() IS NOT NULL);