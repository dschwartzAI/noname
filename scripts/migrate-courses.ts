import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sql = neon(databaseUrl)
  
  // Read the migration file
  const migrationPath = join(process.cwd(), 'database/migrations/0006_add_courses_tables.sql')
  const migrationSQL = readFileSync(migrationPath, 'utf-8')
  
  console.log('🚀 Running courses migration...')
  
  try {
    await sql.unsafe(migrationSQL)
    console.log('✅ Courses migration completed successfully!')
  } catch (error: any) {
    if (
      error?.code === '42P07' ||
      error?.code === '42710' ||
      error?.message?.includes('already exists') ||
      error?.message?.includes('duplicate')
    ) {
      console.log('ℹ️  Tables or indexes already exist, skipping...')
    } else {
      console.error('❌ Migration error:', error.message || error)
      throw error
    }
  }
}

runMigration().catch(console.error)

