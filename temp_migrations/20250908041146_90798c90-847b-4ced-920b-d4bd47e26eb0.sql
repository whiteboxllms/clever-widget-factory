-- Remove Stefan Hamilton from Department of Agriculture organization
-- He should only belong to Stargazer Farm
DELETE FROM organization_members 
WHERE organization_id = '21af58e1-2f60-48e1-8940-16669c677870' 
AND user_id = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd';