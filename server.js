const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool, initDatabase } = require('./config/database');
const updateRoutes = require('./routes/update');
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database on startup
initDatabase();

// Routes
app.use('/api/update', updateRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/paypal', require('./routes/paypal'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Car Wash Booking API is running!',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: '1.0.0'
  });
});

// Test database connection endpoint
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Manual admin creation endpoint (temporary)
app.post('/api/create-admin', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    
    // Check if admin already exists
    const adminCheck = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.json({ message: 'Admin user already exists' });
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, email, password_hash, full_name, phone, role) VALUES
      ('admin', 'admin@gmail.com', $1, 'System Administrator', '09123456789', 'admin')
    `, [hashedPassword]);
    
    res.json({ 
      success: true, 
      message: 'Admin user created successfully',
      credentials: {
        email: 'admin@gmail.com',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
