const mysql = require('mysql2/promise');

// Parse DATABASE_URL or use individual connection params
const pool = mysql.createPool(
  process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'carwash',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  }
);

// Database initialization script
const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        role VARCHAR(20) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user if it doesn't exist
    const bcrypt = require('bcryptjs');
    try {
      const [adminCheck] = await connection.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
      if (parseInt(adminCheck[0].count) === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.query(`
          INSERT INTO users (username, email, password_hash, full_name, phone, role) VALUES
          ('admin', 'admin@gmail.com', ?, 'System Administrator', '09123456789', 'admin')
        `, [hashedPassword]);
        console.log('Default admin user created');
        console.log('Admin login: admin@gmail.com / admin123');
      }
    } catch (error) {
      console.log('Admin user creation error:', error.message);
    }

    // Create services table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT
      )
    `);

    // Create bookings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        service_id INT,
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        customer_name VARCHAR(100),
        customer_phone VARCHAR(20),
        customer_email VARCHAR(100),
        car_type VARCHAR(50),
        license_plate VARCHAR(20),
        car_color VARCHAR(30),
        notes TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        total_amount DECIMAL(10,2),
        payment_status VARCHAR(20) DEFAULT 'pending',
        paypal_order_id VARCHAR(100),
        paypal_capture_id VARCHAR(100),
        payment_completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `);

    // Insert default services if they don't exist
    const [servicesCheck] = await connection.query('SELECT COUNT(*) as count FROM services');
    if (parseInt(servicesCheck[0].count) === 0) {
      await connection.query(`
        INSERT INTO services (name, price, description) VALUES
        ('Basic Wash', 200, 'Simple exterior rinse and soap cleaning'),
        ('Express Wash', 300, 'Quick exterior wash and rinse (15 minutes)'),
        ('Interior Cleaning', 400, 'Vacuum, dashboard cleaning, and seat wiping'),
        ('Standard Wash', 500, 'Complete exterior wash with soap and wax'),
        ('Engine Bay Cleaning', 600, 'Professional engine compartment cleaning'),
        ('Full Service Wash', 700, 'Exterior wash + interior cleaning combo'),
        ('Deep Cleaning', 800, 'Thorough interior and exterior deep cleaning'),
        ('Premium Detailing', 1000, 'Complete premium cleaning with wax and protection')
      `);
      console.log('Default services inserted');
    }

    connection.release();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

module.exports = { pool, initDatabase };
