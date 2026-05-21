const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../utils/db');
const { authMiddleware } = require('./auth');

// GET /api/products – list with pagination, search, filter, sort
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, search, category, sort } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM Products WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    // Sorting
    if (sort === 'price-asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'price-desc') {
      query += ' ORDER BY price DESC';
    } else {
      query += ' ORDER BY id DESC';
    }

    // Get paginated results
    const paginatedQuery = `${query} LIMIT ? OFFSET ?`;
    const paginatedParams = [...params, Number(limit), offset];

    const products = await dbAll(paginatedQuery, paginatedParams);
    
    // Parse features JSON string to array safely
    const parsedProducts = products.map(p => {
      let parsedFeatures = [];
      try {
        parsedFeatures = p.features ? JSON.parse(p.features) : [];
      } catch (e) {
        console.warn(`Failed to parse features for product ${p.id}:`, e);
      }
      return {
        ...p,
        features: parsedFeatures,
        inStock: !!p.inStock
      };
    });

    // Get total count
    const totalQuery = `SELECT COUNT(*) as count FROM (${query})`;
    const countRow = await dbGet(totalQuery, params);
    const total = countRow ? countRow.count : 0;

    res.json({
      success: true,
      products: parsedProducts,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/products/:id – single product
router.get('/:id', async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM Products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    res.json({
      success: true,
      product: {
        ...product,
        features: (() => {
          try {
            return product.features ? JSON.parse(product.features) : [];
          } catch (e) {
            console.warn(`Failed to parse features for product ${product.id}:`, e);
            return [];
          }
        })(),
        inStock: !!product.inStock
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: CREATE new product
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  const { name, tagline, category, price, originalPrice, image, capacity, inStock, features, description, rating, reviews } = req.body;
  
  if (!name || !category || !price) {
    return res.status(400).json({ success: false, message: 'Name, category, and price are required.' });
  }

  const id = String(Date.now());
  try {
    await dbRun(`INSERT INTO Products 
      (id, name, tagline, category, price, originalPrice, image, capacity, inStock, features, description, rating, reviews) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        tagline || '',
        category,
        Number(price),
        Number(originalPrice || 0),
        image || '',
        capacity || '',
        inStock ? 1 : 0,
        JSON.stringify(features || []),
        description || '',
        Number(rating || 4.5),
        Number(reviews || 0)
      ]
    );

    res.json({ success: true, product: { id, name, tagline, category, price, originalPrice, image, capacity, inStock, features, description, rating: Number(rating || 4.5), reviews: Number(reviews || 0) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: UPDATE product
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  
  try {
    const existing = await dbGet('SELECT * FROM Products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const { name, tagline, category, price, originalPrice, image, capacity, inStock, features, description, rating, reviews } = req.body;

    await dbRun(`UPDATE Products SET 
      name = ?, tagline = ?, category = ?, price = ?, originalPrice = ?, image = ?, capacity = ?, inStock = ?, features = ?, description = ?, rating = ?, reviews = ? 
      WHERE id = ?`,
      [
        name !== undefined ? name : existing.name,
        tagline !== undefined ? tagline : existing.tagline,
        category !== undefined ? category : existing.category,
        price !== undefined ? Number(price) : existing.price,
        originalPrice !== undefined ? Number(originalPrice) : existing.originalPrice,
        image !== undefined ? image : existing.image,
        capacity !== undefined ? capacity : existing.capacity,
        inStock !== undefined ? (inStock ? 1 : 0) : existing.inStock,
        features !== undefined ? JSON.stringify(features) : existing.features,
        description !== undefined ? description : existing.description,
        rating !== undefined ? Number(rating) : existing.rating,
        reviews !== undefined ? Number(reviews) : existing.reviews,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: DELETE product
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  
  try {
    const existing = await dbGet('SELECT * FROM Products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    await dbRun('DELETE FROM Products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
