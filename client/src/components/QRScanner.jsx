import React, { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Camera, Upload, AlertCircle, RefreshCw, Layers, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess }) => {
  const { t, verifyUpiQr, currentGps } = useContext(AppContext);
  const [cameraPermission, setCameraPermission] = useState('unknown'); // unknown, granted, denied
  const [cameraActive, setCameraActive] = useState(false);
  const [tamperingSimulated, setTamperingSimulated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const qrCodeReaderRef = useRef(null);
  const scannerContainerId = "reader-viewport";

  // Preset scenarios to make testing super easy for presentation
  const presets = [
    {
      name: "1. Verified Outlet (Safe)",
      upiString: "upi://pay?pa=grocery@okaxis&pn=Ram's%20Grocery%20Store&am=250&tn=Fruits%20and%20Veg",
      tamper: false,
      desc: "Registered 450 days ago. trust score 95%. Safe.",
      color: "border-emerald-500 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
    },
    {
      name: "2. Blacklisted Account (High Risk)",
      upiString: "upi://pay?pa=scammer@okaxis&pn=Lucky%20Prize%20Disbursal&am=0&tn=Processing%20Fee",
      tamper: false,
      desc: "UPI ID matches known fraud database. Instant alert.",
      color: "border-red-500 hover:bg-red-500/5 text-red-600 dark:text-red-400"
    },
    {
      name: "3. Sticker Overlay (Tampered QR)",
      upiString: "upi://pay?pa=fastpay.agent@paytm&pn=FastPay%20Cashier&am=0&tn=Store%20Checkout",
      tamper: true,
      desc: "Scanner visual checks flag an overlay sticker over original QR.",
      color: "border-orange-500 hover:bg-orange-500/5 text-orange-600 dark:text-orange-400"
    },
    {
      name: "4. New Account (Medium Risk)",
      upiString: "upi://pay?pa=win.prize@ybl&pn=Lottery%20Desk%20Gifts&am=1000&tn=Activation",
      tamper: false,
      desc: "Registered 1 day ago, unverified merchant, mismatch location.",
      color: "border-amber-500 hover:bg-amber-500/5 text-amber-600 dark:text-amber-400"
    }
  ];

  // Start Camera QR Scanner
  const startCamera = async () => {
    setErrorMessage('');
    try {
      setCameraActive(true);
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameraPermission('granted');
        const qrScanner = new Html5Qrcode(scannerContainerId);
        qrCodeReaderRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            // QR Scanned Successfully
            stopCamera();
            handleVerify(decodedText, tamperingSimulated);
          },
          (errorMessage) => {
            // Silence noise messages
          }
        );
      } else {
        setErrorMessage("No camera devices detected on this system.");
        setCameraActive(false);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMessage("Could not initialize camera. Ensure browser camera permission is allowed.");
      setCameraPermission('denied');
      setCameraActive(false);
    }
  };

  // Stop Camera QR Scanner
  const stopCamera = async () => {
    if (qrCodeReaderRef.current && qrCodeReaderRef.current.isScanning) {
      try {
        await qrCodeReaderRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (qrCodeReaderRef.current && qrCodeReaderRef.current.isScanning) {
        qrCodeReaderRef.current.stop();
      }
    };
  }, []);

  // Handle file upload scanning
  const handleFileUpload = (e) => {
    setErrorMessage('');
    const file = e.target.files[0];
    if (!file) return;

    const qrScanner = new Html5Qrcode(scannerContainerId);
    qrScanner.scanFile(file, true)
      .then((decodedText) => {
        handleVerify(decodedText, tamperingSimulated);
      })
      .catch((err) => {
        console.error("File decode error:", err);
        setErrorMessage("Could not decode any QR code from the uploaded image. Make sure the image is clear and contains a valid QR.");
      });
  };

  // Perform API Verification and send to page
  const handleVerify = async (upiString, isTampered) => {
    const res = await verifyUpiQr(upiString, isTampered);
    if (res && onScanSuccess) {
      onScanSuccess(res);
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold font-display text-gray-900 dark:text-white">{t('scanner')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Scan a merchant QR code to verify security scores and credentials.
        </p>
      </div>

      {/* Camera Window */}
      <div className="relative aspect-square w-full max-w-[340px] mx-auto bg-gray-100 dark:bg-slate-900/60 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center">
        {/* HTML5 QR Container */}
        <div id={scannerContainerId} className={`w-full h-full absolute top-0 left-0 ${cameraActive ? 'block' : 'hidden'}`}></div>

        {/* Scanner Laser effect */}
        {cameraActive && (
          <div className="absolute left-[10%] right-[10%] h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] scanner-laser z-20"></div>
        )}

        {!cameraActive && (
          <div className="text-center p-6 flex flex-col items-center gap-3 z-10">
            <Camera className="w-12 h-12 text-gray-400 dark:text-slate-600 animate-pulse" />
            <button
              onClick={startCamera}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition shadow"
            >
              {t('scanBtnText')}
            </button>
            <p className="text-[10px] text-gray-400">Uses HTML5 canvas parser</p>
          </div>
        )}

        {cameraActive && (
          <button
            onClick={stopCamera}
            className="absolute bottom-4 z-30 bg-red-500/90 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-full transition shadow"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 p-3.5 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* File Upload Selector & Options */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 justify-between">
        
        {/* File Upload */}
        <label className="flex-1 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#121929] rounded-xl px-4 py-3 cursor-pointer transition flex items-center justify-center gap-3 text-sm font-semibold">
          <Upload className="w-4 h-4 text-blue-500" />
          <span>{t('uploadBtnText')}</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Sticker Overlay Simulation Toggle */}
        <button
          onClick={() => setTamperingSimulated(!tamperingSimulated)}
          className={`flex-1 border rounded-xl px-4 py-3 transition flex items-center justify-center gap-2 text-sm font-semibold ${
            tamperingSimulated
              ? 'border-orange-500/50 bg-orange-500/10 text-orange-500'
              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#121929]'
          }`}
        >
          <Layers className={`w-4 h-4 ${tamperingSimulated ? 'animate-bounce' : 'text-gray-400'}`} />
          <span>Simulate Tampering Overlay</span>
        </button>
      </div>

      {/* Presets Simulator Section */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('presetScanText')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleVerify(p.upiString, p.tamper)}
              className={`border rounded-2xl p-3 text-left transition duration-200 hover:shadow ${p.color}`}
            >
              <div className="font-bold text-xs font-display flex items-center gap-1.5 justify-between">
                <span>{p.name}</span>
                {p.tamper && <span className="bg-orange-500/10 text-orange-500 text-[9px] px-1.5 py-0.5 rounded-full border border-orange-500/20">Tampered</span>}
              </div>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
