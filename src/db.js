require('dotenv').config();
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in .env file");
    process.exit(1);
}

const sql = postgres(connectionString);

module.exports = sql;
