import { createClient } from '@supabase/supabase-js';
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const USER_POOL_ID = 'us-west-2_84dcGaogx';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const cognitoClient = new CognitoIdentityProviderClient({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

async function migrateUsers() {
  console.log('🚀 Starting user migration from Supabase to Cognito...');

  try {
    // 1. Export users from Supabase
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Failed to fetch users from Supabase:', error);
      return;
    }

    console.log(`📊 Found ${users.users.length} users to migrate`);

    // 2. Get user profiles and organization memberships
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    const { data: memberships } = await supabase
      .from('organization_members')
      .select('*');

    // 3. Create mapping file for later database updates
    const userMapping = [];

    // 4. Migrate each user to Cognito
    for (const user of users.users) {
      try {
        const profile = profiles?.find(p => p.id === user.id);
        const membership = memberships?.find(m => m.user_id === user.id);
        
        const params = {
          UserPoolId: USER_POOL_ID,
          Username: user.email,
          UserAttributes: [
            { Name: 'email', Value: user.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: profile?.full_name || user.user_metadata?.full_name || user.email }
          ],
          MessageAction: 'SUPPRESS', // Don't send welcome email yet
          TemporaryPassword: generateTempPassword(),
        };

        const command = new AdminCreateUserCommand(params);
        const result = await cognitoClient.send(command);
        
        console.log(`✅ Migrated user: ${user.email}`);
        
        // Store mapping for database update
        userMapping.push({
          supabase_user_id: user.id,
          cognito_user_id: result.User.Username,
          email: user.email,
          full_name: profile?.full_name,
          role: membership?.role,
          organization_id: membership?.organization_id
        });

      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error.message);
      }
    }

    // 5. Save mapping for database updates
    await fs.writeFile(
      'user-migration-mapping.json', 
      JSON.stringify(userMapping, null, 2)
    );

    console.log(`🎉 Migration complete! Migrated ${userMapping.length} users`);
    console.log('📝 User mapping saved to user-migration-mapping.json');
    console.log('🔄 Next: Update database with new Cognito user IDs');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

function generateTempPassword() {
  return Math.random().toString(36).slice(-12) + 'A1!';
}

migrateUsers();
