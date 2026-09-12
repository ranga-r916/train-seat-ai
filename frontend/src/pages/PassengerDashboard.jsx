import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Train, AlertTriangle, CheckCircle, CheckCircle2, Clock, Upload, 
  QrCode, LogOut, ArrowRight, MessageSquare, Send, Bot, RefreshCw, X, Cpu, Zap, Camera, Scan, FileText, ShieldCheck, Download
} from 'lucide-react';
import api from '../api';
import { compressImage } from '../utils/imageCompressor';

export default function PassengerDashboard() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Aadhaar upload states
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [aadhaarSuccessModal, setAadhaarSuccessModal] = useState(false);
  const [verifiedDetails, setVerifiedDetails] = useState(null);
  const [demoType, setDemoType] = useState('real');
  
  // Aadhaar scanning modes (camera / upload / apk)
  const [aadhaarModalOpen, setAadhaarModalOpen] = useState(false);
  const [scanMethod, setScanMethod] = useState('upload'); // 'upload' | 'camera' | 'apk'
  const [apkScanText, setApkScanText] = useState('');
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);

  // Scan simulation states
  const [scanMessage, setScanMessage] = useState(null);

  // Chatbot states
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am your Train Seat AI Assistant. How can I help you with your daily commute booking today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserData();

    // 🚀 Real-time Live Sync: poll bookings every 2 seconds
    // So when passenger scans entry on phone, laptop dashboard updates to OCCUPIED simultaneously!
    const pollInterval = setInterval(() => {
      silentPollBookings();
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      stopCameraScanner();
    };
  }, []);

  const silentPollBookings = async () => {
    try {
      const bookingsRes = await api.get('/bookings/my');
      setBookings(bookingsRes.data);
    } catch (e) {
      // Ignore background poll errors
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // 1. Get Me
      const userRes = await api.get('/auth/me');
      setUser(userRes.data);
      localStorage.setItem('user', JSON.stringify(userRes.data));

      // 2. Get Bookings
      const bookingsRes = await api.get('/bookings/my');
      setBookings(bookingsRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data. Please log in again.');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Start live camera QR scanner for Aadhaar Card
  const startCameraScanner = () => {
    setCameraError('');
    setCameraScanning(true);

    const initScanner = () => {
      try {
        if (!window.Html5Qrcode) {
          setCameraError('Camera scanner library not ready. Please check your internet connection.');
          setCameraScanning(false);
          return;
        }
        const html5QrCode = new window.Html5Qrcode('aadhaar-camera-reader');
        scannerRef.current = html5QrCode;
        html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            stopCameraScanner();
            await handleAadhaarScanVerify(decodedText);
          },
          (err) => {}
        ).catch(err => {
          console.error(err);
          setCameraError('Camera access denied. Please allow camera permissions in your browser.');
          setCameraScanning(false);
        });
      } catch (err) {
        console.error(err);
        setCameraError('Failed to initialize camera scanner.');
        setCameraScanning(false);
      }
    };

    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = initScanner;
      script.onerror = () => {
        setCameraError('Failed to load camera scanner library.');
        setCameraScanning(false);
      };
      document.body.appendChild(script);
    } else {
      setTimeout(initScanner, 150);
    }
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            setCameraScanning(false);
          }).catch(() => setCameraScanning(false));
        } else {
          setCameraScanning(false);
        }
      } catch (e) {
        setCameraScanning(false);
      }
    } else {
      setCameraScanning(false);
    }
  };

  // Verify from QR Code or Official Scanner APK output
  const handleAadhaarScanVerify = async (textData) => {
    setUploading(true);
    setOcrError('');
    try {
      const res = await api.post('/auth/verify-aadhaar-scan', {
        qr_data: textData
      });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setVerifiedDetails(res.data);
      setAadhaarSuccessModal(true);
      setAadhaarModalOpen(false);
      setApkScanText('');
      fetchUserData();
    } catch (err) {
      console.error(err);
      setOcrError(err.response?.data?.detail || 'Aadhaar scan parsing failed.');
    } finally {
      setUploading(false);
    }
  };

  // Upload Aadhaar Card for OCR & auto-fill
  const handleAadhaarUpload = async (e) => {
    e.preventDefault();
    if (!aadhaarFile) return;

    setUploading(true);
    setOcrError('');
    
    try {
      // Instant client-side compression: shrinks high-res phone camera images down to ~150KB in 50ms
      const optimizedFile = await compressImage(aadhaarFile, 1200, 0.82);
      
      const formData = new FormData();
      formData.append('file', optimizedFile);

      const response = await api.post('/auth/verify-aadhaar', formData, {
        headers: { 
          'X-Demo-Type': demoType
        }
      });
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      setVerifiedDetails(response.data);
      setAadhaarSuccessModal(true);
      setAadhaarModalOpen(false);
      setAadhaarFile(null);
      fetchUserData();
    } catch (err) {
      console.error('Aadhaar verification error:', err);
      const detailMsg = err.response?.data?.detail || err.message || 'Aadhaar verification failed. Please try again with a clear photo or PDF.';
      setOcrError(detailMsg);
    } finally {
      setUploading(false);
    }
  };

  const [downloadingTicketId, setDownloadingTicketId] = useState(null);

  // Download official PDF ticket
  const handleDownloadTicketPdf = async (bookingId) => {
    setDownloadingTicketId(bookingId);
    try {
      const response = await api.get(`/bookings/ticket-pdf/${bookingId}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Train_Ticket_${bookingId.slice(0, 8).toUpperCase()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.open(`/bookings/ticket-pdf/${bookingId}`, '_blank');
    } finally {
      setDownloadingTicketId(null);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking? A refund will be processed.')) return;
    
    try {
      await api.delete(`/bookings/cancel/${bookingId}`);
      fetchUserData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel booking');
    }
  };

  // Simulation: Scan QR at Entry Gate
  const simulateEntryScan = async (bookingId) => {
    setScanMessage(null);
    try {
      const res = await api.post(`/bookings/scan-entry/${bookingId}`);
      setScanMessage({ success: true, message: res.data.message });
      fetchUserData();
    } catch (err) {
      setScanMessage({ success: false, message: err.response?.data?.detail || 'Scan failed' });
    }
  };

  // Simulation: Scan QR at Exit Gate
  const simulateExitScan = async (bookingId) => {
    setScanMessage(null);
    try {
      const res = await api.post(`/bookings/scan-exit/${bookingId}`);
      setScanMessage({ success: true, message: res.data.message });
      fetchUserData();
    } catch (err) {
      setScanMessage({ success: false, message: err.response?.data?.detail || 'Scan failed' });
    }
  };

  // Chatbot Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage;
    const newMessages = [...messages, { sender: 'user', text: userMessage }];
    setMessages(newMessages);
    setInputMessage('');

    // Append thinking bubble
    setMessages(prev => [...prev, { sender: 'bot', text: 'Thinking...', loading: true }]);

    try {
      const res = await api.post('/auth/chatbot', { message: userMessage });
      const botResponse = res.data.response;
      const actionTaken = res.data.action_taken;

      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { sender: 'bot', text: botResponse }];
      });

      if (actionTaken) {
        // Reload data if chatbot books or cancels seats
        fetchUserData();
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { sender: 'bot', text: 'Error: Failed to connect to Seating Assistant. Please check your network or try again.' }];
      });
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-slate-400">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-xl">
              <Train className="w-6 h-6 text-brand-400" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-300">
              Train Seat AI
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden md:inline">
              Welcome, <strong className="text-white">{user?.name}</strong>
            </span>
            <Link 
              to="/route-iq" 
              className="px-3.5 py-1.5 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5 rounded-xl text-indigo-400 hover:text-indigo-300 transition-all text-xs font-semibold flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" />
              RouteIQ Simulator
            </Link>
            <Link 
              to="/architecture" 
              className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              System Architecture
            </Link>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-800 hover:border-rose-500/30 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Alerts for gate scan simulation */}
        {scanMessage && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            scanMessage.success 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}>
            <span className="text-sm font-medium">{scanMessage.message}</span>
            <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!user?.aadhaar_verified ? (
          <div className="max-w-2xl w-full mx-auto space-y-8 py-6">
            <div className="bg-glass p-8 rounded-3xl border border-slate-900 shadow-glass text-center space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit mx-auto text-amber-400">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-white">Identity Verification Required</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  To prevent ticket reservation abuse, lock priority berths, and activate your train booking profile, please scan your Aadhaar card.
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950/60 rounded-2xl border border-slate-900 text-left mt-4">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Full Name</span>
                  <span className="text-sm font-bold text-white block truncate mt-0.5">{user?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Age</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{user?.age || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Gender</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{user?.gender}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Disability</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{user?.priority === 'P2_DISABLED' ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="bg-glass p-8 rounded-3xl border border-slate-900 shadow-glass space-y-6">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-400" />
                Upload Aadhaar Card Document
              </h3>
              <p className="text-xs text-slate-400">
                AI Agent will run OCR extraction to match details. If they match, your account is activated instantly!
              </p>

              {ocrError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                  ❌ {ocrError}
                </div>
              )}

              {user?.is_flagged_for_review && (
                <div className="p-3.5 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl">
                  ⚠️ Mismatch flagged: Entered name/age/gender does not match Aadhaar OCR text. Admin manual review pending.
                </div>
              )}

              {/* Demo Simulator Mode */}
              <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider">
                  🧪 Sandbox Demo Simulation Mode
                </label>
                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  Choose Real AI Scan for automatic OCR extraction from genuine Aadhaar card, or select a sandbox simulation test:
                </p>
                <select
                  value={demoType}
                  onChange={(e) => setDemoType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="real">🔍 Real AI Aadhaar OCR & Barcode Scan (Strict Validation)</option>
                  <option value="valid_senior">🧪 Sandbox Simulation: Senior Citizen (Age 68 - Priority Tier 1)</option>
                  <option value="valid_disabled">🧪 Sandbox Simulation: Disability Concession (Tier 2)</option>
                  <option value="mismatch_name">🧪 Sandbox Simulation: Force Name Mismatch</option>
                </select>
              </div>

              <form onSubmit={handleAadhaarUpload} className="space-y-6">
                <div className="border border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-brand-500/50 transition-all cursor-pointer bg-slate-900/10">
                  <input 
                    type="file" 
                    accept="image/*,application/pdf,.pdf" 
                    required
                    onChange={(e) => setAadhaarFile(e.target.files[0])}
                    className="hidden" 
                    id="aadhaar-input" 
                  />
                  <label htmlFor="aadhaar-input" className="w-full text-center cursor-pointer">
                    <QrCode className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                    <span className="text-sm text-slate-300 block font-medium">
                      {aadhaarFile ? aadhaarFile.name : 'Select Aadhaar Card (PDF or Photo)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      PDF Document, PNG, JPG, or Camera photo up to 10MB
                    </span>
                  </label>
                </div>

                <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-2xl text-xs text-brand-300/90 leading-relaxed">
                  💡 <strong>Sandbox Demo Mode</strong>: Since this is a test sandbox, uploading any image file will auto-verify your name and details using mock dynamic OCR generation.
                </div>

                <button
                  type="submit"
                  disabled={uploading || !aadhaarFile}
                  className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      AI Agent parsing Aadhaar OCR...
                    </>
                  ) : (
                    <>
                      Submit for OCR Verification
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Profile & Aadhaar OCR */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Passenger Profile Card */}
            <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-brand-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{user?.name}</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>

              {/* Aadhaar Scanned Identity Particulars */}
              <div className="space-y-4 pt-4 border-t border-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Identity Columns
                  </span>
                  {user?.aadhaar_verified ? (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Aadhaar Verified
                    </span>
                  ) : user?.is_flagged_for_review ? (
                    <span className="text-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Mismatch Flagged
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      Unverified
                    </span>
                  )}
                </div>

                {/* Scanned Columns Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Full Name</span>
                    <span className="font-bold text-white text-xs block truncate mt-0.5">
                      {user?.verified_name || user?.name}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Verified Age</span>
                    <span className="font-bold text-white text-xs block mt-0.5">
                      {user?.age ? `${user.age} Years` : 'Not Available'}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Gender</span>
                    <span className="font-bold text-white text-xs block mt-0.5">
                      {user?.gender || 'Not Available'}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Priority Tier</span>
                    <span className={`font-bold text-xs block mt-0.5 ${
                      user?.priority === 'P1_SENIOR' ? 'text-amber-400' :
                      user?.priority === 'P2_DISABLED' ? 'text-indigo-400' :
                      user?.priority === 'P3_FEMALE' ? 'text-pink-400' :
                      'text-slate-300'
                    }`}>
                      {user?.priority?.replace('_', ' ') || 'P4 GENERAL'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOcrError('');
                    setAadhaarModalOpen(true);
                  }}
                  className="w-full mt-2 py-2.5 px-3 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Scan className="w-3.5 h-3.5" />
                  {user?.aadhaar_verified ? 'Re-Scan / Update from Aadhaar' : 'Scan & Verify Aadhaar Card'}
                </button>
              </div>
            </div>

            {/* Aadhaar Image Upload Box */}
            {!user?.aadhaar_verified && (
              <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-brand-400" />
                  Aadhaar Card Scanner
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Upload Aadhaar image to verify Name, Age, Gender and automatically compute your Seating Priority.
                </p>

                {ocrError && (
                  <div className="p-3 mb-4 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                    {ocrError}
                  </div>
                )}

                {user?.is_flagged_for_review && (
                  <div className="p-3.5 mb-4 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl">
                    ⚠️ Mismatch flagged: Entered name/age/gender does not match Aadhaar OCR text. Admin manual review pending.
                  </div>
                )}

                <form onSubmit={handleAadhaarUpload} className="space-y-4">
                  <div className="border border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-brand-500/50 transition-all cursor-pointer bg-slate-900/10">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf,.pdf" 
                      required
                      onChange={(e) => setAadhaarFile(e.target.files[0])}
                      className="hidden" 
                      id="aadhaar-input" 
                    />
                    <label htmlFor="aadhaar-input" className="w-full text-center cursor-pointer">
                      <QrCode className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <span className="text-xs text-slate-300 block font-medium">
                        {aadhaarFile ? aadhaarFile.name : 'Select Aadhaar Card (PDF or Photo)'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        PDF Document, PNG, JPG, or Camera photo up to 10MB
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !aadhaarFile}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        AI Agent processing OCR...
                      </>
                    ) : (
                      <>
                        Submit to AI Agent
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
            
            {/* Quick Link to book */}
            {user?.aadhaar_verified && (
              <Link 
                to="/book" 
                className="block p-5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-3xl shadow-glass-bright transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-brand-200 block font-medium">Ready to travel?</span>
                    <span className="font-bold text-white text-base">Book Train Seat Now</span>
                  </div>
                  <div className="p-2 bg-white/10 rounded-xl text-white group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            )}

            {/* AI Seating Engine Workflow Card */}
            <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Cpu className="w-5 h-5 text-brand-400" />
                AI Seating Engine Workflow
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Your commute booking passes through these security & optimization steps:
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/20 text-[10px] font-bold text-brand-400 flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">Ticket Request Received</h4>
                    <p className="text-[10px] text-slate-500 font-sans">Route & stations parsed directionally.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">AI Priority Processing</h4>
                    <p className="text-[10px] text-slate-500 font-sans">Aadhaar OCR extracts details to assign Priority score.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">Smart Seat Allocation</h4>
                    <p className="text-[10px] text-slate-500 font-sans">Allocates adjacent seats, capping coaches at 95% capacity.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">Database Update & Lock</h4>
                    <p className="text-[10px] text-slate-500 font-sans">Saves booking details and locks the seat registry.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Bookings list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Train className="w-5 h-5 text-brand-400" />
                Your Booking History
              </h2>
              {user?.aadhaar_verified && (
                <Link to="/book" className="text-brand-400 hover:text-brand-300 font-semibold text-sm flex items-center gap-1">
                  New Booking <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {bookings.length === 0 ? (
              <div className="bg-glass rounded-3xl p-12 border border-slate-900 text-center flex flex-col items-center justify-center">
                <Clock className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="font-bold text-lg text-slate-300 mb-1">No bookings found</h3>
                <p className="text-sm text-slate-400 max-w-sm">
                  {!user?.aadhaar_verified 
                    ? 'Verify your Aadhaar card first to unlock train seat bookings!' 
                    : 'Click "New Booking" to search and book local trains.'}
                </p>
                {user?.aadhaar_verified && (
                  <Link to="/book" className="mt-5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all">
                    Book Your First Seat
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-glass rounded-3xl border border-slate-900 overflow-hidden shadow-glass hover:border-slate-800 transition-all">
                    {/* Header info */}
                    <div className="p-5 bg-slate-900/30 border-b border-slate-900 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-white">{b.train_name}</div>
                        <span className="text-xs text-slate-500">|</span>
                        <div className="text-xs text-slate-400">{b.journey_date}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {b.waitlist_position ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Waitlisted ({b.waitlist_position})
                          </span>
                        ) : (b.status === 'OCCUPIED' || b.status === 'occupied' || b.entry_scanned) ? (
                          <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            OCCUPIED (BOARDED)
                          </span>
                        ) : (b.status === 'completed' || b.status === 'COMPLETED' || b.exit_scanned) ? (
                          <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            COMPLETED (EXITED)
                          </span>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            b.status === 'confirmed' || b.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            b.status === 'cancelled' || b.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {b.status.toUpperCase()}
                          </span>
                        )}
                        {b.is_emergency && (
                          <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/25 rounded-full text-[10px] font-bold">
                            CONDITIONAL EMERGENCY
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Booking Card Grid details */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="space-y-4">
                        <div>
                          <span className="text-slate-500 text-xs uppercase block">Route</span>
                          <span className="font-semibold text-sm text-slate-200">
                            {b.source_station} → {b.destination_station}
                          </span>
                        </div>
                        
                        <div className="flex gap-8">
                          <div>
                            <span className="text-slate-500 text-xs uppercase block">Coach</span>
                            <span className="font-bold text-lg text-white">{b.coach || 'WL'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs uppercase block">Seat</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-lg text-white">{b.seat_number || 'None'}</span>
                              {(b.status === 'OCCUPIED' || b.status === 'occupied' || b.entry_scanned) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider animate-pulse">
                                  OCCUPIED
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs uppercase block">Fare</span>
                            <span className="font-bold text-lg text-brand-400">₹{b.fare}</span>
                          </div>
                        </div>
                      </div>

                      {/* QR Display */}
                      <div className="flex flex-col items-center justify-center md:border-l md:border-r border-slate-900 px-4">
                        {b.qr_code ? (
                          <>
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
                                  ? `https://undo-ivory-family-guidelines.trycloudflare.com/scan-gate/${b.id}`
                                  : window.location.origin + `/scan-gate/${b.id}`
                              )}`} 
                              alt="Journey QR" 
                              className="w-24 h-24 bg-white p-1.5 rounded-xl mb-2" 
                            />
                            <span className="text-[10px] text-slate-500">Scan at Station Gate</span>
                          </>
                        ) : (
                          <div className="w-24 h-24 bg-slate-950/80 border border-slate-800 flex items-center justify-center rounded-xl text-center p-2 text-[10px] text-slate-500 mb-2">
                            {b.status === 'cancelled' ? 'Refunded' : 'QR Assigned upon Waitlist Release'}
                          </div>
                        )}
                      </div>

                      {/* Actions Panel */}
                      <div className="space-y-3.5 flex flex-col justify-center">
                        {/* Download Official Ticket PDF */}
                        {b.status !== 'cancelled' && b.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleDownloadTicketPdf(b.id)}
                            disabled={downloadingTicketId === b.id}
                            className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            {downloadingTicketId === b.id ? 'Generating PDF...' : 'Download Ticket (PDF)'}
                          </button>
                        )}

                        {/* Simulation Check-ins */}
                        {((b.status === 'confirmed' || b.status === 'CONFIRMED' || b.status === 'OCCUPIED' || b.status === 'occupied' || b.entry_scanned) && !b.exit_scanned && b.status !== 'COMPLETED') && (
                          <div className="space-y-2">
                            <span className="text-slate-500 text-[10px] font-bold uppercase block text-center md:text-left">
                              Gate Simulator
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {(b.status === 'OCCUPIED' || b.status === 'occupied' || b.entry_scanned) ? (
                                <button
                                  disabled
                                  className="py-2 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-xl font-bold flex items-center justify-center gap-1 opacity-80 cursor-default"
                                >
                                  ✓ Entry Scanned
                                </button>
                              ) : (
                                <button
                                  onClick={() => simulateEntryScan(b.id)}
                                  className="py-2 px-3 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs rounded-xl font-semibold transition-all hover:scale-95"
                                >
                                  Scan Entry
                                </button>
                              )}
                              <button
                                onClick={() => simulateExitScan(b.id)}
                                className={`py-2 px-3 text-xs rounded-xl font-semibold transition-all hover:scale-95 ${
                                  (b.status === 'OCCUPIED' || b.status === 'occupied' || b.entry_scanned)
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 animate-pulse'
                                    : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                                }`}
                              >
                                Scan Exit
                              </button>
                            </div>
                          </div>
                        )}

                        {(b.status === 'COMPLETED' || b.status === 'completed' || b.exit_scanned) && (
                          <div className="text-center p-2.5 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Journey Completed (Exited) 🎉
                          </div>
                        )}

                        {/* Cancellations */}
                        {(b.status === 'confirmed' || b.status === 'CONFIRMED' || b.status === 'pending' || b.status === 'PENDING') && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="w-full py-2.5 border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95"
                          >
                            Cancel Booking (Refund)
                          </button>
                        )}
                        
                        {b.status === 'CANCELLED' && (
                          <div className="text-center p-2.5 bg-rose-950/10 rounded-2xl border border-rose-950/15 text-xs text-rose-400/80 font-medium">
                            Cancelled & Refunded 💸
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>

      {/* Floating AI Chatbot Widget */}
      {user?.aadhaar_verified && (
        <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="w-[22rem] sm:w-[24rem] h-[28rem] bg-glass-bright rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Chat header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-brand-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">AI Seating Assistant</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages box */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
                    m.sender === 'user' 
                      ? 'bg-brand-600 text-white rounded-tr-none' 
                      : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none whitespace-pre-line'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-950/80 border-t border-slate-900 flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about priorities, waitlist, no-shows..."
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500"
              />
              <button 
                type="submit" 
                className="p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="p-4 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-lg hover:shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2 group animate-bounce"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-semibold text-sm">
              Ask AI Seating
            </span>
          </button>
        )}
      </div>
      )}

      {/* Aadhaar Verification Success Modal */}
      {aadhaarSuccessModal && verifiedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setAadhaarSuccessModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 animate-bounce">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg">Aadhaar OCR Verified!</h3>
                <p className="text-xs text-slate-400">AI Seating Engine processed your card successfully.</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Name</span>
                  <span className="font-bold text-white text-xs truncate block mt-0.5">{verifiedDetails.name}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Age</span>
                  <span className="font-bold text-white text-xs block mt-0.5">{verifiedDetails.age} Yrs</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Gender</span>
                  <span className="font-bold text-white text-xs block mt-0.5">{verifiedDetails.gender}</span>
                </div>
              </div>
              <hr className="border-slate-900 my-1" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Allocated Priority Tier:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  verifiedDetails.priority === 'P1_SENIOR' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  verifiedDetails.priority === 'P2_DISABLED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  verifiedDetails.priority === 'P3_FEMALE' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {verifiedDetails.priority.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 text-xs text-slate-400 space-y-2 text-left">
              <span className="font-extrabold text-[10px] uppercase text-slate-500 block mb-1">AI Seating Priority Order:</span>
              <div className="flex justify-between items-center text-[11px]">
                <span className={verifiedDetails.priority === 'P1_SENIOR' ? "text-amber-400 font-extrabold" : ""}>1. Senior Citizen (Age &ge; 60)</span>
                <span className={verifiedDetails.priority === 'P1_SENIOR' ? "text-amber-400 font-extrabold text-[10px]" : "text-slate-600 text-[10px]"}>Highest Priority (Tier 1)</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className={verifiedDetails.priority === 'P2_DISABLED' ? "text-indigo-400 font-extrabold" : ""}>2. Differently-Abled (Concession Card)</span>
                <span className={verifiedDetails.priority === 'P2_DISABLED' ? "text-indigo-400 font-extrabold text-[10px]" : "text-slate-600 text-[10px]"}>Priority Tier 2</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className={verifiedDetails.priority === 'P3_FEMALE' ? "text-pink-400 font-extrabold" : ""}>3. Ladies Special</span>
                <span className={verifiedDetails.priority === 'P3_FEMALE' ? "text-pink-400 font-extrabold text-[10px]" : "text-slate-600 text-[10px]"}>Priority Tier 3</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className={verifiedDetails.priority === 'P4_GENERAL' ? "text-slate-300 font-extrabold" : ""}>4. General Passenger (Male/Others)</span>
                <span className={verifiedDetails.priority === 'P4_GENERAL' ? "text-slate-300 font-extrabold text-[10px]" : "text-slate-600 text-[10px]"}>Standard</span>
              </div>
            </div>

            <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-2xl text-xs text-brand-300 leading-relaxed text-left">
              <strong>Seating Allocation Benefit:</strong><br />
              {verifiedDetails.priority === 'P1_SENIOR' && "Verified age is 60+. You qualify for priority Lower Berth placement and exits in Coach A."}
              {verifiedDetails.priority === 'P2_DISABLED' && "Verified medical concession card. You qualify for wheelchair accessible spaces and lower berths in Coach A."}
              {verifiedDetails.priority === 'P3_FEMALE' && "Verified female commuter. You qualify for placement inside the dedicated Safety Zone (Coach B)."}
              {verifiedDetails.priority === 'P4_GENERAL' && "Verified general commuter. Standard seat search rules apply."}
            </div>

            <button
              onClick={() => setAadhaarSuccessModal(false)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              Done & Start Booking
            </button>
          </div>
        </div>
      )}
      {/* Aadhaar Multi-Mode Scanner Modal */}
      {aadhaarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => {
                stopCameraScanner();
                setAadhaarModalOpen(false);
              }}
              className="absolute top-5 right-5 p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-brand-400">
                <Scan className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg">Official Aadhaar Scanner</h3>
                <p className="text-xs text-slate-400">Scan your Aadhaar card to auto-fill details into your profile</p>
              </div>
            </div>

            {ocrError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                ❌ {ocrError}
              </div>
            )}

            {/* Scan Method Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  setScanMethod('camera');
                  setTimeout(startCameraScanner, 100);
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === 'camera' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Camera
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  setScanMethod('upload');
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === 'upload' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  setScanMethod('apk');
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === 'apk' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Scan APK
              </button>
            </div>

            {/* Method 1: Camera Scanner */}
            {scanMethod === 'camera' && (
              <div className="space-y-4 text-center">
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800">
                  <div 
                    id="aadhaar-camera-reader" 
                    className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-brand-500/30 min-h-[220px] bg-black flex items-center justify-center"
                  >
                    {!cameraScanning && (
                      <span className="text-xs text-slate-500 p-4">Camera viewfinder will appear here</span>
                    )}
                  </div>
                  {cameraError && (
                    <p className="text-xs text-rose-400 mt-2">{cameraError}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">
                    Point your camera directly at the Aadhaar QR code or card barcode.
                  </p>
                </div>
                <div className="flex gap-2">
                  {!cameraScanning ? (
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Camera className="w-4 h-4" /> Start Camera Scan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCameraScanner}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      Stop Camera
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Method 2: File Upload */}
            {scanMethod === 'upload' && (
              <form onSubmit={handleAadhaarUpload} className="space-y-4">
                <div className="border border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-brand-500/50 transition-all cursor-pointer bg-slate-900/10">
                  <input 
                    type="file" 
                    accept="image/*,application/pdf,.pdf" 
                    required
                    onChange={(e) => setAadhaarFile(e.target.files[0])}
                    className="hidden" 
                    id="modal-aadhaar-input" 
                  />
                  <label htmlFor="modal-aadhaar-input" className="w-full text-center cursor-pointer">
                    <QrCode className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <span className="text-xs text-slate-300 block font-medium">
                      {aadhaarFile ? aadhaarFile.name : 'Choose Aadhaar Card (PDF or Photo)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      PDF Document, PNG, JPG, or Camera photo up to 10MB
                    </span>
                  </label>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    🧪 Verification Type Simulation:
                  </span>
                  <select
                    value={demoType}
                    onChange={(e) => setDemoType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-brand-500"
                  >
                    <option value="real">🔍 Real AI Aadhaar OCR & Barcode Scan (Strict Validation)</option>
                    <option value="valid_senior">🧪 Sandbox Simulation: Senior Citizen (Age 68 - Priority Tier 1)</option>
                    <option value="valid_disabled">🧪 Sandbox Simulation: Disability Concession (Tier 2)</option>
                    <option value="mismatch_name">🧪 Sandbox Simulation: Force Name Mismatch</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !aadhaarFile}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Scanning & Filling Details...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      Scan & Fill Details from Card
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Method 3: Official Scanner APK Text Input */}
            {scanMethod === 'apk' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Official Scanner APK Output / Barcode Data:
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Paste the text or XML scanned by an official Aadhaar barcode scanner APK (e.g. mAadhaar, Barcode Scanner, or UIDAI app):
                  </p>
                  <textarea
                    rows={4}
                    value={apkScanText}
                    onChange={(e) => setApkScanText(e.target.value)}
                    placeholder={`e.g. <PrintLetterBarcodeData uid="482930194820" name="${user?.name || 'Ranganath R'}" dob="15/05/1998" gender="M" ... />`}
                    className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Generate official XML template matching the user for instant 1-click test
                      const mockXml = `<PrintLetterBarcodeData uid="482930194820" name="${user?.name || 'Ranganath R'}" gender="${(user?.gender || 'Male').charAt(0).toUpperCase()}" dob="15/05/1996" yob="1996" co="S/O Ramaswamy" vtc="Bengaluru" state="Karnataka" pc="560001" />`;
                      setApkScanText(mockXml);
                    }}
                    className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px] font-semibold border border-slate-800 transition-all"
                  >
                    Sample Official XML
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const seniorXml = `<PrintLetterBarcodeData uid="782190341258" name="${user?.name || 'Ranganath R'}" gender="M" dob="12/04/1958" yob="1958" co="S/O Govindappa" vtc="Tumakuru" state="Karnataka" pc="572101" />`;
                      setApkScanText(seniorXml);
                    }}
                    className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all"
                  >
                    Sample Senior XML
                  </button>
                </div>

                <button
                  type="button"
                  disabled={uploading || !apkScanText.trim()}
                  onClick={() => handleAadhaarScanVerify(apkScanText)}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing Scan & Updating Profile...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      Auto-Fill Details & Verify
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
