import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import sqlite3pkg from 'sqlite3';
const sqlite3 = sqlite3pkg.verbose();

dotenv.config();

const app = express();
app.set('trust proxy', true);

// ----- Config -----
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const ADMIN_KEY = process.env.ADMIN_KEY || null;
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'data', 'surveys.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// ----- Middleware -----
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGIN === '*' ) return cb(null, true);
    const allowed = CORS_ORIGIN.split(',').map(s => s.trim());
    return cb(null, allowed.includes(origin));
  }
}));
app.use(morgan('tiny'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // 120 req/min per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
app.use(limiter);

// ----- DB -----
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    storeName TEXT,
    businessType TEXT,
    monthlyRevenue INTEGER,
    foodCost INTEGER,
    laborCost INTEGER,
    rentCost INTEGER,
    dailyCustomers INTEGER,
    seats INTEGER,
    onlineRevenue INTEGER,
    marketingCost INTEGER,
    repeatPurchases INTEGER,
    totalCustomers INTEGER,
    utilityCost INTEGER,
    averageRating REAL,
    badReviews INTEGER,
    totalReviews INTEGER,
    socialMediaMentions INTEGER,
    serviceBadReviewRate REAL,
    tasteBadReviewRate REAL,
    userAgent TEXT,
    ip TEXT
  )`);
});

// Helper: auth for admin-only routes
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(501).json({ error: 'ADMIN_KEY not set on server' });
  const key = req.get('x-admin-key');
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Helper: sanitize/normalize input (keep it minimal)
function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function toFloatOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toTextOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// ----- Routes -----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/saveSurvey', (req, res) => {
  const b = req.body || {};
  // Minimal validation (front-end already validates required fields)
  const data = {
    timestamp: new Date().toISOString(),
    storeName: toTextOrNull(b.storeName),
    businessType: toTextOrNull(b.businessType),
    monthlyRevenue: toIntOrNull(b.monthlyRevenue),
    foodCost: toIntOrNull(b.foodCost),
    laborCost: toIntOrNull(b.laborCost),
    rentCost: toIntOrNull(b.rentCost),
    dailyCustomers: toIntOrNull(b.dailyCustomers),
    seats: toIntOrNull(b.seats),
    onlineRevenue: toIntOrNull(b.onlineRevenue),
    marketingCost: toIntOrNull(b.marketingCost),
    repeatPurchases: toIntOrNull(b.repeatPurchases),
    totalCustomers: toIntOrNull(b.totalCustomers),
    utilityCost: toIntOrNull(b.utilityCost),
    averageRating: toFloatOrNull(b.averageRating),
    badReviews: toIntOrNull(b.badReviews),
    totalReviews: toIntOrNull(b.totalReviews),
    socialMediaMentions: toIntOrNull(b.socialMediaMentions),
    serviceBadReviewRate: toFloatOrNull(b.serviceBadReviewRate),
    tasteBadReviewRate: toFloatOrNull(b.tasteBadReviewRate),
    userAgent: req.get('user-agent') || null,
    ip: (req.ip || '').toString()
  };

  const sql = `INSERT INTO surveys (
    timestamp, storeName, businessType, monthlyRevenue, foodCost, laborCost, rentCost,
    dailyCustomers, seats, onlineRevenue, marketingCost, repeatPurchases, totalCustomers,
    utilityCost, averageRating, badReviews, totalReviews, socialMediaMentions,
    serviceBadReviewRate, tasteBadReviewRate, userAgent, ip
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  const params = [
    data.timestamp, data.storeName, data.businessType, data.monthlyRevenue, data.foodCost,
    data.laborCost, data.rentCost, data.dailyCustomers, data.seats, data.onlineRevenue,
    data.marketingCost, data.repeatPurchases, data.totalCustomers, data.utilityCost,
    data.averageRating, data.badReviews, data.totalReviews, data.socialMediaMentions,
    data.serviceBadReviewRate, data.tasteBadReviewRate, data.userAgent, data.ip
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error('DB insert error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json({ ok: true, id: this.lastID });
  });
});

// Admin: list (paginated)
app.get('/api/surveys', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  db.all(`SELECT * FROM surveys ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ rows, limit, offset });
  });
});

// Admin: export CSV
app.get('/api/export', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM surveys ORDER BY id ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const header = [
      'id','timestamp','storeName','businessType','monthlyRevenue','foodCost','laborCost','rentCost',
      'dailyCustomers','seats','onlineRevenue','marketingCost','repeatPurchases','totalCustomers',
      'utilityCost','averageRating','badReviews','totalReviews','socialMediaMentions',
      'serviceBadReviewRate','tasteBadReviewRate','userAgent','ip'
    ];
    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(header.map(h => esc(r[h])).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="surveys.csv"');
    res.send(csv);
  });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}. DB file: ${DB_FILE}`);
});
