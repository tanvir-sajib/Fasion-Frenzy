const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// ─── Data Directory & Helpers ──────────────────────────────────────────
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const LOGS_FILE = path.join(DB_DIR, 'logs.json');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(PRODUCTS_FILE)) writeJSON(PRODUCTS_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(LOGS_FILE)) writeJSON(LOGS_FILE, []);

// ─── API Routes ────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  res.json(readJSON(PRODUCTS_FILE));
});

app.post('/api/products', (req, res) => {
  const newProduct = req.body;
  const products = readJSON(PRODUCTS_FILE);
  newProduct.id = 'p_' + Date.now();
  newProduct.inventory = parseInt(newProduct.inventory) || 0;
  newProduct.imageBase64List = newProduct.imageBase64List || [];
  products.push(newProduct);
  writeJSON(PRODUCTS_FILE, products);
  res.status(201).json(newProduct);
});

app.delete('/api/products/:id', (req, res) => {
  let products = readJSON(PRODUCTS_FILE);
  products = products.filter(p => p.id !== req.params.id);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.get('/api/orders', (req, res) => {
  res.json(readJSON(ORDERS_FILE));
});

app.post('/api/orders', (req, res) => {
  const orderData = req.body;
  const orders = readJSON(ORDERS_FILE);
  const newOrder = {
    id: 'FF-' + Date.now().toString().slice(-8),
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);
  writeJSON(ORDERS_FILE, orders);

  let products = readJSON(PRODUCTS_FILE);
  if (orderData.order_items && Array.isArray(orderData.order_items)) {
    orderData.order_items.forEach(item => {
      const prod = products.find(p => p.id === item.id);
      if (prod) {
        prod.inventory = Math.max(0, prod.inventory - item.qty);
      }
    });
    writeJSON(PRODUCTS_FILE, products);
  }
  res.status(201).json({ orderRef: newOrder.id });
});

app.patch('/api/orders/:id', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  orders[idx].status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  res.json(orders[idx]);
});

app.post('/api/track', (req, res) => {
  const { sessionId, action, productId, details } = req.body;
  const logs = readJSON(LOGS_FILE);
  logs.push({
    sessionId,
    action,
    productId,
    details,
    timestamp: new Date().toISOString()
  });
  if (logs.length > 300) logs.splice(0, logs.length - 300);
  writeJSON(LOGS_FILE, logs);
  res.sendStatus(200);
});

app.get('/api/logs', (req, res) => {
  const logs = readJSON(LOGS_FILE);
  res.json(logs.slice(-100));
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});