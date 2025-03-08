require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.MYCONNECTION_URL,
  ssl: { rejectUnauthorized: false }, // Required for cloud databases
});

pool.connect()
  .then(() => console.log("Connected successfully"))
  .catch(err => console.error("Connection error:", err));

module.exports = pool;
