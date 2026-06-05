import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ShieldCheck, AlertTriangle, ShieldAlert, MapPin, Landmark, Award, EyeOff } from 'lucide-react';

const RiskDial = ({ result, onClose }) => {
  const { t } = useContext(AppContext);
  if (!result || !result.scan) return null;

  const { scan, reasons, engine, merchant } = result;
  const score = scan.riskScore;
  const level = scan.riskLevel;

  // Circular gauge values
  const radius = 60;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Color mappings
  const getColorClasses = () => {
    if (level === 'high') {
      return {
        text: 'text-red-500',
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        border: 'border-red-500/20 dark:border-red-500/40',
        stroke: 'stroke-red-500',
        icon: <ShieldAlert className="w-12 h-12 text-red-500" />
      };
    } else if (level === 'medium') {
      return {
        text: 'text-amber-500',
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        border: 'border-amber-500/20 dark:border-amber-500/40',
        stroke: 'stroke-amber-500',
        icon: <AlertTriangle className="w-12 h-12 text-amber-500" />
      };
    } else {
      return {
        text: 'text-emerald-500',
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        border: 'border-emerald-500/20 dark:border-emerald-500/40',
        stroke: 'stroke-emerald-500',
        icon: <ShieldCheck className="w-12 h-12 text-emerald-500" />
      };
    }
  };

  const currentColors = getColorClasses();

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 max-w-xl mx-auto border shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-3xl opacity-20 -mr-10 -mt-10 ${level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display">{t('verifySuccess')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('appName')} AI Engine: <span className="font-semibold text-blue-500">{engine}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 transition"
        >
          Close
        </button>
      </div>

      {/* Circle Gauge Row */}
      <div className="flex flex-col md:flex-row items-center justify-around gap-6 mb-8">
        <div className="relative flex items-center justify-center">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            {/* Background Track */}
            <circle
              className="stroke-gray-200 dark:stroke-gray-800"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Active Arc */}
            <circle
              className={`${currentColors.stroke} transition-all duration-1000 ease-out`}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-extrabold font-display leading-none">{score}%</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">Safe Score</span>
          </div>
        </div>

        {/* Level and Alerts Card */}
        <div className="flex-1 w-full">
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${currentColors.bg} ${currentColors.border} mb-3`}>
            {currentColors.icon}
            <div>
              <h4 className="font-bold text-lg leading-tight capitalize font-display">
                {level === 'safe' ? t('riskSafe') : level === 'medium' ? t('riskMedium') : t('riskHigh')}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {scan.voiceMessage}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Parameters Checklist */}
      <div className="grid grid-cols-2 gap-3 mb-6 bg-gray-50 dark:bg-[#0c1220] p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center gap-2">
          <Landmark className={`w-4 h-4 ${scan.upiId.includes('scammer') ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-xs font-medium">Database Blacklist</span>
        </div>
        <div className="flex items-center gap-2">
          <EyeOff className={`w-4 h-4 ${scan.tamperingDetected ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-xs font-medium">Tampering Overlay</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className={`w-4 h-4 ${reasons.some(r => r.includes('GPS')) ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-xs font-medium">GPS Location Check</span>
        </div>
        <div className="flex items-center gap-2">
          <Award className={`w-4 h-4 ${merchant && merchant.isVerified ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-xs font-medium">Merchant verification</span>
        </div>
      </div>

      {/* Explanations & Reasons */}
      {reasons && reasons.length > 0 ? (
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detailed Risk Analysis</h4>
          <ul className="space-y-2">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300">
                <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-6 flex gap-2 items-start text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>No security risks found. UPI merchant ID matches verified credentials and registration patterns. It is safe to proceed.</span>
        </div>
      )}

      {/* Decoded UPI Details Panel */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4 text-xs space-y-2 text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>{t('merchantDetails')}</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{scan.merchantName}</span>
        </div>
        <div className="flex justify-between">
          <span>UPI Address</span>
          <span className="font-semibold font-mono text-blue-500">{scan.upiId}</span>
        </div>
        {scan.amount > 0 && (
          <div className="flex justify-between">
            <span>Amount Requested</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">₹{scan.amount}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Date</span>
          <span>{new Date(scan.timestamp).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RiskDial;
