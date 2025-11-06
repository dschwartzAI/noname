import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL);

const migrationSQL = readFileSync('./database/migrations/0002_add_organizations.sql', 'utf-8');

console.log('🚀 Running Organization Migration...');
console.log('   Adding God > Owner > Users hierarchy');

try {
  // Execute using the query method for multi-statement SQL
  await sql.query(migrationSQL);

  console.log('✅ Organization migration completed successfully!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Set your account as God:');
  console.log('      UPDATE "user" SET "is_god" = TRUE WHERE email = \'your-email@example.com\';');
  console.log('');
  console.log('   2. Create your first organization:');
  console.log('      Use organization.create() from the client');
  console.log('');
  console.log('   3. Deploy and test!');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  console.error('Full error:', error);
  process.exit(1);
}

