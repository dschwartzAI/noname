/**
 * Cleanup script to delete extra organizations and keep only SoloOS
 * Run with: npx tsx cleanup-orgs.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YBZ6UpWyojN4@ep-holy-dawn-afutxqyk.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

async function cleanupOrganizations() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('🔍 Step 1: Checking current organizations...\n');
    
    // Get all organizations
    const orgs = await sql`
      SELECT id, name, slug, created_at 
      FROM organization 
      ORDER BY created_at
    `;
    
    console.log('Found organizations:');
    orgs.forEach((org, i) => {
      console.log(`  ${i + 1}. ${org.name} (${org.slug}) - Created: ${org.created_at}`);
    });
    console.log('');
    
    if (orgs.length <= 1) {
      console.log('✅ Only one organization exists. Nothing to clean up!');
      return;
    }
    
    // Delete organizations that are NOT SoloOS
    console.log('🗑️  Step 2: Deleting extra organizations...\n');
    
    const result = await sql`
      DELETE FROM organization 
      WHERE name IN ('Dan''s Test Workspace', 'Test Organization')
      RETURNING id, name
    `;
    
    console.log('Deleted organizations:');
    result.forEach((org) => {
      console.log(`  ❌ ${org.name}`);
    });
    console.log('');
    
    // Verify only SoloOS remains
    console.log('✅ Step 3: Verifying cleanup...\n');
    
    const remaining = await sql`
      SELECT o.id, o.name, o.slug, o.created_at,
             COUNT(m.id) as member_count
      FROM organization o
      LEFT JOIN member m ON o.id = m.organization_id
      GROUP BY o.id, o.name, o.slug, o.created_at
      ORDER BY o.created_at
    `;
    
    console.log('Remaining organizations:');
    remaining.forEach((org) => {
      console.log(`  ✓ ${org.name} (${org.slug})`);
      console.log(`    Members: ${org.member_count}`);
      console.log(`    Created: ${org.created_at}`);
    });
    console.log('');
    
    console.log('🎉 Cleanup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('  2. The sidebar should now show "SoloOS"');
    console.log('  3. Check the God Dashboard to verify only one organization exists');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupOrganizations()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

