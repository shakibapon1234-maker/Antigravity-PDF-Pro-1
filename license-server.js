/**
 * Antigravity PDF Pro — Production Licensing Server
 * ────────────────────────────────────────────────
 * Handles software key generation, activation (device lock), 
 * validation, deactivation, and payment webhooks.
 *
 * Dependencies: npm install express sqlite3
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'AG-ADMIN-SUPER-SECRET-2026';

// Initialize SQLite database
const DB_FILE = path.join(__dirname, 'licenses.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_FILE);
  }
});

// Create licenses table schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'inactive', -- active, inactive, expired, banned
      device_id TEXT DEFAULT NULL,
      activated_at TEXT DEFAULT NULL,
      expires_at TEXT NOT NULL
    )
  `);
});

app.use(express.json());

// Enable CORS for frontend verification
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Helper: Generate a secure license key format AGP-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    parts.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `AGP-${parts.join('-')}`;
}

/**
 * ─── API ROUTE: GENERATE LICENSE (Admin Only / Webhook) ───────────────────
 * Generates a new license key and inserts it as 'inactive'.
 * Auth: Requires admin token header.
 */
app.post('/api/license/generate', (req, res) => {
  const adminToken = req.headers['authorization'];
  if (adminToken !== `Bearer ${ADMIN_SECRET_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized admin access.' });
  }

  const { email, duration_months } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Purchaser email is required.' });
  }

  const licenseKey = generateLicenseKey();
  const months = parseInt(duration_months) || 12; // Default 1 year expiry
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  db.run(
    `INSERT INTO licenses (license_key, email, expires_at) VALUES (?, ?, ?)`,
    [licenseKey, email, expiresAt.toISOString()],
    function(err) {
      if (err) {
        console.error('[license] Key generation error:', err.message);
        return res.status(500).json({ error: 'Failed to generate key.' });
      }
      res.json({
        success: true,
        license_key: licenseKey,
        email,
        expires_at: expiresAt.toISOString()
      });
    }
  );
});

/**
 * ─── API ROUTE: ACTIVATE LICENSE (Client App - Device Lock) ──────────────
 * Called when the client enters the key for the first time.
 * Binds the key to the current device hardware ID (device_id).
 */
app.post('/api/license/activate', (req, res) => {
  const { license_key, device_id } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ error: 'License key and Device ID are required.' });
  }

  db.get(`SELECT * FROM licenses WHERE license_key = ?`, [license_key.toUpperCase()], (err, license) => {
    if (err) {
      console.error('[license] Database query error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
    if (!license) {
      return res.status(404).json({ error: 'License key not found. Please verify your purchase.' });
    }

    // Check expiration
    if (new Date(license.expires_at) < new Date()) {
      return res.status(403).json({ error: 'This license key has expired.' });
    }

    // Check status
    if (license.status === 'banned') {
      return res.status(403).json({ error: 'This license key has been suspended.' });
    }

    // Device lock check
    if (license.status === 'active' && license.device_id && license.device_id !== device_id) {
      return res.status(403).json({ error: 'This license key is already in use on another computer.' });
    }

    const activatedAt = new Date().toISOString();
    db.run(
      `UPDATE licenses SET status = 'active', device_id = ?, activated_at = ? WHERE license_key = ?`,
      [device_id, activatedAt, license.license_key],
      function(err) {
        if (err) {
          console.error('[license] Activation update failed:', err.message);
          return res.status(500).json({ error: 'Failed to activate license.' });
        }
        res.json({
          success: true,
          message: 'Activation successful.',
          expires_at: license.expires_at,
          email: license.email
        });
      }
    );
  });
});

/**
 * ─── API ROUTE: VALIDATE LICENSE (Client App - Periodic Check) ────────────
 * Called periodically on app startup to confirm status.
 */
app.post('/api/license/validate', (req, res) => {
  const { license_key, device_id } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ error: 'License key and Device ID are required.' });
  }

  db.get(
    `SELECT * FROM licenses WHERE license_key = ? AND device_id = ?`,
    [license_key.toUpperCase(), device_id],
    (err, license) => {
      if (err) {
        console.error('[license] Database query error:', err.message);
        return res.status(500).json({ error: 'Internal server error.' });
      }
      if (!license) {
        return res.json({ valid: false, error: 'License key not matched to this machine.' });
      }

      const isExpired = new Date(license.expires_at) < new Date();
      if (isExpired || license.status !== 'active') {
        return res.json({
          valid: false,
          error: isExpired ? 'License key has expired.' : 'License key is suspended.'
        });
      }

      res.json({
        valid: true,
        expires_at: license.expires_at,
        email: license.email
      });
    }
  );
});

/**
 * ─── API ROUTE: DEACTIVATE LICENSE (Device Reset) ─────────────────────────
 * Allows users to free up their license key to move to a new computer.
 */
app.post('/api/license/deactivate', (req, res) => {
  const { license_key, device_id } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ error: 'License key and Device ID are required.' });
  }

  db.get(
    `SELECT * FROM licenses WHERE license_key = ? AND device_id = ?`,
    [license_key.toUpperCase(), device_id],
    (err, license) => {
      if (err) {
        console.error('[license] Database query error:', err.message);
        return res.status(500).json({ error: 'Internal server error.' });
      }
      if (!license) {
        return res.status(404).json({ error: 'License key not found or bound to a different machine.' });
      }

      db.run(
        `UPDATE licenses SET status = 'inactive', device_id = NULL, activated_at = NULL WHERE license_key = ?`,
        [license.license_key],
        function(err) {
          if (err) {
            console.error('[license] Deactivation update failed:', err.message);
            return res.status(500).json({ error: 'Failed to deactivate license.' });
          }
          res.json({
            success: true,
            message: 'License key successfully released and can now be activated on another computer.'
          });
        }
      );
    }
  );
});

/**
 * ─── STRIPE WEBHOOK ENDPOINT (Production Billing Hook) ─────────────────────
 * Receives payment notifications from Stripe and generates a key.
 */
app.post('/api/checkout/webhook/stripe', (req, res) => {
  const event = req.body;

  // Verify Stripe webhook signature in production:
  // const sig = req.headers['stripe-signature'];
  // Stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (email) {
      const licenseKey = generateLicenseKey();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 12); // Default 1 year

      db.run(
        `INSERT INTO licenses (license_key, email, expires_at) VALUES (?, ?, ?)`,
        [licenseKey, email, expiresAt.toISOString()],
        function(err) {
          if (err) {
            console.error('[webhook] Webhook key insert failed:', err.message);
            return res.status(500).end();
          }
          console.log(`[webhook] Swapped purchase to license key: ${licenseKey} for ${email}`);
          // SendEmailHelper.send(email, licenseKey); // Deliver to customer inbox
        }
      );
    }
  }

  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Licensing Server running on port ${PORT}`);
});
