const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'database.json');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_insecure_jwt_secret_key_safe_scanner';
const NODE_ENV = process.env.NODE_ENV || 'development';

// 1. HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "http://localhost:5000", "https://safe-scanner-api.onrender.com"]
    }
  }
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed domains
    const isAllowed = origin.startsWith('http://localhost') || 
                      origin.endsWith('.vercel.app') || 
                      origin.endsWith('.onrender.com');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to allow any origin to ensure presentation reliability
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. Global API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' }
});
app.use('/api/', apiLimiter);

// 3. Login Rate Limiting (Prevent Brute Force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 failed requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  loginAttempts: { type: Number, required: true, default: 0 },
  lockoutUntil: { type: Date, default: null }
});
const User = mongoose.model('User', UserSchema);

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String },
  ipAddress: { type: String }
});
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

const BlacklistSchema = new mongoose.Schema({
  upiId: { type: String, required: true, unique: true, lowercase: true }
});
const Blacklist = mongoose.model('Blacklist', BlacklistSchema);

const MerchantSchema = new mongoose.Schema({
  upiId: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  registeredDays: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  trustScore: { type: Number, default: 50 },
  category: { type: String, default: 'General' },
  location: {
    lat: Number,
    lng: Number,
    name: String
  }
});
const Merchant = mongoose.model('Merchant', MerchantSchema);

const ReportSchema = new mongoose.Schema({
  upiId: { type: String, required: true, lowercase: true },
  merchantName: String,
  reason: { type: String, required: true },
  reportedBy: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);

const ScanSchema = new mongoose.Schema({
  upiId: { type: String, required: true, lowercase: true },
  merchantName: String,
  amount: Number,
  note: String,
  riskScore: Number,
  riskLevel: String,
  timestamp: { type: Date, default: Date.now },
  location: {
    lat: Number,
    lng: Number,
    name: String
  },
  tamperingDetected: { type: Boolean, default: false },
  voiceMessage: String
});
const Scan = mongoose.model('Scan', ScanSchema);

let useMongo = false;
let MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  MONGO_URI = MONGO_URI.replace(/^['"]|['"]$/g, '').trim();
}

// Read JSON database file
function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    return {
      users: parsed.users || [],
      auditLogs: parsed.auditLogs || [],
      blacklist: parsed.blacklist || [],
      merchants: parsed.merchants || [],
      reports: parsed.reports || [],
      scans: parsed.scans || []
    };
  } catch (error) {
    console.error('Error reading database file, returning fresh structure.');
    return { users: [], auditLogs: [], blacklist: [], merchants: [], reports: [], scans: [] };
  }
}

// Write JSON database file
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// Log security events
async function logSecurityEvent(action, performedBy, details, req) {
  const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'System';
  const logEntry = {
    action,
    performedBy,
    timestamp: new Date().toISOString(),
    details,
    ipAddress
  };

  console.log(`[SECURITY AUDIT] ${action} by ${performedBy} - Details: ${details} [IP: ${ipAddress}]`);

  if (useMongo) {
    try {
      await new AuditLog(logEntry).save();
    } catch (err) {
      console.error('Failed to save audit log to MongoDB:', err);
    }
  } else {
    const db = readDb();
    db.auditLogs.unshift({ id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ...logEntry });
    writeDb(db);
  }
}

// Seed admin and mock values
async function seedDatabase() {
  const defaultAdminUsername = 'admin';
  const defaultAdminPass = 'Admin@1234';
  const hashedPass = await bcrypt.hash(defaultAdminPass, 10);

  if (useMongo) {
    try {
      const adminExists = await User.findOne({ username: defaultAdminUsername });
      if (!adminExists) {
        await new User({
          username: defaultAdminUsername,
          passwordHash: hashedPass,
          role: 'admin'
        }).save();
        console.log('Seeded administrator account in MongoDB (admin / Admin@1234)');
      }
    } catch (err) {
      console.error('Failed to seed MongoDB user:', err);
    }
  } else {
    const db = readDb();
    const adminExists = db.users.find(u => u.username === defaultAdminUsername);
    if (!adminExists) {
      db.users.push({
        id: 'u_' + Date.now(),
        username: defaultAdminUsername,
        passwordHash: hashedPass,
        role: 'admin',
        loginAttempts: 0,
        lockoutUntil: null
      });
      writeDb(db);
      console.log('Seeded administrator account in database.json (admin / Admin@1234)');
    }
  }
}

// Connect to MongoDB Atlas if MONGO_URI is set
if (MONGO_URI) {
  console.log('Attempting to connect to MongoDB Atlas...');
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('MongoDB Atlas connected successfully.');
      useMongo = true;
      seedDatabase();
    })
    .catch((err) => {
      console.error('MongoDB Atlas connection error:', err.message);
      console.log('Using local JSON database fallback.');
      useMongo = false;
      seedDatabase();
    });
} else {
  console.log('No MONGO_URI provided in environment. Using local JSON database.');
  useMongo = false;
  seedDatabase();
}

// Authentication Middlewares
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    req.user = decodedUser;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    logSecurityEvent('Unauthorized Admin Attempt', req.user ? req.user.username : 'Anonymous', `Access denied to route: ${req.originalUrl}`, req);
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

// Input Sanitization helper
function cleanInputString(input) {
  if (!input || typeof input !== 'string') return '';
  // Strip common HTML/script injection tags
  return input
    .replace(/<[^>]*>/g, '') 
    .replace(/[&|;$%@"<>()+]/g, '')
    .trim();
}

// Geolocation distance using Haversine formula (in km)
function getHaversineDistance(coords1, coords2) {
  if (!coords1 || !coords2 || isNaN(coords1.lat) || isNaN(coords1.lng) || isNaN(coords2.lat) || isNaN(coords2.lng)) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(coords2.lat - coords1.lat);
  const dLng = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// AI/ML Inference - Javascript Fallback Risk Model
function runJsRiskModel(features) {
  let score = 100;
  const reasons = [];

  if (features.isBlacklisted) {
    score = Math.floor(Math.random() * 5); // 0-4%
    reasons.push('UPI ID matches known fraud database.');
    return { score, level: 'high', reasons };
  }

  if (features.tamperingDetected) {
    score -= 40;
    reasons.push('Suspicious QR pattern / overlay detected.');
  }

  if (features.merchantFound) {
    const trustBonus = Math.floor(features.merchantTrustScore / 4); // max +25
    score = 65 + trustBonus;
    if (features.isVerifiedMerchant) {
      score += 10;
    }
  } else {
    score -= 30;
    reasons.push('Unverified UPI merchant. ID is not registered in central merchant database.');
  }

  if (features.merchantDaysActive < 7) {
    score -= 20;
    reasons.push('Merchant account is extremely new (created less than a week ago).');
  } else if (features.merchantDaysActive < 30) {
    score -= 10;
    reasons.push('Merchant account is relatively new (created less than 30 days ago).');
  }

  const suspiciousKeywords = ['prize', 'lottery', 'winner', 'gift', 'free', 'double', 'refund', 'agent', 'helper'];
  const upiLower = features.upiId.toLowerCase();
  const foundKeywords = suspiciousKeywords.filter((word) => upiLower.includes(word));
  if (foundKeywords.length > 0) {
    score -= 25;
    reasons.push(`UPI ID contains high-risk search term(s): ${foundKeywords.join(', ')}.`);
  }

  if (features.reportedCount > 0) {
    score -= Math.min(features.reportedCount * 15, 40);
    reasons.push(`This merchant has been flagged ${features.reportedCount} time(s) by the community.`);
  }

  if (features.distanceKm > 15) {
    score -= 20;
    reasons.push(`GPS Mismatch: Merchant location (${features.merchantLocationName || 'Unknown'}) is ${Math.round(features.distanceKm)}km away from scan location.`);
  }

  score = Math.max(0, Math.min(100, score));
  let level = 'safe';
  if (score < 50) {
    level = 'high';
  } else if (score < 80) {
    level = 'medium';
  }

  return { score, level, reasons };
}

// Call Python Machine Learning Script safely via execFile (immunized against shell injection)
function runPythonMlModel(features) {
  return new Promise((resolve, reject) => {
    const nameSim = features.upiId.toLowerCase().includes('prize') || features.upiId.toLowerCase().includes('lottery') ? 1 : 0;
    const isBlacklistedVal = features.isBlacklisted ? 1 : 0;
    const isVerifiedVal = features.isVerifiedMerchant ? 1 : 0;
    const isTamperedVal = features.tamperingDetected ? 1 : 0;

    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, '../ml/predict.py');
    const args = [
      scriptPath,
      String(Number(features.amount) || 0),
      String(Number(features.merchantDaysActive) || 0),
      String(Number(features.distanceKm) || 0),
      String(Number(features.reportedCount) || 0),
      String(isVerifiedVal),
      String(nameSim),
      String(isBlacklistedVal),
      String(isTamperedVal)
    ];

    execFile(pythonPath, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse ML output: ${stdout}`));
      }
    });
  });
}

// ================= USER REGISTER & LOGIN ROUTES =================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = cleanInputString(username).toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    if (useMongo) {
      const exists = await User.findOne({ username: cleanUsername });
      if (exists) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
      await new User({ username: cleanUsername, passwordHash: hashed, role: 'user' }).save();
    } else {
      const db = readDb();
      const exists = db.users.find(u => u.username === cleanUsername);
      if (exists) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
      db.users.push({
        id: 'u_' + Date.now(),
        username: cleanUsername,
        passwordHash: hashed,
        role: 'user',
        loginAttempts: 0,
        lockoutUntil: null
      });
      writeDb(db);
    }

    logSecurityEvent('User Registration', cleanUsername, 'Registered new user account successfully.', req);
    res.json({ success: true, message: 'Account registered successfully. You can now sign in.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error occurred.' });
  }
});

// Authentication Login Endpoint (Users and Admins)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = cleanInputString(username).toLowerCase();
    let user = null;

    if (useMongo) {
      user = await User.findOne({ username: cleanUsername });
    } else {
      const db = readDb();
      user = db.users.find(u => u.username === cleanUsername);
    }

    if (!user) {
      logSecurityEvent('Failed Login Attempt', cleanUsername, 'Non-existent username submitted.', req);
      return res.status(401).json({ error: 'Invalid username or password credentials.' });
    }

    // Check Account Lockout status
    const now = new Date();
    if (user.lockoutUntil && new Date(user.lockoutUntil) > now) {
      const minutesLeft = Math.ceil((new Date(user.lockoutUntil) - now) / 60000);
      logSecurityEvent('Account Locked Out Block', cleanUsername, `Blocked access attempt. Account locked for ${minutesLeft} mins.`, req);
      return res.status(403).json({ error: `Account locked due to consecutive failures. Try again in ${minutesLeft} minute(s).` });
    }

    // Compare Hashed Password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      // Increment login failures
      const attempts = (user.loginAttempts || 0) + 1;
      let lockoutUntil = null;
      let msg = 'Invalid username or password credentials.';

      if (attempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
        msg = 'Too many failed attempts. Account has been locked for 15 minutes.';
        logSecurityEvent('Account Lockout Triggered', cleanUsername, '5 failed consecutive logins. Locking account.', req);
      } else {
        logSecurityEvent('Failed Login Attempt', cleanUsername, `Incorrect password. Fail count: ${attempts}`, req);
      }

      if (useMongo) {
        await User.updateOne({ _id: user._id }, { $set: { loginAttempts: attempts, lockoutUntil } });
      } else {
        const db = readDb();
        const uIndex = db.users.findIndex(u => u.username === cleanUsername);
        if (uIndex !== -1) {
          db.users[uIndex].loginAttempts = attempts;
          db.users[uIndex].lockoutUntil = lockoutUntil;
          writeDb(db);
        }
      }

      return res.status(401).json({ error: msg });
    }

    // Reset lockout counters on success
    if (useMongo) {
      await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0, lockoutUntil: null } });
    } else {
      const db = readDb();
      const uIndex = db.users.findIndex(u => u.username === cleanUsername);
      if (uIndex !== -1) {
        db.users[uIndex].loginAttempts = 0;
        db.users[uIndex].lockoutUntil = null;
        writeDb(db);
      }
    }

    // Sign jwt token
    const tokenPayload = { id: user._id || user.id, username: user.username, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    logSecurityEvent('Successful Login', cleanUsername, `User logged in successfully with role: ${user.role}`, req);

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login route error:', err);
    res.status(500).json({ error: 'Internal server error occurred.' });
  }
});

// Get currently authenticated user status
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ================= PUBLIC / SECURED BUSINESS API ROUTES =================

// Health Status Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    message: 'Safe Scanner API online.',
    database: useMongo ? 'MongoDB Atlas' : 'Flat JSON File',
    timestamp: new Date()
  });
});

// Verify QR (Open to authenticated users)
app.post('/api/verify-qr', authenticateToken, async (req, res) => {
  try {
    const { qrString, userLocation, tamperingDetected } = req.body;
    if (!qrString) {
      return res.status(400).json({ error: 'QR string parameter is required.' });
    }

    // Strict input sanitization to prevent processing anomalies
    const cleanQr = cleanInputString(qrString);
    if (!cleanQr) {
      return res.status(400).json({ error: 'Malicious payload or invalid character set detected.' });
    }

    // Parse UPI parameters safely
    let upiId = '';
    let merchantName = 'Unknown Merchant';
    let amount = 0;
    let note = '';

    try {
      if (cleanQr.startsWith('upi://pay')) {
        const urlParams = new URLSearchParams(cleanQr.split('?')[1]);
        upiId = urlParams.get('pa') || '';
        merchantName = urlParams.get('pn') ? decodeURIComponent(urlParams.get('pn')) : 'Unknown Merchant';
        amount = parseFloat(urlParams.get('am')) || 0;
        note = urlParams.get('tn') ? decodeURIComponent(urlParams.get('tn')) : '';
      } else {
        upiId = cleanQr.includes('@') ? cleanQr.trim() : '';
        merchantName = 'Direct Scanned ID';
      }
    } catch (err) {
      upiId = cleanQr;
    }

    // Clean outputs
    upiId = cleanInputString(upiId).toLowerCase();
    merchantName = cleanInputString(merchantName);
    note = cleanInputString(note);

    if (!upiId) {
      return res.json({
        success: false,
        error: 'Not a valid UPI payment QR code format. Scan aborted.'
      });
    }

    let isBlacklisted = false;
    let merchant = null;
    let reportedCount = 0;

    if (useMongo) {
      isBlacklisted = await Blacklist.findOne({ upiId }) !== null;
      merchant = await Merchant.findOne({ upiId });
      reportedCount = await Report.countDocuments({ upiId, status: 'approved' });
    } else {
      const db = readDb();
      isBlacklisted = db.blacklist.includes(upiId);
      merchant = db.merchants.find((m) => m.upiId.toLowerCase() === upiId);
      reportedCount = db.reports.filter((r) => r.upiId.toLowerCase() === upiId && r.status === 'approved').length;
    }

    let merchantDaysActive = merchant ? merchant.registeredDays : 0;
    let isVerifiedMerchant = merchant ? merchant.isVerified : false;
    let merchantTrustScore = merchant ? merchant.trustScore : 50;
    let merchantLocation = merchant ? merchant.location : null;

    let distanceKm = 0;
    if (userLocation && merchantLocation) {
      distanceKm = getHaversineDistance(userLocation, merchantLocation);
    }

    const features = {
      upiId,
      merchantName: merchant ? merchant.name : merchantName,
      amount,
      isBlacklisted,
      merchantFound: !!merchant,
      merchantTrustScore,
      isVerifiedMerchant,
      merchantDaysActive,
      reportedCount,
      distanceKm,
      merchantLocationName: merchantLocation ? merchantLocation.name : null,
      tamperingDetected: !!tamperingDetected
    };

    let resultRisk;
    let usedMlEngine = 'Rule-based Native (JS)';

    try {
      const mlPred = await runPythonMlModel(features);
      usedMlEngine = 'Random Forest Classifier (Python)';
      
      let level = 'safe';
      if (mlPred.fraud_probability > 0.5) {
        level = 'high';
      } else if (mlPred.fraud_probability > 0.2) {
        level = 'medium';
      }
      
      const rulesResult = runJsRiskModel(features);
      resultRisk = {
        score: Math.round((1 - mlPred.fraud_probability) * 100),
        level: level,
        reasons: rulesResult.reasons
      };
    } catch (mlErr) {
      resultRisk = runJsRiskModel(features);
    }

    let voiceMessage = 'Safe to proceed.';
    if (resultRisk.level === 'high') {
      if (isBlacklisted) {
        voiceMessage = 'Warning! This UPI QR is blacklisted for fraud.';
      } else if (features.tamperingDetected) {
        voiceMessage = 'Warning! Scanner has detected layout tampering or overlay sticker.';
      } else {
        voiceMessage = 'This QR code appears suspicious. Proceed with caution.';
      }
    } else if (resultRisk.level === 'medium') {
      voiceMessage = 'Warning! Unverified merchant. Please verify identity.';
    }

    const newScan = {
      upiId,
      merchantName: features.merchantName,
      amount,
      note,
      riskScore: resultRisk.score,
      riskLevel: resultRisk.level,
      timestamp: new Date().toISOString(),
      location: userLocation || { name: 'Unknown' },
      tamperingDetected: features.tamperingDetected,
      voiceMessage
    };

    if (useMongo) {
      await new Scan(newScan).save();
    } else {
      const db = readDb();
      db.scans.unshift({ id: 'scan_' + Date.now(), ...newScan });
      writeDb(db);
    }

    res.json({
      success: true,
      scan: newScan,
      reasons: resultRisk.reasons,
      engine: usedMlEngine,
      merchant: merchant ? {
        name: merchant.name,
        registeredDays: merchant.registeredDays,
        isVerified: merchant.isVerified,
        trustScore: merchant.trustScore,
        category: merchant.category,
        locationName: merchantLocation ? merchantLocation.name : 'Not available'
      } : null
    });
  } catch (err) {
    console.error('Scan verification error:', err);
    res.status(500).json({ error: 'Internal verification check failed.' });
  }
});

// Fetch Scan History (Open to verified users)
app.get('/api/scans', authenticateToken, async (req, res) => {
  try {
    if (useMongo) {
      const scans = await Scan.find().sort({ timestamp: -1 });
      res.json(scans);
    } else {
      const db = readDb();
      res.json(db.scans);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction logs.' });
  }
});

// Report Fraud (Open to verified users)
app.post('/api/report', authenticateToken, async (req, res) => {
  try {
    const { upiId, merchantName, reason, reporterLocation } = req.body;
    if (!upiId || !reason) {
      return res.status(400).json({ error: 'UPI ID and description are required.' });
    }

    const cleanUpi = cleanInputString(upiId).toLowerCase();
    const cleanName = cleanInputString(merchantName) || 'Unknown UPI Merchant';
    const cleanReason = cleanInputString(reason);

    const newReport = {
      upiId: cleanUpi,
      merchantName: cleanName,
      reason: cleanReason,
      reportedBy: req.user.username,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (useMongo) {
      await new Report(newReport).save();
    } else {
      const db = readDb();
      db.reports.unshift({ id: 'rep_' + Date.now(), ...newReport });
      writeDb(db);
    }

    logSecurityEvent('Submit Fraud Report', req.user.username, `Flagged merchant UPI: ${cleanUpi}`, req);
    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ error: 'Submission request error.' });
  }
});

// ================= ADMINISTRATOR CONTROLLER API ROUTES (SECURED) =================

// View Reports
app.get('/api/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (useMongo) {
      const reports = await Report.find().sort({ createdAt: -1 });
      res.json(reports);
    } else {
      const db = readDb();
      res.json(db.reports);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

// Review Report Actions (Approve / Reject)
app.post('/api/reports/review', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.body;
    if (!id || !action) {
      return res.status(400).json({ error: 'Report ID and evaluation action are required.' });
    }

    logSecurityEvent('Review Report Action', req.user.username, `Report ID: ${id} - Action: ${action}`, req);

    if (useMongo) {
      let query = mongoose.isValidObjectId(id) ? { _id: id } : { id: id };
      const report = await Report.findOne(query);

      if (!report) {
        return res.status(404).json({ error: 'Report entry not found.' });
      }

      report.status = action === 'approve' ? 'approved' : 'rejected';
      await report.save();

      if (action === 'approve') {
        await Blacklist.findOneAndUpdate(
          { upiId: report.upiId.toLowerCase() },
          { upiId: report.upiId.toLowerCase() },
          { upsert: true }
        );
      }
      res.json({ success: true, report });
    } else {
      const db = readDb();
      const reportIndex = db.reports.findIndex((r) => r.id === id);

      if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report entry not found.' });
      }

      const report = db.reports[reportIndex];
      if (action === 'approve') {
        report.status = 'approved';
        if (!db.blacklist.includes(report.upiId.toLowerCase())) {
          db.blacklist.push(report.upiId.toLowerCase());
        }
      } else {
        report.status = 'rejected';
      }

      writeDb(db);
      res.json({ success: true, report });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to evaluate report.' });
  }
});

// Get Blacklist
app.get('/api/blacklist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (useMongo) {
      const list = await Blacklist.find();
      res.json(list.map((item) => item.upiId));
    } else {
      const db = readDb();
      res.json(db.blacklist);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve blacklist data.' });
  }
});

// Add Blacklist
app.post('/api/blacklist/add', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId) return res.status(400).json({ error: 'UPI ID is required.' });

    const cleanId = cleanInputString(upiId).toLowerCase();

    logSecurityEvent('Add Blacklist Record', req.user.username, `Added UPI: ${cleanId}`, req);

    if (useMongo) {
      await Blacklist.findOneAndUpdate(
        { upiId: cleanId },
        { upiId: cleanId },
        { upsert: true }
      );
      const list = await Blacklist.find();
      res.json({ success: true, blacklist: list.map(b => b.upiId) });
    } else {
      const db = readDb();
      if (!db.blacklist.includes(cleanId)) {
        db.blacklist.push(cleanId);
        writeDb(db);
      }
      res.json({ success: true, blacklist: db.blacklist });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error modifying blacklist.' });
  }
});

// Remove Blacklist
app.post('/api/blacklist/remove', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId) return res.status(400).json({ error: 'UPI ID parameter is required.' });

    const cleanId = cleanInputString(upiId).toLowerCase();

    logSecurityEvent('Remove Blacklist Record', req.user.username, `Deleted UPI: ${cleanId}`, req);

    if (useMongo) {
      await Blacklist.deleteOne({ upiId: cleanId });
      const list = await Blacklist.find();
      res.json({ success: true, blacklist: list.map(b => b.upiId) });
    } else {
      const db = readDb();
      db.blacklist = db.blacklist.filter((id) => id !== cleanId);
      writeDb(db);
      res.json({ success: true, blacklist: db.blacklist });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error modifying blacklist.' });
  }
});

// Get Merchants
app.get('/api/merchants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (useMongo) {
      const merchants = await Merchant.find();
      res.json(merchants);
    } else {
      const db = readDb();
      res.json(db.merchants);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve merchant ledger.' });
  }
});

// Manage Merchant Status
app.post('/api/merchants/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { upiId, isVerified, trustScore, name, category } = req.body;
    if (!upiId) return res.status(400).json({ error: 'UPI ID parameter is required.' });

    const cleanId = cleanInputString(upiId).toLowerCase();
    const cleanName = cleanInputString(name);
    const cleanCat = cleanInputString(category);

    logSecurityEvent('Update Merchant Record', req.user.username, `Updated UPI: ${cleanId} - Verified: ${isVerified} - Score: ${trustScore}`, req);

    if (useMongo) {
      const updateFields = {};
      if (isVerified !== undefined) updateFields.isVerified = isVerified;
      if (trustScore !== undefined) updateFields.trustScore = Math.min(100, Math.max(0, trustScore));
      if (cleanName) updateFields.name = cleanName;
      if (cleanCat) updateFields.category = cleanCat;
      
      const merchant = await Merchant.findOneAndUpdate(
        { upiId: cleanId },
        { 
          $set: updateFields,
          $setOnInsert: { 
            registeredDays: 1,
            location: { lat: 28.6139, lng: 77.2090, name: 'New Delhi, DL' }
          }
        },
        { upsert: true, new: true }
      );
      res.json({ success: true, merchant });
    } else {
      const db = readDb();
      let merchant = db.merchants.find((m) => m.upiId.toLowerCase() === cleanId);

      if (merchant) {
        if (isVerified !== undefined) merchant.isVerified = isVerified;
        if (trustScore !== undefined) merchant.trustScore = Math.min(100, Math.max(0, trustScore));
        if (cleanName) merchant.name = cleanName;
        if (cleanCat) merchant.category = cleanCat;
      } else {
        merchant = {
          upiId: cleanId,
          name: cleanName || 'New Merchant',
          registeredDays: 1,
          isVerified: !!isVerified,
          trustScore: trustScore !== undefined ? trustScore : 70,
          category: cleanCat || 'General',
          location: { lat: 28.6139, lng: 77.2090, name: 'New Delhi, DL' }
        };
        db.merchants.push(merchant);
      }

      writeDb(db);
      res.json({ success: true, merchant });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update merchant ledger.' });
  }
});

// Get Audit Logs (Admin only)
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (useMongo) {
      const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
      res.json(logs);
    } else {
      const db = readDb();
      res.json(db.auditLogs.slice(0, 100));
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve security audit logs.' });
  }
});

// Security AI chatbot
app.post('/api/chat', authenticateToken, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const cleanMessage = cleanInputString(message);
  const q = cleanMessage.toLowerCase();
  let reply = '';

  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    reply = "Hello! I am your AI Chat Security Assistant. Ask me anything about UPI scams, how to scan safely, or how to report fraudulent QR codes.";
  } else if (q.includes('qr overlay') || q.includes('sticker') || q.includes('tampering')) {
    reply = "A **QR Overlay Scam** occurs when a fraudster sticks a duplicate, malicious QR code sticker on top of a genuine merchant's QR standee. Safe Scanner checks the edges and alignment of the scanned image for signs of physical overlay stickers to alert you before payment.";
  } else if (q.includes('how to report') || q.includes('report scam')) {
    reply = "You can report a scam QR code by using our **Community Fraud Reporting** feature. Open the 'Report Fraud' page in the app, fill in the merchant's UPI ID, describe the fraud, and submit. Our administrators will review the report and add verified scams to our global blacklist database.";
  } else if (q.includes('safe score') || q.includes('risk score') || q.includes('color')) {
    reply = "Our Safe Score utilizes machine learning to gauge risk: \n🟢 **Safe (80-100%)**: Genuine registered merchant.\n🟡 **Medium Risk (50-79%)**: Newly created merchant ID or missing verification details.\n🔴 **High Risk (0-49%)**: Verified overlay, reported blacklist, or major coordinate mismatch.";
  } else if (q.includes('refund') || q.includes('customer care')) {
    reply = "Be cautious! Fraudsters often list fake customer service numbers on Google. They send you refund links or QR codes claiming it will 'credit' money to your account. Remember, scanning a QR code is *only* to send money, not to receive refunds. Never scan a QR code to receive money!";
  } else if (q.includes('how does ml') || q.includes('machine learning') || q.includes('model') || q.includes('algorithm')) {
    reply = "We use a **Random Forest Classifier** trained on transaction parameters like account age, location deviation, user report histories, and naming patterns. The ML model predicts fraud probability dynamically, alerting you in milliseconds.";
  } else {
    reply = "That's an important question. To stay safe on UPI: \n1. Double-check the recipient's name in your payment app before entering your UPI PIN.\n2. Never scan a QR code to receive a lottery, cashback, or refund.\n3. Keep your Safe Scanner app active when buying from local merchants.";
  }

  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
