const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// MongoDB Schemas
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
  createdAt: { type: Date, default: Date.now },
  evidenceImage: String
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
const MONGO_URI = process.env.MONGO_URI;

// Helper function to read from DB (JSON Fallback)
function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { blacklist: [], merchants: [], reports: [], scans: [] };
  }
}

// Helper function to write to DB (JSON Fallback)
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// Automatic Seeder for MongoDB Atlas on first connect
async function seedMongoDatabase() {
  try {
    const blacklistCount = await Blacklist.countDocuments();
    const merchantCount = await Merchant.countDocuments();
    const reportCount = await Report.countDocuments();
    const scanCount = await Scan.countDocuments();

    // If MongoDB is entirely empty, seed from database.json
    if (blacklistCount === 0 && merchantCount === 0 && reportCount === 0 && scanCount === 0) {
      console.log('MongoDB Atlas is empty. Seeding database with initial assets...');
      const localDb = readDb();

      if (localDb.blacklist && localDb.blacklist.length > 0) {
        await Blacklist.insertMany(localDb.blacklist.map(upi => ({ upiId: upi })));
      }
      if (localDb.merchants && localDb.merchants.length > 0) {
        await Merchant.insertMany(localDb.merchants);
      }
      if (localDb.reports && localDb.reports.length > 0) {
        await Report.insertMany(localDb.reports);
      }
      if (localDb.scans && localDb.scans.length > 0) {
        await Scan.insertMany(localDb.scans);
      }
      console.log('MongoDB Atlas successfully seeded!');
    }
  } catch (err) {
    console.error('Error seeding MongoDB Atlas:', err);
  }
}

// Connect to MongoDB Atlas if MONGO_URI is set
if (MONGO_URI) {
  console.log('Attempting to connect to MongoDB Atlas...');
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('MongoDB Atlas connected successfully.');
      useMongo = true;
      seedMongoDatabase();
    })
    .catch((err) => {
      console.error('MongoDB Atlas connection error:', err.message);
      console.log('Using local JSON database fallback.');
      useMongo = false;
    });
} else {
  console.log('No MONGO_URI provided in environment. Using local JSON database.');
}

// Calculate distance using Haversine formula (in km)
function getHaversineDistance(coords1, coords2) {
  if (!coords1 || !coords2) return 0;
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

  // 1. Blacklist check
  if (features.isBlacklisted) {
    score = Math.floor(Math.random() * 5); // 0-4%
    reasons.push('UPI ID matches known fraud database.');
    return { score, level: 'high', reasons };
  }

  // 2. Tampering check
  if (features.tamperingDetected) {
    score -= 40;
    reasons.push('Suspicious QR pattern / overlay detected.');
  }

  // 3. Merchant details check
  if (features.merchantFound) {
    const trustBonus = Math.floor(features.merchantTrustScore / 4); // max +25
    score = 65 + trustBonus;
    if (features.isVerifiedMerchant) {
      score += 10;
    }
  } else {
    // Unverified/New Merchant
    score -= 30;
    reasons.push('Unverified UPI merchant. ID is not registered in central merchant database.');
  }

  // 4. Registration Days Check
  if (features.merchantDaysActive < 7) {
    score -= 20;
    reasons.push('Merchant account is extremely new (created less than a week ago).');
  } else if (features.merchantDaysActive < 30) {
    score -= 10;
    reasons.push('Merchant account is relatively new (created less than 30 days ago).');
  }

  // 5. Name Similarity / suspicious terms
  const suspiciousKeywords = ['prize', 'lottery', 'winner', 'gift', 'free', 'double', 'refund', 'agent', 'helper'];
  const upiLower = features.upiId.toLowerCase();
  const foundKeywords = suspiciousKeywords.filter((word) => upiLower.includes(word));
  if (foundKeywords.length > 0) {
    score -= 25;
    reasons.push(`UPI ID contains high-risk search term(s): ${foundKeywords.join(', ')}.`);
  }

  // 6. User-Reported count
  if (features.reportedCount > 0) {
    score -= Math.min(features.reportedCount * 15, 40);
    reasons.push(`This merchant has been flagged ${features.reportedCount} time(s) by the community.`);
  }

  // 7. Location deviation
  if (features.distanceKm > 15) {
    score -= 20;
    reasons.push(`GPS Mismatch: Merchant location (${features.merchantLocationName || 'Unknown'}) is ${Math.round(features.distanceKm)}km away from scan location.`);
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));
  let level = 'safe';
  if (score < 50) {
    level = 'high';
  } else if (score < 80) {
    level = 'medium';
  }

  return { score, level, reasons };
}

// Call Python Machine Learning Script (train/predict)
function runPythonMlModel(features) {
  return new Promise((resolve, reject) => {
    // Features array format for ml engine:
    // amount, merchant_days_active, distance_km, reported_count, is_verified_badge, name_similarity_index, is_blacklisted, tampering_detected
    const nameSim = features.upiId.toLowerCase().includes('prize') || features.upiId.toLowerCase().includes('lottery') ? 1 : 0;
    const isBlacklistedVal = features.isBlacklisted ? 1 : 0;
    const isVerifiedVal = features.isVerifiedMerchant ? 1 : 0;
    const isTamperedVal = features.tamperingDetected ? 1 : 0;

    const cmd = `python "${path.join(__dirname, '../ml/predict.py')}" ${features.amount} ${features.merchantDaysActive} ${features.distanceKm} ${features.reportedCount} ${isVerifiedVal} ${nameSim} ${isBlacklistedVal} ${isTamperedVal}`;

    exec(cmd, (error, stdout, stderr) => {
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

// 1. Health Status
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', message: 'Safe Scanner API online.', database: useMongo ? 'MongoDB Atlas' : 'Flat JSON File', timestamp: new Date() });
});

// 2. UPI QR Validation and Fraud Engine
app.post('/api/verify-qr', async (req, res) => {
  const { qrString, userLocation, tamperingDetected } = req.body;
  if (!qrString) {
    return res.status(400).json({ error: 'QR string is required.' });
  }

  // Parse UPI Schema
  let upiId = '';
  let merchantName = 'Unknown Merchant';
  let amount = 0;
  let note = '';

  try {
    if (qrString.startsWith('upi://pay')) {
      const urlParams = new URLSearchParams(qrString.split('?')[1]);
      upiId = urlParams.get('pa') || '';
      merchantName = urlParams.get('pn') ? decodeURIComponent(urlParams.get('pn')) : 'Unknown Merchant';
      amount = parseFloat(urlParams.get('am')) || 0;
      note = urlParams.get('tn') ? decodeURIComponent(urlParams.get('tn')) : '';
    } else {
      upiId = qrString.includes('@') ? qrString.trim() : '';
      merchantName = 'Direct Scanned ID';
    }
  } catch (err) {
    console.error('Failed parsing QR format:', err);
    upiId = qrString;
  }

  if (!upiId) {
    return res.json({
      success: false,
      error: 'Not a valid UPI payment QR code format. Scan aborted.'
    });
  }

  // DB queries (dynamic routing)
  let isBlacklisted = false;
  let merchant = null;
  let reportedCount = 0;

  if (useMongo) {
    isBlacklisted = await Blacklist.findOne({ upiId: upiId.toLowerCase() }) !== null;
    merchant = await Merchant.findOne({ upiId: upiId.toLowerCase() });
    reportedCount = await Report.countDocuments({ upiId: upiId.toLowerCase(), status: 'approved' });
  } else {
    const db = readDb();
    isBlacklisted = db.blacklist.includes(upiId.toLowerCase());
    merchant = db.merchants.find((m) => m.upiId.toLowerCase() === upiId.toLowerCase());
    reportedCount = db.reports.filter((r) => r.upiId.toLowerCase() === upiId.toLowerCase() && r.status === 'approved').length;
  }

  let merchantDaysActive = merchant ? merchant.registeredDays : 0;
  let isVerifiedMerchant = merchant ? merchant.isVerified : false;
  let merchantTrustScore = merchant ? merchant.trustScore : 50;
  let merchantLocation = merchant ? merchant.location : null;

  // Calculate distance mismatch
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
    console.log('Python ML not available. Using fallback JS engine.');
    resultRisk = runJsRiskModel(features);
  }

  // Voice Alert Message
  let voiceMessage = 'Safe to proceed.';
  if (resultRisk.level === 'high') {
    if (isBlacklisted) {
      voiceMessage = 'Warning! This UPI QR is blacklisted for fraud.';
    } else if (features.tamperingDetected) {
      voiceMessage = 'Warning! Scanner has detected layout tampering or overlay sticker.';
    } else {
      voiceMessage = 'This QR code appears suspicious. Proceed with extreme caution.';
    }
  } else if (resultRisk.level === 'medium') {
    voiceMessage = 'Warning! Unverified merchant. Please verify identity.';
  }

  // Save Scan to database
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
});

// 3. Fetch Scan History
app.get('/api/scans', async (req, res) => {
  if (useMongo) {
    const scans = await Scan.find().sort({ timestamp: -1 });
    res.json(scans);
  } else {
    const db = readDb();
    res.json(db.scans);
  }
});

// 4. Report Fraud
app.post('/api/report', async (req, res) => {
  const { upiId, merchantName, reason, reporterLocation } = req.body;
  if (!upiId || !reason) {
    return res.status(400).json({ error: 'UPI ID and reason are required.' });
  }

  const newReport = {
    upiId: upiId.trim().toLowerCase(),
    merchantName: merchantName ? merchantName.trim() : 'Unknown UPI User',
    reason,
    reportedBy: 'User_' + Math.floor(Math.random() * 1000),
    status: 'pending',
    createdAt: new Date().toISOString(),
    evidenceImage: ''
  };

  if (useMongo) {
    await new Report(newReport).save();
  } else {
    const db = readDb();
    db.reports.unshift({ id: 'rep_' + Date.now(), ...newReport });
    writeDb(db);
  }

  res.json({ success: true, report: newReport });
});

// 5. Admin Endpoints: View Reports
app.get('/api/reports', async (req, res) => {
  if (useMongo) {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } else {
    const db = readDb();
    res.json(db.reports);
  }
});

// 6. Admin Endpoints: Approve / Reject Reports
app.post('/api/reports/review', async (req, res) => {
  const { id, action } = req.body;
  if (!id || !action) {
    return res.status(400).json({ error: 'ID and action are required.' });
  }

  if (useMongo) {
    let query = mongoose.isValidObjectId(id) ? { _id: id } : { id: id };
    const report = await Report.findOne(query);

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
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
      return res.status(404).json({ error: 'Report not found.' });
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
});

// 7. Admin: Get Blacklist
app.get('/api/blacklist', async (req, res) => {
  if (useMongo) {
    const list = await Blacklist.find();
    res.json(list.map((item) => item.upiId));
  } else {
    const db = readDb();
    res.json(db.blacklist);
  }
});

// 8. Admin: Add Blacklist
app.post('/api/blacklist/add', async (req, res) => {
  const { upiId } = req.body;
  if (!upiId) return res.status(400).json({ error: 'UPI ID is required.' });

  const cleanId = upiId.trim().toLowerCase();

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
});

// 9. Admin: Remove Blacklist
app.post('/api/blacklist/remove', async (req, res) => {
  const { upiId } = req.body;
  if (!upiId) return res.status(400).json({ error: 'UPI ID is required.' });

  const cleanId = upiId.trim().toLowerCase();

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
});

// 10. Admin: Get Merchants
app.get('/api/merchants', async (req, res) => {
  if (useMongo) {
    const merchants = await Merchant.find();
    res.json(merchants);
  } else {
    const db = readDb();
    res.json(db.merchants);
  }
});

// 11. Admin: Manage Merchant Status (Verify / Update Trust Score)
app.post('/api/merchants/update', async (req, res) => {
  const { upiId, isVerified, trustScore, name, category } = req.body;
  if (!upiId) return res.status(400).json({ error: 'UPI ID is required.' });

  const cleanId = upiId.trim().toLowerCase();

  if (useMongo) {
    const updateFields = {};
    if (isVerified !== undefined) updateFields.isVerified = isVerified;
    if (trustScore !== undefined) updateFields.trustScore = Math.min(100, Math.max(0, trustScore));
    if (name) updateFields.name = name;
    if (category) updateFields.category = category;
    
    // Add default location if creating new
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
      if (name) merchant.name = name;
      if (category) merchant.category = category;
    } else {
      merchant = {
        upiId: cleanId,
        name: name || 'New Merchant',
        registeredDays: 1,
        isVerified: !!isVerified,
        trustScore: trustScore !== undefined ? trustScore : 70,
        category: category || 'General',
        location: { lat: 28.6139, lng: 77.2090, name: 'New Delhi, DL' }
      };
      db.merchants.push(merchant);
    }

    writeDb(db);
    res.json({ success: true, merchant });
  }
});

// 12. Security AI chatbot
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const q = message.toLowerCase();
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
