import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from './context/AppContext';
import QRScanner from './components/QRScanner';
import RiskDial from './components/RiskDial';
import SecurityChat from './components/SecurityChat';
import {
  ShieldAlert, ShieldCheck, Camera, History, MessageSquare, BookOpen, Settings,
  User, Shield, Smartphone, Monitor, Globe, Volume2, VolumeX, MapPin, BarChart3,
  Users, AlertTriangle, FileText, CheckCircle2, XCircle, Plus, Trash2, LogOut, 
  Moon, Sun, HelpCircle, Eye, EyeOff, Lock
} from 'lucide-react';

const App = () => {
  const {
    currentView, setCurrentView, currentUser, setCurrentUser, token, setToken,
    language, setLanguage, darkMode, setDarkMode, voiceEnabled, setVoiceEnabled,
    gpsLocations, currentGps, setCurrentGps, scanHistory, setScanHistory,
    latestScanResult, setLatestScanResult, isScanning, verifyUpiQr,
    submitFraudReport, fetchScanHistory, handleLogout, getAuthHeaders, t, API_BASE_URL
  } = useContext(AppContext);

  // Layout presentation mode: 'desktop' or 'mobile'
  const [presentationMode, setPresentationMode] = useState('mobile');
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('home'); // home, history, chat, hub, settings
  
  // UI modals
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [scanDetailModalOpen, setScanDetailModalOpen] = useState(false);
  const [selectedScanDetail, setSelectedScanDetail] = useState(null);

  // Authentication forms
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginRole, setLoginRole] = useState('user'); // user, admin
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Report fraud form states
  const [reportUpi, setReportUpi] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Awareness quiz states
  const [quizScore, setQuizScore] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSelectedOption, setQuizSelectedOption] = useState(null);
  
  // Admin tables, stats, and audit logs
  const [adminStats, setAdminStats] = useState({
    totalScans: 0,
    threatsBlocked: 0,
    verifiedMerchants: 0,
    pendingReports: 0
  });
  const [adminReports, setAdminReports] = useState([]);
  const [adminBlacklist, setAdminBlacklist] = useState([]);
  const [adminMerchants, setAdminMerchants] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminActiveTab, setAdminActiveTab] = useState('dashboard'); // dashboard, reports, blacklist, merchants, logs
  
  // Add manual blacklist UPI input
  const [newBlacklistUpi, setNewBlacklistUpi] = useState('');
  
  // Add manual merchant input
  const [newMerchantUpi, setNewMerchantUpi] = useState('');
  const [newMerchantName, setNewMerchantName] = useState('');
  const [newMerchantScore, setNewMerchantScore] = useState(80);
  const [newMerchantCategory, setNewMerchantCategory] = useState('Retail');

  // Search & Filter History
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // all, safe, medium, high

  // Run initial setups
  useEffect(() => {
    if (currentView === 'splash') {
      const timer = setTimeout(() => {
        if (token) {
          // Token watcher handles view change
        } else {
          setCurrentView('login');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentView, token]);

  // Load backend data if available
  useEffect(() => {
    if (currentUser) {
      fetchScanHistory();
      if (currentUser.role === 'admin') {
        fetchAdminData();
      }
    }
  }, [currentUser]);

  const fetchAdminData = async () => {
    if (!token) return;
    try {
      const scansRes = await fetch(`${API_BASE_URL}/scans`, { headers: getAuthHeaders() });
      const reportsRes = await fetch(`${API_BASE_URL}/reports`, { headers: getAuthHeaders() });
      const blacklistRes = await fetch(`${API_BASE_URL}/blacklist`, { headers: getAuthHeaders() });
      const merchantsRes = await fetch(`${API_BASE_URL}/merchants`, { headers: getAuthHeaders() });
      const logsRes = await fetch(`${API_BASE_URL}/admin/logs`, { headers: getAuthHeaders() });

      if (scansRes.status === 401 || scansRes.status === 403) {
        handleLogout();
        return;
      }

      if (scansRes.ok && reportsRes.ok && blacklistRes.ok && merchantsRes.ok && logsRes.ok) {
        const scans = await scansRes.json();
        const reports = await reportsRes.json();
        const blacklist = await blacklistRes.json();
        const merchants = await merchantsRes.json();
        const logs = await logsRes.json();

        setAdminReports(reports);
        setAdminBlacklist(blacklist);
        setAdminMerchants(merchants);
        setAdminAuditLogs(logs);

        // Calculate aggregate stats
        const highRiskScans = scans.filter(s => s.riskLevel === 'high').length;
        const verifiedMerchantCount = merchants.filter(m => m.isVerified).length;
        const pendingRepCount = reports.filter(r => r.status === 'pending').length;

        setAdminStats({
          totalScans: scans.length,
          threatsBlocked: highRiskScans + blacklist.length,
          verifiedMerchants: verifiedMerchantCount,
          pendingReports: pendingRepCount
        });
      }
    } catch (err) {
      console.warn("Could not fetch admin data from API, using fallback data.");
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!usernameInput || !passwordInput) {
      setAuthError('Please fill in all input credentials.');
      return;
    }

    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || 'Authentication check failed.');
        return;
      }

      if (isRegistering) {
        setAuthSuccess('Registration successful! You can now log in.');
        setIsRegistering(false);
        setPasswordInput('');
      } else {
        localStorage.setItem('safe_scanner_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setUsernameInput('');
        setPasswordInput('');
        if (data.user.role === 'admin') {
          setCurrentView('admin');
        } else {
          setCurrentView('home');
          setActiveTab('home');
        }
      }
    } catch (err) {
      setAuthError('Connection failed. Server backend is offline.');
    }
  };

  // Submit Community Report
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportUpi || !reportReason) return;
    const success = await submitFraudReport({
      upiId: reportUpi,
      merchantName: reportName,
      reason: reportReason
    });
    if (success) {
      setReportSuccess(true);
      setReportUpi('');
      setReportName('');
      setReportReason('');
      setTimeout(() => {
        setReportSuccess(false);
        setReportModalOpen(false);
      }, 2000);
    } else {
      alert("Error submitting report.");
    }
  };

  // Admin Actions
  const handleReviewReport = async (reportId, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/review`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: reportId, action })
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      alert("API request failed.");
    }
  };

  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    if (!newBlacklistUpi) return;
    try {
      const res = await fetch(`${API_BASE_URL}/blacklist/add`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ upiId: newBlacklistUpi })
      });
      if (res.ok) {
        setNewBlacklistUpi('');
        fetchAdminData();
      }
    } catch (err) {
      alert("API request failed.");
    }
  };

  const handleRemoveBlacklist = async (upiId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/blacklist/remove`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ upiId })
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      alert("API request failed.");
    }
  };

  const handleAddMerchant = async (e) => {
    e.preventDefault();
    if (!newMerchantUpi) return;
    try {
      const res = await fetch(`${API_BASE_URL}/merchants/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          upiId: newMerchantUpi,
          name: newMerchantName,
          trustScore: parseInt(newMerchantScore),
          isVerified: true,
          category: newMerchantCategory
        })
      });
      if (res.ok) {
        setNewMerchantUpi('');
        setNewMerchantName('');
        setNewMerchantScore(80);
        fetchAdminData();
      }
    } catch (err) {
      alert("API request failed.");
    }
  };

  // Awareness Quiz Database
  const quizData = [
    {
      q: "A lottery agent sends a QR code on WhatsApp stating 'Scan to receive your Cash Prize of ₹10,000'. What should you do?",
      options: [
        "Scan it immediately using Safe Scanner and pay the fee",
        "Refuse. You never scan a QR code to receive money",
        "Type your UPI PIN to unlock the cash prize transaction",
        "Report the QR on social media but scan it to check if it's real"
      ],
      ans: 1,
      expl: "Correct! Scanning a QR code and entering your UPI PIN always deducts money from your bank account. You never scan to receive funds."
    },
    {
      q: "What constitutes a 'QR Overlay Sticker' scam?",
      options: [
        "A shop keeper decorating their QR stand with neon lights",
        "Fraudsters pasting their fake QR sticker over a merchant's authentic QR",
        "Adding extra security software onto the payment application",
        "Enabling GPS location locks on scanning devices"
      ],
      ans: 1,
      expl: "Correct! Fraudsters stick duplicate stickers on merchant counters to divert payments. Safe Scanner visually checks for overlay stickers."
    },
    {
      q: "Why is it important to verify the payee name displayed inside your payment app before confirming transaction?",
      options: [
        "To ensure the payment doesn't fail due to server lag",
        "To check if the name matches the registered merchant identity rather than a hidden personal account",
        "Because it increases your cashback rewards",
        "It prevents location mismatches in the state registrar"
      ],
      ans: 1,
      expl: "Correct! Fraudsters name their fake merchant account with misleading titles (e.g. 'Gas Agency Refund Desk'). Check the underlying UPI ID."
    }
  ];

  const handleQuizAnswer = (optionIdx) => {
    setQuizSelectedOption(optionIdx);
    setQuizAnswered(true);
    if (optionIdx === quizData[quizIndex].ans) {
      setQuizScore(quizScore + 1);
    }
  };

  const handleNextQuiz = () => {
    setQuizAnswered(false);
    setQuizSelectedOption(null);
    if (quizIndex < quizData.length - 1) {
      setQuizIndex(quizIndex + 1);
    } else {
      setQuizIndex(0);
      setQuizScore(0);
    }
  };

  // Filter scan history list
  const filteredHistory = scanHistory.filter(scan => {
    const matchesSearch = scan.merchantName.toLowerCase().includes(historySearch.toLowerCase()) || 
                          scan.upiId.toLowerCase().includes(historySearch.toLowerCase());
    
    if (historyFilter === 'all') return matchesSearch;
    return matchesSearch && scan.riskLevel === historyFilter;
  });

  // Render Splash Screen
  if (currentView === 'splash') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#060a12] via-[#0b1326] to-[#050910] text-white select-none">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-24 h-24 rounded-full border border-blue-500/20 animate-ping [animation-duration:2s]"></div>
          <div className="absolute w-32 h-32 rounded-full border border-blue-500/10 animate-ping [animation-duration:3s]"></div>
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-6 rounded-3xl shadow-xl shadow-blue-500/20 border border-blue-400/30 z-10">
            <ShieldAlert className="w-16 h-16 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-white">
          Safe Scanner
        </h1>
        <p className="text-sm font-semibold tracking-wider uppercase text-blue-400 mt-2">
          {t('tagline')}
        </p>
        <div className="mt-16 flex flex-col items-center gap-2">
          <div className="w-10 h-1 bg-blue-600/30 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-2/3 animate-[laser-beam_2s_infinite_linear]"></div>
          </div>
          <span className="text-[10px] text-gray-500 font-medium">B.TECH FINAL YEAR MAJOR PROJECT - 2026</span>
        </div>
      </div>
    );
  }

  // Render Hardened Login & Registration Page
  if (currentView === 'login') {
    const features = [
      { icon: '🛡️', label: 'AI Fraud Detection' },
      { icon: '📍', label: 'GPS Verification' },
      { icon: '🔒', label: 'OWASP Safe' },
    ];
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #060a12 0%, #0b1326 40%, #0d1f3c 70%, #050910 100%)' }}
      >
        {/* Decorative Grid and Orbs */}
        <div style={{ position: 'absolute', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', top: '-150px', left: '-150px' }} />
        <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', bottom: '-100px', right: '-100px' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="relative z-10 w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex relative mb-4">
              <div style={{ position: 'absolute', inset: '-6px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3))', filter: 'blur(10px)' }} />
              <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)', borderRadius: '16px', padding: '14px', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 30px rgba(59,130,246,0.2)' }}>
                <ShieldCheck style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Safe Scanner</h1>
            <p className="text-xs font-bold text-blue-400 mt-1 uppercase tracking-wider">Cybersecurity Edition</p>
          </div>

          {/* Role selector tabs */}
          <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl mb-4 backdrop-blur">
            <button
              onClick={() => { setLoginRole('user'); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 text-xs py-2 rounded-xl transition font-bold flex items-center justify-center gap-1.5 ${loginRole === 'user' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <User className="w-3.5 h-3.5" /> User Access
            </button>
            <button
              onClick={() => { setLoginRole('admin'); setIsRegistering(false); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 text-xs py-2 rounded-xl transition font-bold flex items-center justify-center gap-1.5 ${loginRole === 'admin' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Shield className="w-3.5 h-3.5" /> Administrator
            </button>
          </div>

          {/* Login Form Box */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
            <h3 className="text-lg font-bold text-white mb-1">
              {loginRole === 'admin' ? 'Admin Portal' : isRegistering ? 'Create User Account' : 'User Portal'}
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              {loginRole === 'admin' 
                ? 'Authorized personnel login verification.' 
                : isRegistering 
                  ? 'Register a secure password-protected wallet checker.' 
                  : 'Enter credentials to scan and verify UPI codes.'}
            </p>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-red-400 leading-normal">{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 mb-4 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-emerald-400 leading-normal">{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Enter your username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white outline-none focus:border-blue-500/80 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white outline-none focus:border-blue-500/80 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-xl text-white font-bold text-xs shadow-lg transition duration-200 mt-2 ${
                  loginRole === 'admin' 
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:shadow-indigo-600/20' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-blue-600/20'
                }`}
              >
                {isRegistering ? 'Complete Registration' : 'Secure Authenticate'}
              </button>
            </form>

            {loginRole === 'user' && (
              <div className="text-center mt-5">
                <button
                  onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); setAuthSuccess(''); }}
                  className="text-xs text-blue-400 hover:underline font-semibold"
                >
                  {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                </button>
              </div>
            )}
          </div>

          {/* Security footer */}
          <div className="text-center mt-5 flex items-center justify-center gap-2 text-xs text-gray-600">
            <Lock className="w-3 h-3 text-gray-600" />
            <span>Secure authentication required</span>
          </div>
        </div>
      </div>
    );
  }

  // Render User Side Screen
  const renderUserSide = () => {
    if (presentationMode === 'mobile') {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-[#070b13] flex flex-col items-center justify-center p-4">
          <div className="mb-4 flex gap-2 bg-white dark:bg-slate-900/60 p-1 rounded-xl shadow border border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setPresentationMode('mobile')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow"
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile Frame
            </button>
            <button
              onClick={() => setPresentationMode('desktop')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-500 hover:text-gray-400"
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop Mode
            </button>
          </div>

          <div className="w-[360px] h-[720px] bg-white dark:bg-[#0b0f19] border-[10px] border-gray-900 dark:border-slate-800 rounded-[42px] shadow-2xl relative overflow-hidden flex flex-col">
            {/* Phone Top Speaker/Camera */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-gray-900 rounded-b-2xl z-50 flex items-center justify-center gap-1">
              <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
              <div className="w-2.5 h-2.5 bg-slate-800 rounded-full"></div>
            </div>

            {/* Mobile Header status bar */}
            <div className="h-10 bg-white dark:bg-[#0b0f19] border-b border-gray-100 dark:border-gray-850 px-6 pt-5 flex justify-between items-center text-[10px] text-gray-400">
              <span className="font-bold">SafeScanner Mobile</span>
              <div className="flex gap-1 items-center">
                <span>5G</span>
                <div className="w-5 h-2.5 bg-gray-300 dark:bg-slate-700 rounded-sm"></div>
              </div>
            </div>

            {/* App Nav Header */}
            <div className="p-4 flex justify-between items-center bg-white dark:bg-[#0b0f19]">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-xl text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm font-display tracking-tight text-gray-900 dark:text-white">Safe Scanner</span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-500 transition p-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* App Content viewport */}
            <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4">
              {renderTabContent()}
            </div>

            {/* Mobile Navigation Tab bar */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0e1424] border-t border-gray-250 dark:border-gray-850/80 px-4 flex justify-around items-center z-40">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Camera className="w-5 h-5" />
                <span className="text-[9px] font-bold">Scan</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <History className="w-5 h-5" />
                <span className="text-[9px] font-bold">Logs</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'chat' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="text-[9px] font-bold">AI Bot</span>
              </button>
              <button
                onClick={() => setActiveTab('hub')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'hub' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <BookOpen className="w-5 h-5" />
                <span className="text-[9px] font-bold">Hub</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-[9px] font-bold">Settings</span>
              </button>
            </div>
            
            <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-28 h-1 bg-gray-900 dark:bg-slate-700 rounded-full z-50"></div>
          </div>
        </div>
      );
    } else {
      // Desktop full-page web portal layout
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#070b13] flex flex-col animate-fadeIn">
          {/* Header Navigation */}
          <header className="bg-white dark:bg-[#0e1424] border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-md">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                  Safe Scanner
                </h1>
                <p className="text-[10px] tracking-wider uppercase text-blue-500 font-bold">{t('tagline')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setPresentationMode('mobile')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 transition"
              >
                <Smartphone className="w-4 h-4 text-blue-500" /> Switch to Android App Frame
              </button>

              {currentUser && currentUser.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className="flex items-center gap-1 text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/25 text-indigo-500 px-3.5 py-1.5 rounded-xl transition"
                >
                  <Shield className="w-3.5 h-3.5" /> Admin Panel
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-xl transition"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Desktop Dual-Pane Grid Layout */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-3 bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 rounded-3xl p-4 flex flex-col gap-2 shadow-sm">
              {[
                { id: 'home', label: 'Dashboard & Scanner', icon: <Camera className="w-4 h-4" /> },
                { id: 'history', label: t('history'), icon: <History className="w-4 h-4" /> },
                { id: 'chat', label: t('assistant'), icon: <MessageSquare className="w-4 h-4" /> },
                { id: 'hub', label: t('hub'), icon: <BookOpen className="w-4 h-4" /> },
                { id: 'settings', label: t('profile'), icon: <Settings className="w-4 h-4" /> }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 text-sm font-semibold px-4 py-3 rounded-2xl transition ${
                    activeTab === item.id
                      ? 'bg-blue-600 text-white shadow shadow-blue-500/20'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#161f33]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Desktop Dashboard Panel Viewport */}
            <div className="lg:col-span-9 bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 rounded-3xl p-6 md:p-8 shadow-sm">
              {renderTabContent()}
            </div>
          </main>
        </div>
      );
    }
  };

  // Render Secure Admin Panel Screen
  const renderAdminSide = () => {
    // Rigid Security Lock - Block non-admin view escalation
    if (!currentUser || currentUser.role !== 'admin') {
      return renderUserSide();
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070b13] flex flex-col font-sans">
        
        {/* Admin Header */}
        <header className="bg-white dark:bg-[#0f1626] border-b border-gray-200/60 dark:border-gray-800/80 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-gray-900 dark:text-white flex items-center gap-2">
                Safe Scanner Admin Console
              </h1>
              <p className="text-[10px] tracking-wider uppercase text-indigo-500 font-bold">Systems Security & Reports Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'reports', label: 'Reports' },
                { id: 'blacklist', label: 'Blacklist' },
                { id: 'merchants', label: 'Outlets' },
                { id: 'logs', label: 'Audit Logs' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAdminActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${adminActiveTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setCurrentView('home');
                setPresentationMode('mobile');
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-150 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 transition hover:bg-gray-200"
            >
              <Smartphone className="w-4 h-4 text-blue-500" /> Return to User Portal
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </header>

        {/* Admin layout grid */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
          
          {/* STATS MATRIX CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('activeScans'), val: adminStats.totalScans, icon: <BarChart3 className="w-5 h-5 text-blue-500" /> },
              { label: t('fraudDetected'), val: adminStats.threatsBlocked, icon: <AlertTriangle className="w-5 h-5 text-red-500" /> },
              { label: t('verifiedMerchants'), val: adminStats.verifiedMerchants, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
              { label: t('pendingReports'), val: adminStats.pendingReports, icon: <Users className="w-5 h-5 text-amber-500" /> }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{stat.label}</span>
                  <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1 font-display">{stat.val}</h4>
                </div>
                <div className="bg-gray-100 dark:bg-[#161f33] p-3 rounded-xl">
                  {stat.icon}
                </div>
              </div>
            ))}
          </div>

          {/* ACTIVE TAB ROUTING FOR ADMIN */}
          {adminActiveTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Chart Panel */}
              <div className="lg:col-span-8 bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
                <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                  <BarChart3 className="w-5 h-5 text-indigo-500" /> Daily Fraud Prevention Trends
                </h3>
                <div className="h-[220px] w-full bg-gray-50 dark:bg-[#0c1220] rounded-2xl border border-gray-200/40 dark:border-gray-800/60 p-4 flex flex-col justify-between relative overflow-hidden">
                  <svg className="absolute inset-0 w-full h-[180px] mt-6" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0 100 Q 20 60 40 80 T 80 40 T 100 20 L 100 100 Z" fill="url(#chartGrad)" opacity="0.15"></path>
                    <path d="M 0 100 Q 20 60 40 80 T 80 40 T 100 20" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"></path>
                    <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(150,150,150,0.1)" strokeWidth="0.5"></line>
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(150,150,150,0.1)" strokeWidth="0.5"></line>
                    <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(150,150,150,0.1)" strokeWidth="0.5"></line>
                    <defs>
                      <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#0c1220" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute left-3 top-4 flex flex-col gap-1 text-[8px] text-gray-400 font-bold">
                    <span>100 Scans</span>
                    <span>50 Scans</span>
                    <span>0 Scans</span>
                  </div>
                  <div className="mt-auto flex justify-between text-[9px] text-gray-400 font-semibold px-2 z-10">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat (Today)</span>
                  </div>
                </div>
              </div>

              {/* Hotspots Panel */}
              <div className="lg:col-span-4 bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
                <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-red-500" /> Regional Hotspots
                </h3>
                <div className="space-y-3">
                  {[
                    { region: "Mumbai, MH", fraudCases: 8, severity: "High Risk" },
                    { region: "New Delhi, DL", fraudCases: 5, severity: "Medium Risk" },
                    { region: "Bengaluru, KA", fraudCases: 2, severity: "Low Risk" },
                  ].map((spot, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-gray-50 dark:bg-[#0c1220] rounded-xl border border-gray-100 dark:border-gray-800">
                      <div>
                        <h5 className="text-xs font-bold">{spot.region}</h5>
                        <span className="text-[10px] text-gray-400">{spot.fraudCases} Reported Scams</span>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${
                        spot.severity === 'High Risk'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : spot.severity === 'Medium Risk'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {spot.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminActiveTab === 'reports' && (
            <div className="bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-amber-500" /> Pending Community Reports ({adminReports.filter(r => r.status === 'pending').length})
              </h3>
              <div className="space-y-4">
                {adminReports.map((rep) => (
                  <div key={rep.id || rep._id} className="p-4 bg-gray-50 dark:bg-[#0c1220] rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{rep.merchantName}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                          rep.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : rep.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'
                        }`}>{rep.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{rep.upiId}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-normal">{rep.reason}</p>
                      <span className="text-[9px] text-gray-500">Reported By: {rep.reportedBy || 'Anonymous'}</span>
                    </div>
                    {rep.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReviewReport(rep.id || rep._id, 'approve')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReviewReport(rep.id || rep._id, 'reject')}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs px-3 py-1.5 rounded-xl border border-red-500/20 transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {adminReports.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">No user reports submitted yet.</p>
                )}
              </div>
            </div>
          )}

          {adminActiveTab === 'blacklist' && (
            <div className="bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-5 h-5 text-red-500" /> Active UPI Blacklist Registry
              </h3>
              <form onSubmit={handleAddBlacklist} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter UPI ID to blacklist (e.g. thief@paytm)..."
                  value={newBlacklistUpi}
                  onChange={(e) => setNewBlacklistUpi(e.target.value)}
                  className="flex-1 text-xs bg-gray-50 dark:bg-[#0c1220] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 outline-none"
                />
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 rounded-xl flex items-center gap-1 transition shadow"
                >
                  <Plus className="w-4 h-4" /> Add Record
                </button>
              </form>
              <div className="space-y-2">
                {adminBlacklist.map((upi, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#0c1220] rounded-xl border border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 font-semibold">{upi}</span>
                    <button
                      onClick={() => handleRemoveBlacklist(upi)}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {adminBlacklist.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">No records in the blacklist registry.</p>
                )}
              </div>
            </div>
          )}

          {adminActiveTab === 'merchants' && (
            <div className="bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Verified Merchant Registry ({adminMerchants.length})
              </h3>
              <form onSubmit={handleAddMerchant} className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 dark:bg-[#0c1220] p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                <input
                  type="text"
                  placeholder="UPI ID (e.g. outlet@sbi)"
                  value={newMerchantUpi}
                  onChange={(e) => setNewMerchantUpi(e.target.value)}
                  className="text-xs bg-white dark:bg-[#121929] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 outline-none"
                />
                <input
                  type="text"
                  placeholder="Outlet/Merchant Name"
                  value={newMerchantName}
                  onChange={(e) => setNewMerchantName(e.target.value)}
                  className="text-xs bg-white dark:bg-[#121929] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 outline-none"
                />
                <input
                  type="number"
                  placeholder="Trust Score (0-100)"
                  value={newMerchantScore}
                  onChange={(e) => setNewMerchantScore(e.target.value)}
                  className="text-xs bg-white dark:bg-[#121929] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 outline-none"
                />
                <select
                  value={newMerchantCategory}
                  onChange={(e) => setNewMerchantCategory(e.target.value)}
                  className="text-xs bg-white dark:bg-[#121929] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 outline-none"
                >
                  <option value="Retail">Retail</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Assistance">Assistance</option>
                </select>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl transition shadow flex items-center justify-center gap-1 col-span-2 md:col-span-1"
                >
                  <Plus className="w-4 h-4" /> Add Outlet
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 font-bold uppercase">
                      <th className="py-3 px-4">Merchant Outlet</th>
                      <th className="py-3 px-4">UPI Address</th>
                      <th className="py-3 px-4 text-center">Safety Rating</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Registry Loc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                    {adminMerchants.map((merchant, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3.5 px-4 font-bold">{merchant.name}</td>
                        <td className="py-3.5 px-4 font-mono text-blue-500">{merchant.upiId}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`font-bold px-2 py-0.5 rounded-full border ${
                            merchant.trustScore >= 80 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>{merchant.trustScore}%</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            merchant.isVerified ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'
                          }`}>{merchant.isVerified ? 'VERIFIED' : 'UNVERIFIED'}</span>
                        </td>
                        <td className="py-3.5 px-4">{merchant.location ? merchant.location.name : 'Central Database'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminActiveTab === 'logs' && (
            <div className="bg-white dark:bg-[#0e1424] border border-gray-200/80 dark:border-gray-800/80 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="font-bold text-base font-display text-gray-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-indigo-500" /> System Security Audit Logs
              </h3>
              <p className="text-xs text-gray-400">Chronological history of security events, administrative updates, and authentication audits.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-150 dark:border-gray-850 text-gray-400 font-bold uppercase">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Event / Action</th>
                      <th className="py-3 px-4">Performed By</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-850 text-gray-700 dark:text-gray-300">
                    {adminAuditLogs.map((log) => (
                      <tr key={log._id || log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            log.action.includes('Failed') || log.action.includes('Lockout') || log.action.includes('Unauthorized')
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}>{log.action}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{log.performedBy}</td>
                        <td className="py-3 px-4 max-w-xs truncate" title={log.details}>{log.details}</td>
                        <td className="py-3 px-4 font-mono text-[10px] text-gray-500">{log.ipAddress}</td>
                      </tr>
                    ))}
                    {adminAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-8 text-gray-400">No logs found on server.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  // Helper function to render mobile navigation tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-5 animate-fadeIn">
            {/* User Greeting Block */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Welcome Back</p>
                <h3 className="text-xl font-bold font-display mt-0.5 text-gray-900 dark:text-white">
                  {currentUser?.username || 'Guest'}
                </h3>
              </div>
              <button
                onClick={() => setReportModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> {t('reportScam')}
              </button>
            </div>

            {/* GPS Simulator Widget */}
            <div className="bg-white dark:bg-[#121929] border border-gray-200/70 dark:border-gray-800/80 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">{t('gpsLocation')}</span>
                <MapPin className="w-4 h-4 text-blue-500" />
              </div>
              <select
                value={JSON.stringify(currentGps)}
                onChange={(e) => setCurrentGps(JSON.parse(e.target.value))}
                className="w-full bg-gray-50 dark:bg-[#161f33] text-sm border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 outline-none"
              >
                {gpsLocations.map((loc, idx) => (
                  <option key={idx} value={JSON.stringify(loc)}>
                    {loc.name} ({loc.lat.toFixed(3)}, {loc.lng.toFixed(3)})
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-gray-400 mt-2 leading-relaxed">
                *Location testing: Change this drop-down to simulate scanning from different geographic locations.
              </p>
            </div>

            {/* Verification Result Display */}
            {latestScanResult ? (
              <RiskDial
                result={latestScanResult}
                onClose={() => setLatestScanResult(null)}
              />
            ) : (
              /* Scanning Actions Trigger */
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between aspect-square max-h-[300px]">
                <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-white/5 filter blur-2xl -mr-6 -mt-6"></div>
                <div>
                  <h4 className="font-extrabold text-xl font-display">Scan QR Safely</h4>
                  <p className="text-xs text-blue-100 mt-1 leading-normal">Our ML engine checks overlay stickers, domain blacklists, and GPS locations in real time.</p>
                </div>
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => {
                      const mockScannerResult = document.getElementById("mock-scanner-container");
                      if (mockScannerResult) mockScannerResult.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full bg-white hover:bg-gray-100 text-blue-600 font-bold text-sm py-3 px-5 rounded-2xl shadow transition flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Scan Merchant QR
                  </button>
                </div>
              </div>
            )}

            {/* Smart QR Scanner embed */}
            <div id="mock-scanner-container" className="pt-2">
              <QRScanner onScanSuccess={(res) => setLatestScanResult(res)} />
            </div>

            {/* Recent Scans Box */}
            <div className="border-t border-gray-100 dark:border-gray-800/80 pt-5">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm font-display">{t('recentScans')}</h4>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-xs text-blue-500 font-semibold hover:underline"
                >
                  View All
                </button>
              </div>
              
              <div className="space-y-3">
                {scanHistory.slice(0, 3).map((scan) => (
                  <button
                    key={scan.id || scan._id}
                    onClick={() => {
                      setSelectedScanDetail(scan);
                      setScanDetailModalOpen(true);
                    }}
                    className="w-full text-left bg-white dark:bg-[#111726] border border-gray-200/70 dark:border-gray-800/80 rounded-2xl p-4 transition-all hover:bg-gray-50/50 dark:hover:bg-slate-900/50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h5 className="font-bold text-xs font-display text-gray-900 dark:text-white truncate max-w-[150px]">
                        {scan.merchantName}
                      </h5>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[120px]">{scan.upiId}</p>
                      <span className="text-[9px] text-gray-400">{new Date(scan.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {scan.amount > 0 && <span className="text-xs font-bold text-gray-900 dark:text-white">₹{scan.amount}</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        scan.riskLevel === 'high'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : scan.riskLevel === 'medium'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {scan.riskScore}%
                      </span>
                    </div>
                  </button>
                ))}
                {scanHistory.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No recent scans logged.</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'history':
        return (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">{t('history')}</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search merchant or UPI ID..."
                className="w-full text-sm bg-white dark:bg-[#121929] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none"
              />
              <div className="flex gap-2">
                {['all', 'safe', 'medium', 'high'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setHistoryFilter(lvl)}
                    className={`text-xs font-semibold capitalize px-3.5 py-1.5 rounded-full border transition ${
                      historyFilter === lvl
                        ? 'bg-blue-600 border-blue-600 text-white shadow'
                        : 'bg-white dark:bg-[#121929] border-gray-200 dark:border-gray-800 text-gray-500'
                    }`}
                  >
                    {lvl === 'all' ? 'All Scans' : t(`risk${lvl.charAt(0).toUpperCase() + lvl.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredHistory.map((scan) => (
                <button
                  key={scan.id || scan._id}
                  onClick={() => {
                    setSelectedScanDetail(scan);
                    setScanDetailModalOpen(true);
                  }}
                  className="w-full text-left bg-white dark:bg-[#111726] border border-gray-200/70 dark:border-gray-800/80 rounded-2xl p-4 transition-all hover:bg-gray-50/50 dark:hover:bg-slate-900/50 flex items-center justify-between gap-3"
                >
                  <div>
                    <h5 className="font-bold text-sm font-display text-gray-900 dark:text-white truncate max-w-[200px]">
                      {scan.merchantName}
                    </h5>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[180px]">{scan.upiId}</p>
                    <span className="text-[10px] text-gray-400">{new Date(scan.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {scan.amount > 0 && <span className="text-sm font-bold text-gray-900 dark:text-white">₹{scan.amount}</span>}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      scan.riskLevel === 'high'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : scan.riskLevel === 'medium'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      {scan.riskScore}%
                    </span>
                  </div>
                </button>
              ))}
              {filteredHistory.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">No matching scans found.</p>
              )}
            </div>
          </div>
        );
      case 'chat':
        return (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">{t('assistant')}</h3>
            <SecurityChat />
          </div>
        );
      case 'hub':
        return (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">{t('hub')}</h3>

            {/* Quiz Section */}
            <div className="bg-white dark:bg-[#121929] border border-gray-200/70 dark:border-gray-800/80 p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                <h4 className="font-bold text-sm font-display">Cyber Security Awareness Quiz</h4>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">Test your knowledge of UPI fraud tricks to keep your digital money secure.</p>
              
              <div className="bg-gray-50 dark:bg-[#172033] p-4 rounded-xl border border-gray-200/40 dark:border-gray-800/60 mb-4">
                <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Question {quizIndex + 1} of {quizData.length}</span>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1 leading-relaxed">{quizData[quizIndex].q}</p>
              </div>

              <div className="space-y-2">
                {quizData[quizIndex].options.map((opt, idx) => (
                  <button
                    key={idx}
                    disabled={quizAnswered}
                    onClick={() => handleQuizAnswer(idx)}
                    className={`w-full text-left text-xs p-3 rounded-xl border transition ${
                      quizAnswered
                        ? idx === quizData[quizIndex].ans
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                          : quizSelectedOption === idx
                          ? 'bg-red-500/10 border-red-500 text-red-500'
                          : 'bg-white dark:bg-[#121929] border-gray-200 dark:border-gray-800 text-gray-400'
                        : 'bg-white dark:bg-[#121929] hover:bg-gray-50 dark:hover:bg-slate-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {quizAnswered && (
                <div className="mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-[11px] text-blue-600 dark:text-blue-400 leading-normal">
                  {quizData[quizIndex].expl}
                  <button
                    onClick={handleNextQuiz}
                    className="block mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                  >
                    {quizIndex === quizData.length - 1 ? 'Reset Quiz' : 'Next Question'}
                  </button>
                </div>
              )}
            </div>

            {/* Article Cards */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm font-display text-gray-900 dark:text-white">Security Insights</h4>
              <div className="border border-gray-200/60 dark:border-gray-800/80 rounded-2xl p-4 bg-white dark:bg-[#121929] space-y-2">
                <h5 className="font-bold text-xs text-blue-500">🛡️ Visual Overlays Detection</h5>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  Fraudsters print small QR code stickers and overlay them on shop display boards. Safe Scanner analyzes scanning margins and alerts you of mismatched merchant registration IDs before transactions.
                </p>
              </div>
              <div className="border border-gray-200/60 dark:border-gray-800/80 rounded-2xl p-4 bg-white dark:bg-[#121929] space-y-2">
                <h5 className="font-bold text-xs text-blue-500">💰 Refund Scams & UPI PINs</h5>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  Genuine refund desks will *never* request that you scan a QR or type your 4-6 digit UPI PIN to credit funds. PIN entry is solely used to authorize payments and deduct balances from your accounts.
                </p>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">{t('profile')}</h3>
            
            {/* Preferences */}
            <div className="bg-white dark:bg-[#121929] border border-gray-200/70 dark:border-gray-800/80 rounded-2xl p-4 space-y-4">
              <h4 className="font-bold text-sm font-display text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">Preferences</h4>
              
              {/* Language */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-500" /> Language
                </span>
                <div className="flex gap-1">
                  {['en', 'hi', 'te'].map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md transition ${
                        language === lang
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-gray-100 dark:bg-[#161f33] text-gray-500'
                      }`}
                    >
                      {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'తెలుగు'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1.5">
                  {darkMode ? <Moon className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-blue-500" />} Theme Mode
                </span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="bg-gray-100 dark:bg-[#161f33] text-xs font-semibold px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 transition text-gray-700 dark:text-gray-300"
                >
                  {darkMode ? t('darkMode') : t('lightMode')}
                </button>
              </div>

              {/* Voice Alerts */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1.5">
                  {voiceEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />} {t('voiceAlerts')}
                </span>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl border transition ${
                    voiceEnabled ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-gray-100 dark:bg-[#161f33] text-gray-500 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {voiceEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold text-xs py-3 rounded-2xl transition flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" /> {t('logout')}
            </button>

            <div className="text-center text-[10px] text-gray-400/80 mt-8 font-medium">
              Safe Scanner v1.1.0 • Security Hardened
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={darkMode ? 'dark text-[#f3f4f6]' : 'text-gray-900'}>
      {/* View Router */}
      {currentView === 'admin' ? renderAdminSide() : renderUserSide()}

      {/* COMMUNITY REPORT SCAM MODAL */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white dark:bg-[#111726] border border-gray-200 dark:border-gray-800/80 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-6 h-6 text-orange-500" /> {t('reportTitle')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Flag a fraud QR or spam UPI ID. Admin will evaluate and add to blacklist.</p>

            {reportSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl text-center text-emerald-500 text-sm font-semibold flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
                <span>Report Submitted. Thank you for securing our community!</span>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('reportFormUpi')}*</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. payment.fraud@paytm"
                    value={reportUpi}
                    onChange={(e) => setReportUpi(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-[#151d2e] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('reportFormName')}</label>
                  <input
                    type="text"
                    placeholder="e.g. Free Lottery Agent"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-[#151d2e] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('reportFormReason')}*</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details about the scam method..."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-[#151d2e] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 text-gray-500 font-bold text-xs py-3 rounded-xl border border-gray-250 dark:border-gray-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-3 rounded-xl shadow transition"
                  >
                    {t('reportSubmit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SCAN HISTORY DETAIL POPUP */}
      {scanDetailModalOpen && selectedScanDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white dark:bg-[#111726] border border-gray-200 dark:border-gray-800/80 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold font-display text-gray-900 dark:text-white mb-4 border-b border-gray-150 dark:border-gray-800 pb-2">Scan Transaction Log</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center bg-gray-50 dark:bg-[#0f1526] p-3 rounded-2xl border border-gray-100 dark:border-gray-850">
                <span className="text-xs text-gray-400">Trust Score</span>
                <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${
                  selectedScanDetail.riskLevel === 'high'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : selectedScanDetail.riskLevel === 'medium'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>{selectedScanDetail.riskScore || selectedScanDetail.riskScore === 0 ? selectedScanDetail.riskScore : selectedScanDetail.scan?.riskScore}%</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>Merchant Outlet:</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 text-right">{selectedScanDetail.merchantName}</span>
                <span>UPI Address:</span>
                <span className="font-mono text-blue-500 text-right">{selectedScanDetail.upiId}</span>
                <span>Scan Location:</span>
                <span className="text-right">{selectedScanDetail.location ? selectedScanDetail.location.name : 'Not logged'}</span>
                <span>Amount:</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 text-right">₹{selectedScanDetail.amount}</span>
                <span>Overlay Check:</span>
                <span className="text-right">{selectedScanDetail.tamperingDetected ? '🚨 Sticker Tampering Detected' : '✔ Normal Layout'}</span>
                <span>Voice Alert Broadcast:</span>
                <span className="text-right font-medium italic text-gray-500">"{selectedScanDetail.voiceMessage}"</span>
                <span>Scanned Date:</span>
                <span className="text-right">{new Date(selectedScanDetail.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setScanDetailModalOpen(false);
                setSelectedScanDetail(null);
              }}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow transition"
            >
              Close Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
