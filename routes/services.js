const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// Middleware to verify JWT token and admin role
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user;
    next();
  });
};

// Get all services (public - no auth required)
router.get('/', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM services ORDER BY id');
    res.json({
      success: true,
      services: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single service by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({
      success: true,
      service: result[0],
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new service (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, price, description } = req.body;

    // Validate required fields
    if (!name || !price || !description) {
      return res.status(400).json({ error: 'Name, price, and description are required' });
    }

    // Validate price
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    const [result] = await pool.query(
      'INSERT INTO services (name, price, description) VALUES (?, ?, ?)',
      [name, parseFloat(price), description]
    );

    // Get the inserted service
    const [serviceRows] = await pool.query('SELECT * FROM services WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: serviceRows[0],
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service (admin only)
router.put('/', authenticateAdmin, async (req, res) => {
  try {
    const { id, name, price, description } = req.body;

    // Validate required fields
    if (!id || !name || !price || !description) {
      return res.status(400).json({ error: 'ID, name, price, and description are required' });
    }

    // Validate price
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    // Check if service exists
    const [serviceCheck] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    if (serviceCheck.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    await pool.query(
      'UPDATE services SET name = ?, price = ?, description = ? WHERE id = ?',
      [name, parseFloat(price), description, id]
    );

    // Get updated service
    const [result] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: result[0],
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service (admin only)
router.delete('/', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    // Check if service exists
    const [serviceCheck] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    if (serviceCheck.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if service is used in any bookings
    const [bookingCheck] = await pool.query('SELECT COUNT(*) as count FROM bookings WHERE service_id = ?', [id]);
    if (parseInt(bookingCheck[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete service that has existing bookings' 
      });
    }

    await pool.query('DELETE FROM services WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
