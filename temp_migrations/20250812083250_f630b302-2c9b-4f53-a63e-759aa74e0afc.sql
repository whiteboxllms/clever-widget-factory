-- Fix security vulnerability: Restrict public access to business-critical tables
-- Replace overly permissive RLS policies with authentication-based access

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can view parts" ON public.parts;
DROP POLICY IF EXISTS "Anyone can view tools" ON public.tools;
DROP POLICY IF EXISTS "Anyone can view missions" ON public.missions;
DROP POLICY IF EXISTS "Anyone can view tool audits" ON public.tool_audits;
DROP POLICY IF EXISTS "Anyone can view mission tasks" ON public.mission_tasks;
DROP POLICY IF EXISTS "Anyone can view parts history" ON public.parts_history;
DROP POLICY IF EXISTS "Anyone can view inventory usage" ON public.inventory_usage;
DROP POLICY IF EXISTS "Anyone can view mission tool usage" ON public.mission_tool_usage;
DROP POLICY IF EXISTS "Anyone can view mission attachments" ON public.mission_attachments;

-- Create secure policies requiring authentication

-- Suppliers - authenticated users only
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
TO authenticated
USING (true);

-- Parts - authenticated users only  
CREATE POLICY "Authenticated users can view parts" 
ON public.parts 
FOR SELECT 
TO authenticated
USING (true);

-- Tools - authenticated users only
CREATE POLICY "Authenticated users can view tools" 
ON public.tools 
FOR SELECT 
TO authenticated
USING (true);

-- Missions - authenticated users only
CREATE POLICY "Authenticated users can view missions" 
ON public.missions 
FOR SELECT 
TO authenticated
USING (true);

-- Tool audits - authenticated users only
CREATE POLICY "Authenticated users can view tool audits" 
ON public.tool_audits 
FOR SELECT 
TO authenticated
USING (true);

-- Mission tasks - authenticated users only
CREATE POLICY "Authenticated users can view mission tasks" 
ON public.mission_tasks 
FOR SELECT 
TO authenticated
USING (true);

-- Parts history - authenticated users only
CREATE POLICY "Authenticated users can view parts history" 
ON public.parts_history 
FOR SELECT 
TO authenticated
USING (true);

-- Inventory usage - authenticated users only
CREATE POLICY "Authenticated users can view inventory usage" 
ON public.inventory_usage 
FOR SELECT 
TO authenticated
USING (true);

-- Mission tool usage - authenticated users only
CREATE POLICY "Authenticated users can view mission tool usage" 
ON public.mission_tool_usage 
FOR SELECT 
TO authenticated
USING (true);

-- Mission attachments - authenticated users only
CREATE POLICY "Authenticated users can view mission attachments" 
ON public.mission_attachments 
FOR SELECT 
TO authenticated
USING (true);