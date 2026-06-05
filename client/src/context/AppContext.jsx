import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const translations = {
  en: {
    appName: "Safe Scanner",
    tagline: "Scan Smart. Pay Safe.",
    scanner: "Smart Scanner",
    history: "Scan History",
    assistant: "AI Assistant",
    hub: "Awareness Hub",
    profile: "My Profile",
    admin: "Admin Control",
    logout: "Log Out",
    welcome: "Welcome back,",
    recentScans: "Recent Scans",
    safeScore: "Safety Score",
    riskHigh: "High Risk",
    riskMedium: "Medium Risk",
    riskSafe: "Safe",
    merchantDetails: "Merchant Verification Info",
    scannedOn: "Scanned On",
    reportScam: "Report Scam QR",
    reportTitle: "Community Reporting Hub",
    flagScam: "Flag Scam UPI",
    voiceAlerts: "Voice Security Alerts",
    gpsLocation: "Simulated GPS Location",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    activeScans: "Total Scans Today",
    fraudDetected: "Threats Blocked",
    verifiedMerchants: "Verified Outlets",
    pendingReports: "Unreviewed Reports",
    scamHotspots: "Scam Hotspots",
    blacklistCount: "Blacklist Records",
    systemStats: "Secured Transactions Analysis",
    scanBtnText: "Start Camera Scan",
    uploadBtnText: "Upload QR Image",
    presetScanText: "Test Scenarios (Simulation)",
    chatPlaceholder: "Ask about UPI scams, refunds, safety...",
    reportFormUpi: "Merchant UPI ID",
    reportFormName: "Merchant/Business Name",
    reportFormReason: "Describe the fraud/scam suspicious activity",
    reportSubmit: "Submit Scam Report",
    verifySuccess: "Verification Complete",
    alertTampered: "Sticker / Layer tampering detected!",
    alertBlacklisted: "Merchant UPI is blacklisted for fraud!",
    alertNewAccount: "Highly suspicious: Newly created unverified account.",
    alertDistance: "GPS Alert: Registered location mismatch.",
  },
  hi: {
    appName: "सेफ़ स्कैनर",
    tagline: "स्मार्ट स्कैन। सुरक्षित भुगतान।",
    scanner: "स्मार्ट स्कैनर",
    history: "स्कैन इतिहास",
    assistant: "एआई सहायक",
    hub: "जागरूकता हब",
    profile: "मेरी प्रोफ़ाइल",
    admin: "एडमिन नियंत्रण",
    logout: "लॉग आउट",
    welcome: "स्वागत है,",
    recentScans: "हाल के स्कैन",
    safeScore: "सुरक्षा स्कोर",
    riskHigh: "उच्च जोखिम",
    riskMedium: "मध्यम जोखिम",
    riskSafe: "सुरक्षित",
    merchantDetails: "व्यापारी सत्यापन जानकारी",
    scannedOn: "स्कैन किया गया",
    reportScam: "घोटाला रिपोर्ट करें",
    reportTitle: "सामुदायिक रिपोर्टिंग हब",
    flagScam: "स्कैम UPI रिपोर्ट करें",
    voiceAlerts: "आवाज सुरक्षा अलर्ट",
    gpsLocation: "सिम्युलेटेड जीपीएस स्थान",
    lightMode: "लाइट मोड",
    darkMode: "डार्क मोड",
    activeScans: "आज कुल स्कैन",
    fraudDetected: "खतरे रोके गए",
    verifiedMerchants: "सत्यापित आउटलेट",
    pendingReports: "अशिक्षित रिपोर्ट",
    scamHotspots: "स्कैम हॉटस्पॉट",
    blacklistCount: "ब्लैकलिस्ट रिकॉर्ड",
    systemStats: "सुरक्षित लेनदेन विश्लेषण",
    scanBtnText: "कैमरा स्कैन शुरू करें",
    uploadBtnText: "QR छवि अपलोड करें",
    presetScanText: "परीक्षण स्थितियां (सिमुलेशन)",
    chatPlaceholder: "UPI घोटाले, रिफंड या सुरक्षा के बारे में पूछें...",
    reportFormUpi: "व्यापारी UPI आईडी",
    reportFormName: "व्यापारी/व्यवसाय का नाम",
    reportFormReason: "घोटाले या संदिग्ध गतिविधि का वर्णन करें",
    reportSubmit: "स्कैम रिपोर्ट जमा करें",
    verifySuccess: "सत्यापन पूरा हुआ",
    alertTampered: "स्टिकर या ओवरले छेड़छाड़ का पता चला!",
    alertBlacklisted: "व्यापारी UPI धोखाधड़ी के लिए ब्लैकलिस्ट है!",
    alertNewAccount: "अत्यधिक संदिग्ध: नया बनाया गया असत्यापित खाता।",
    alertDistance: "जीपीएस अलर्ट: पंजीकृत स्थान बेमेल।",
  },
  te: {
    appName: "సేఫ్ స్కానర్",
    tagline: "స్మార్ట్ స్కాన్. సేఫ్ పేమెంట్.",
    scanner: "స్మార్ట్ స్కానర్",
    history: "స్కాన్ చరిత్ర",
    assistant: "AI అసిస్టెంట్",
    hub: "అవగాహన హబ్",
    profile: "నా ప్రొఫైల్",
    admin: "అడ్మిన్ ప్యానెల్",
    logout: "లాగ్ అవుట్",
    welcome: "స్వాగతం,",
    recentScans: "ఇటీవలి స్కాన్లు",
    safeScore: "భద్రత స్కోరు",
    riskHigh: "అధిక ప్రమాదం",
    riskMedium: "మధ్యమ ప్రమాదం",
    riskSafe: "సురక్షితం",
    merchantDetails: "మర్చంట్ వెరిఫికేషన్ వివరాలు",
    scannedOn: "స్కాన్ చేసిన తేదీ",
    reportScam: "స్కామ్ రిపోర్ట్ చేయండి",
    reportTitle: "కమ్యూనిటీ రిపోర్టింగ్ హబ్",
    flagScam: "స్కామ్ UPI రిపోర్ట్",
    voiceAlerts: "వాయిస్ అలర్ట్ సిస్టమ్",
    gpsLocation: "సిమ్యులేటెడ్ GPS స్థానం",
    lightMode: "లైట్ మోడ్",
    darkMode: "డార్క్ మోడ్",
    activeScans: "ఈరోజు స్కాన్లు",
    fraudDetected: "నిరోధించబడిన ముప్పులు",
    verifiedMerchants: "ధృవీకరించబడిన దుకాణాలు",
    pendingReports: "పరిశీలించని రిపోర్ట్లు",
    scamHotspots: "స్కామ్ హాట్‌స్పాట్‌లు",
    blacklistCount: "బ్లాక్‌లిస్ట్ రికార్డులు",
    systemStats: "లావాదేవీల విశ్లేషణ",
    scanBtnText: "కెమెరా స్కాన్ ప్రారంభించండి",
    uploadBtnText: "QR ఇమేజ్ అప్‌లోడ్",
    presetScanText: "టెస్ట్ సినారియోలు (సిమ్యులేషన్)",
    chatPlaceholder: "UPI స్కామ్‌లు, రీఫండ్‌లపై అడగండి...",
    reportFormUpi: "మర్చంట్ UPI ID",
    reportFormName: "మర్చంట్/వ్యాపార పేరు",
    reportFormReason: "మోసం లేదా అనుమానాస్పద చర్యను వివరించండి",
    reportSubmit: "స్కామ్ రిపోర్ట్ సమర్పించండి",
    verifySuccess: "ధృవీకరణ పూర్తయింది",
    alertTampered: "స్టిక్కర్ లేదా లేయర్ ట్యాంపరింగ్ గుర్తించబడింది!",
    alertBlacklisted: "మర్చంట్ UPI మోసం కోసం బ్లాక్‌లిస్ట్‌లో ఉంది!",
    alertNewAccount: "అధిక అనుమానం: కొత్తగా సృష్టించబడిన ఖాతా.",
    alertDistance: "GPS హెచ్చరిక: నమోదిత స్థానంలో తేడా ఉంది.",
  }
};

export const AppProvider = ({ children }) => {
  const [currentView, setCurrentView] = useState('splash'); // splash, login, home, admin
  const [currentUser, setCurrentUser] = useState(null); // { username, role }
  const [token, setToken] = useState(localStorage.getItem('safe_scanner_token') || null);
  const [language, setLanguage] = useState('en');
  const [darkMode, setDarkMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Simulated GPS options
  const gpsLocations = [
    { name: "Mumbai (MH)", lat: 19.0760, lng: 72.8777 },
    { name: "New Delhi (DL)", lat: 28.6139, lng: 77.2090 },
    { name: "Bengaluru (KA)", lat: 12.9716, lng: 77.5946 },
    { name: "Hyderabad (TS)", lat: 17.3850, lng: 78.4867 },
  ];
  const [currentGps, setCurrentGps] = useState(gpsLocations[0]);

  // Dynamic Scan Results & History
  const [scanHistory, setScanHistory] = useState([]);
  const [latestScanResult, setLatestScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Helper to fetch authorization headers
  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Translate helper
  const t = (key) => {
    return translations[language][key] || key;
  };

  // Sync dark mode class
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Authenticate / Validate Token on Boot
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        if (currentView !== 'splash') {
          setCurrentView('login');
        }
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          if (data.user.role === 'admin') {
            setCurrentView('admin');
          } else {
            setCurrentView('home');
          }
        } else {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.warn("API offline, maintaining token state local fallback.");
        // offline fallback: assume token role based on JWT decode or local parse
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          setCurrentUser({ username: payload.username, role: payload.role });
          if (payload.role === 'admin') {
            setCurrentView('admin');
          } else {
            setCurrentView('home');
          }
        } catch (e) {
          handleLogout();
        }
      }
    };
    validateToken();
  }, [token]);

  // Handle Logout
  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('safe_scanner_token');
    setCurrentView('login');
  };

  // Load history from API
  const fetchScanHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/scans`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setScanHistory(data);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error loading scan history:", err);
    }
  };

  // Perform UPI QR Verification
  const verifyUpiQr = async (qrString, tamperingDetected = false) => {
    try {
      setIsScanning(true);
      const response = await fetch(`${API_BASE_URL}/verify-qr`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          qrString,
          userLocation: { lat: currentGps.lat, lng: currentGps.lng },
          tamperingDetected
        })
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error("Session expired.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "API call failed");
      }

      const result = await response.json();
      if (result.success) {
        setLatestScanResult(result);
        fetchScanHistory(); // refresh history list
        
        // Voice Alert Trigger
        if (voiceEnabled && result.scan.voiceMessage) {
          triggerVoiceAlert(result.scan.voiceMessage);
        }
        
        setIsScanning(false);
        return result;
      } else {
        setIsScanning(false);
        alert(result.error || "Verification failed");
        return null;
      }
    } catch (err) {
      setIsScanning(false);
      console.error("QR Verification Error:", err);
      // Client-side fallback if backend server is not reachable
      const fallbackResult = generateFallbackScanResult(qrString, tamperingDetected);
      setLatestScanResult(fallbackResult);
      setScanHistory(prev => [fallbackResult.scan, ...prev]);
      if (voiceEnabled) {
        triggerVoiceAlert(fallbackResult.scan.voiceMessage);
      }
      return fallbackResult;
    }
  };

  // Trigger web speech synthesis
  const triggerVoiceAlert = (message) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Client-side Fallback Generator (resilient failover)
  const generateFallbackScanResult = (qrString, tampering) => {
    let upiId = qrString;
    let name = "Unknown Merchant";
    if (qrString.startsWith('upi://pay')) {
      const urlParams = new URLSearchParams(qrString.split('?')[1]);
      upiId = urlParams.get('pa') || qrString;
      name = urlParams.get('pn') ? decodeURIComponent(urlParams.get('pn')) : "Unknown Merchant";
    }

    const isBlacklisted = upiId.includes('scammer') || upiId.includes('fraud');
    let score = 95;
    let level = 'safe';
    let reasons = [];
    let voiceMessage = "Safe to proceed.";

    if (isBlacklisted) {
      score = 8;
      level = 'high';
      reasons.push("UPI ID matches known fraud database.");
      voiceMessage = "Warning! This UPI QR is blacklisted for fraud.";
    } else if (tampering) {
      score = 42;
      level = 'high';
      reasons.push("Suspicious QR pattern / overlay detected.");
      voiceMessage = "Warning! Scanner has detected layout tampering or overlay sticker.";
    } else if (upiId.toLowerCase().includes('prize') || upiId.toLowerCase().includes('winner')) {
      score = 35;
      level = 'high';
      reasons.push("UPI ID contains high-risk keywords (prize/winner).");
      voiceMessage = "This QR code appears suspicious. Proceed with extreme caution.";
    }

    const fallbackScan = {
      id: 'scan_' + Date.now(),
      upiId,
      merchantName: name,
      amount: 0,
      note: 'Offline Mode Scan',
      riskScore: score,
      riskLevel: level,
      timestamp: new Date().toISOString(),
      location: currentGps,
      tamperingDetected: tampering,
      voiceMessage
    };

    return {
      success: true,
      scan: fallbackScan,
      reasons,
      engine: "Local Static Analysis (Offline Fallback)",
      merchant: {
        name,
        registeredDays: 200,
        isVerified: !isBlacklisted && !tampering,
        trustScore: score,
        category: "General",
        locationName: currentGps.name
      }
    };
  };

  // Submit Fraud Report
  const submitFraudReport = async (reportData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/report`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...reportData,
          reporterLocation: currentGps
        })
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return false;
      }
      return response.ok;
    } catch (err) {
      console.error("Report Fraud failed:", err);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      currentView,
      setCurrentView,
      currentUser,
      setCurrentUser,
      token,
      setToken,
      language,
      setLanguage,
      darkMode,
      setDarkMode,
      voiceEnabled,
      setVoiceEnabled,
      gpsLocations,
      currentGps,
      setCurrentGps,
      scanHistory,
      setScanHistory,
      latestScanResult,
      setLatestScanResult,
      isScanning,
      verifyUpiQr,
      submitFraudReport,
      fetchScanHistory,
      handleLogout,
      getAuthHeaders,
      t,
      API_BASE_URL
    }}>
      {children}
    </AppContext.Provider>
  );
};
