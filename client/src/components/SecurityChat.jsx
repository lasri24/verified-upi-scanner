import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Send, Bot, User, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';

const SecurityChat = () => {
  const { t, API_BASE_URL } = useContext(AppContext);
  const [messages, setMessages] = useState([
    {
      id: 'msg_init',
      sender: 'bot',
      text: "Hello! I am your AI Chat Security Assistant. Ask me anything about UPI scams, QR tampering, or general online safety tips."
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const faqPrompts = [
    "What is a QR overlay scam?",
    "Never scan QR to receive money?",
    "How to report scam QR?",
    "What does Safe Score mean?"
  ];

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text.trim()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: data.reply
          }
        ]);
      } else {
        throw new Error("Chat api failed");
      }
    } catch (err) {
      console.warn("Chat API unreachable. Falling back to local responder.");
      // Client-side regex fallback
      setTimeout(() => {
        const reply = getLocalBotResponse(text);
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: reply
          }
        ]);
      }, 600);
    } finally {
      setLoading(false);
    }
  };

  const getLocalBotResponse = (text) => {
    const q = text.toLowerCase();
    if (q.includes('overlay') || q.includes('sticker') || q.includes('tamper')) {
      return "An overlay scam is when fraudsters place fake QR stickers on top of a merchant's genuine standee. Always double check if the sticker is peeling off or feels thicker than usual!";
    } else if (q.includes('receive') || q.includes('refund') || q.includes('lottery') || q.includes('scratch')) {
      return "⚠️ **CRITICAL SECURITY RULE:** Scanning a QR code is exclusively to SEND money. You NEVER need to scan a QR code or enter your UPI PIN to receive money, refunds, lottery wins, or cashback.";
    } else if (q.includes('report') || q.includes('flag')) {
      return "You can use the 'Report Fraud' page in Safe Scanner. Fill in their UPI ID and submit a report. Our system evaluates reports, and if verified, adds the address to our global database.";
    } else if (q.includes('score') || q.includes('color')) {
      return "Our Safe Score: \n🟢 **Safe (80-100%)**: Genuine verified profile.\n🟡 **Medium (50-79%)**: Newly registered user.\n🔴 **High Risk (0-49%)**: Known reported user or physical tampering flag.";
    }
    return "To protect yourself: \n1. Always verify the merchant name displayed in your UPI app before typing your PIN.\n2. Do not scan links shared on WhatsApp or social media.\n3. Turn on Voice Alerts in Safe Scanner settings to hear fraud signals instantly.";
  };

  return (
    <div className="flex flex-col h-[520px] max-w-2xl mx-auto glass-panel rounded-3xl border shadow-xl overflow-hidden">
      {/* Bot Title Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base font-display flex items-center gap-1">
              AI Security Shield <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
            </h3>
            <p className="text-[10px] text-blue-100">UPI Fraud & Cyber Security Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-300">Online</span>
        </div>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-[#0a0f1d]/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-gray-700 dark:bg-gray-800'}`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-blue-400" />}
              </div>
              <div
                className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-[#161e30] border border-gray-100 dark:border-gray-800/80 rounded-tl-none text-gray-800 dark:text-gray-200'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-2 max-w-[85%]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 dark:bg-gray-800 text-white">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="p-3 bg-white dark:bg-[#161e30] border border-gray-100 dark:border-gray-800/80 rounded-2xl rounded-tl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Grid */}
      <div className="p-3 bg-white dark:bg-[#0c1222] border-t border-gray-100 dark:border-gray-800/60">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {faqPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-600 border border-blue-500/20 dark:border-blue-400/20 px-3 py-1.5 rounded-full flex-shrink-0 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Message input area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="p-3 bg-white dark:bg-[#111726] border-t border-gray-100 dark:border-gray-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('chatPlaceholder')}
          className="flex-1 text-sm bg-gray-50 dark:bg-[#161f33] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default SecurityChat;
