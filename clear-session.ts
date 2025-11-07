import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_YBZ6UpWyojN4@ep-holy-dawn-afutxqyk.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require');

async function clearSessions() {
  await sql`DELETE FROM session WHERE user_id = 'RbQBtdGE6d1bEDQGEw3eKPQRyHAHyyvr'`;
  console.log('✅ Sessions cleared. Please refresh your browser and sign in again.');
}

clearSessions();
