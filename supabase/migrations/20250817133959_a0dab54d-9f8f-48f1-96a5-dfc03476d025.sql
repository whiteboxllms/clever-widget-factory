-- Add DELETE policy for parts_orders table to allow users to delete their own orders
CREATE POLICY "Users can delete their own orders" 
ON public.parts_orders
FOR DELETE 
USING (ordered_by = auth.uid());