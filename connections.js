const {  Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.MYPOSTGRES_HOSTNAME,
  port: process.env.MYPOSTGRES_PORT,
  database: process.env.MYPOSTGRES_DATABASE,
  password: process.env.MYPOSTGRES_PASSWORD,
  user: process.env.MYPOSTGRES_USERNAME,
});
pool.connect().then((result) => console.log('connected'));
module.exports = pool;
