// One shared Neon connection for every service.
// Use: const sql = require('../db/sql');  then  await sql`SELECT ... WHERE id = ${id}`
// Values are sent as parameters, so there is no SQL injection.
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.warn('Database: NOT CONFIGURED (set DATABASE_URL in backend/.env)');
  module.exports = async () => {
    throw new Error('DATABASE_URL is not set');
  };
} else {
  console.log('Database: Neon Postgres (DATABASE_URL)');
  module.exports = neon(process.env.DATABASE_URL);
}
