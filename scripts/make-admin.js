const { Client } = require('pg')

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/make-admin.js user@example.com')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const result = await client.query(
      `UPDATE users
       SET is_admin = TRUE
       WHERE email = $1
       RETURNING id, email`,
      [email.trim().toLowerCase()]
    )
    if (!result.rowCount) {
      console.error(`No user found for ${email}`)
      process.exit(1)
    }
    console.log(`Admin granted to ${result.rows[0].email}. Sign in again so the session picks it up.`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
