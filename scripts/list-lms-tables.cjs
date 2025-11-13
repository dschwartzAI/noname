const { neon } = require('@neondatabase/serverless')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sql = neon(databaseUrl)
  const result = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('courses', 'modules', 'lessons', 'course_enrollments', 'lesson_progress') ORDER BY table_name`
  console.log(result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
