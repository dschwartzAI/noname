import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_YBZ6UpWyojN4@ep-holy-dawn-afutxqyk.us-west-2.aws.neon.tech/neondb?sslmode=require');

async function checkLogoUrl() {
  const result = await sql`SELECT id, name, logo FROM "organization" WHERE name = 'SoloOS'`;
  console.log('Organization data:', JSON.stringify(result, null, 2));
}

checkLogoUrl();

