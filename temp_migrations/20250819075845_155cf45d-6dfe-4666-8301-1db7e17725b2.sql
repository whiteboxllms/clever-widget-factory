-- Add efficiency_loss_percentage field to tool_issues table
ALTER TABLE public.tool_issues 
ADD COLUMN efficiency_loss_percentage numeric CHECK (efficiency_loss_percentage >= 0 AND efficiency_loss_percentage <= 100);