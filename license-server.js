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
const https = require('https');

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * ⚠️  SECURITY: Change ADMIN_SECRET_TOKEN before deploying to production!
 *    Set it as an environment variable:  ADMIN_SECRET_TOKEN=your-secret-here
 *    Never commit the real token to GitHub.
 */
const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'AG-ADMIN-SUPER-SECRET-2026';

/**
 * ─── EMAIL DELIVERY via Resend.com ─────────────────────────────────────────
 * Sign up free at https://resend.com — 100 emails/day on free tier.
 * Set RESEND_API_KEY as environment variable on Railway.
 * Set FROM_EMAIL to your verified sender email on Resend.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@antigravitypdf.com';

/**
 * Sends the license key to the customer's email using Resend.com API.
 * @param {string} toEmail - Customer's email address
 * @param {string} licenseKey - The generated license key (e.g. AGP-XXXX-XXXX-XXXX)
 */
function sendLicenseEmail(toEmail, licenseKey) {
  if (!RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not set. Skipping email. License key for ${toEmail}: ${licenseKey}`);
    return;
  }

  const emailBody = {
    from: FROM_EMAIL,
    to: [toEmail],
    subject: 'Your Antigravity PDF Pro License Key',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e1b; color: #c8d0e8; padding: 40px; border-radius: 16px;">
        <h1 style="color: #b829f9; margin-bottom: 8px;">Antigravity PDF Pro</h1>
        <p style="color: #6a7090; margin-bottom: 32px;">Thank you for your purchase!</p>

        <p>Your lifetime license key is ready. Copy it below and paste it into the app's activation window:</p>

        <div style="background: #16162a; border: 2px solid #b829f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <code style="font-size: 1.4rem; color: #00d4ff; letter-spacing: 3px; font-weight: bold;">${licenseKey}</code>
        </div>

        <h3 style="color: #ffffff; margin-top: 32px;">How to activate:</h3>
        <ol style="line-height: 2;">
          <li>Download the app from <a href="https://github.com/shakibapon1234-maker/Antigravity-PDF-Pro-1/releases/latest" style="color: #b829f9;">GitHub Releases</a></li>
          <li>Install and open Antigravity PDF Pro</li>
          <li>Click <strong>"Activate License"</strong> and paste your key above</li>
          <li>Enjoy lifetime access! ✨</li>
        </ol>

        <p style="margin-top: 32px; font-size: 0.9rem; color: #6a7090;">
          Need help? Email us at <a href="mailto:support@antigravitypdf.com" style="color: #b829f9;">support@antigravitypdf.com</a>
        </p>
      </div>
    `
  };

  const postData = JSON.stringify(emailBody);
  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log(`[email] License key sent successfully to ${toEmail}`);
      } else {
        console.error(`[email] Failed to send email. Status: ${res.statusCode}. Response: ${data}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`[email] Email request error: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

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
      // Send license key to customer's email
      sendLicenseEmail(email, licenseKey);

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
          sendLicenseEmail(email, licenseKey); // Deliver key to customer inbox automatically
        }
      );
    }
  }

  res.json({ received: true });
});


/**
 * ─── API ROUTE: LIST ALL LICENSES (Admin Only) ────────────────────────────
 * Returns all license records for admin dashboard.
 */
app.get('/api/license/list', (req, res) => {
  const adminToken = req.headers['authorization'];
  if (adminToken !== `Bearer ${ADMIN_SECRET_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized admin access.' });
  }

  db.all(`SELECT id, license_key, email, status, device_id, activated_at, expires_at FROM licenses ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed.' });
    }
    res.json({ licenses: rows, total: rows.length });
  });
});

/**
 * ─── API ROUTE: BAN LICENSE (Admin Only) ──────────────────────────────────
 * Permanently bans a license key, preventing any future activation.
 */
app.post('/api/license/ban', (req, res) => {
  const adminToken = req.headers['authorization'];
  if (adminToken !== `Bearer ${ADMIN_SECRET_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized admin access.' });
  }

  const { license_key } = req.body;
  if (!license_key) {
    return res.status(400).json({ error: 'License key is required.' });
  }

  db.run(
    `UPDATE licenses SET status = 'banned', device_id = NULL WHERE license_key = ?`,
    [license_key.toUpperCase()],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to ban license.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'License key not found.' });
      }
      res.json({ success: true, message: `License key ${license_key} has been banned.` });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Licensing Server running on port ${PORT}`);
});
