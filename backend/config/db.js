const mysql = require('mysql2/promise');

const connection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // DECIMAL columns (price) come back as strings: never rounded through a float.
  decimalNumbers: false,
  // DATETIME columns come back as "YYYY-MM-DD HH:MM:SS": the time at the fair, never shifted
  // through the server's timezone.
  dateStrings: true,
});

// Test the connection at startup
connection.query('SELECT 1')
  .then(() => console.log('Database connection successful!'))
  .catch((err) => console.error('Error connecting to the database:', err.message));

module.exports = connection;
