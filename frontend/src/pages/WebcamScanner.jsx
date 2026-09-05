import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, QrCode, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, X, Play, Square } from 'lucide-react';
import axios from 'axios';

export default function WebcamScanner() {
  const [hasLoadedScript, setHasLoadedScript] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  // Scanning results
  const [scannedData, setScannedData] = useState(null); // booking ID or parsed details
  const [bookingDetails, setBookingDetails] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const scannerRef = useRef(null);
  const navigate = useNavigate();

  const apiPublic = axios.create({
    baseURL: window.location.origin
  });

  // Load html5-qrcode library from CDN
  useEffect(() => {
    if (window.Html5Qrcode) {
      setHasLoadedScript(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => {
      setHasLoadedScript(true);
    };
    script.onerror = () => {
      setCameraError("Failed to load QR scanner library. Check your network.");
    };
    document.body.appendChild(script);

    return () => {
      // Clean up scanning if active
      stopScanner();
    };
  }, []);

  const startScanner = () => {
    if (!hasLoadedScript || !window.Html5Qrcode) return;
    
    setCameraError(null);
    setScannedData(null);
    setBookingDetails(null);
    setScanResult(null);
    setScanning(true);

    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("webcam-reader");
        scannerRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: "environment" }, // Rear camera if mobile, default if laptop
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            // QR Code scanned successfully!
            handleQrSuccess(decodedText);
          },
          (errorMessage) => {
            // silent fail for frame scans
          }
        ).catch(err => {
          console.error(err);
          setCameraError("Camera access denied or no camera found. Please enable permissions in Chrome.");
          setScanning(false);
        });
      } catch (e) {
        console.error(e);
        setCameraError("Failed to initialize camera scanner.");
        setScanning(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        setScanning(false);
      }).catch(err => {
        console.error(err);
        setScanning(false);
      });
    } else {
      setScanning(false);
    }
  };

  // Parse scanned text and get booking ID
  const handleQrSuccess = async (decodedText) => {
    stopScanner(); // Stop scanning once we detect a code
    
    let bookingId = "";
    
    // Check if the decoded text is a URL containing /scan-gate/
    if (decodedText.includes('/scan-gate/')) {
      const parts = decodedText.split('/scan-gate/');
      bookingId = parts[parts.length - 1];
    } else if (decodedText.startsWith('BOOKING:')) {
      // Parse raw text BOOKING:uuid|SEAT:...
      const parts = decodedText.split('|');
      bookingId = parts[0].replace('BOOKING:', '');
    } else {
      // Try to treat whole text as UUID
      bookingId = decodedText.trim();
    }

    setScannedData(bookingId);
    fetchScannedBooking(bookingId);
  };

  const fetchScannedBooking = async (id) => {
    try {
      const res = await apiPublic.get('/admin/bookings');
      const found = res.data.find(b => b.id === id);
      if (found) {
        setBookingDetails(found);
      } else {
        setCameraError("Scanned code does not match any booking ID in database.");
      }
    } catch (err) {
      setCameraError("Failed to verify scanned booking details.");
    }
  };

  const executeScanAction = async (type) => {
    if (!scannedData) return;
    setActionLoading(true);
    setScanResult(null);
    try {
      const endpoint = type === 'entry' 
        ? `/bookings/scan-entry/${scannedData}` 
        : `/bookings/scan-exit/${scannedData}`;
      const res = await apiPublic.post(endpoint);
      setScanResult({ success: true, message: res.data.message });
      
      // Update details
      fetchScannedBooking(scannedData);
    } catch (err) {
      setScanResult({ success: false, message: err.response?.data?.detail || 'Gate check failed' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Camera className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block text-white">
                Chrome Webcam QR Scanner
              </span>
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">
                Simulate gate scan using laptop webcam
              </span>
            </div>
          </div>
          <Link 
            to="/route-iq" 
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Simulator
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 flex flex-col space-y-6 justify-center">
        
        {/* Camera Scanner Box */}
        <div className="bg-glass-bright p-5 rounded-3xl border border-slate-800 shadow-2xl space-y-5 text-center relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <span className="text-xs font-bold text-slate-400">Webcam Feed</span>
            {scanning && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-bold uppercase animate-pulse">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Scanning Live...
              </span>
            )}
          </div>

          {/* Scanner Video Area */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative">
            <div id="webcam-reader" className="w-full h-full"></div>
            
            {!scanning && !scannedData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-950 p-4">
                <QrCode className="w-12 h-12 text-slate-700" />
                <p className="text-xs text-slate-500 max-w-xs">
                  Click 'Start Camera Scanner' below and hold up a booking QR code to your webcam.
                </p>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          <div className="flex gap-3 justify-center">
            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={!hasLoadedScript}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                Start Camera Scanner
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="px-6 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Square className="w-4 h-4" />
                Stop Scanner
              </button>
            )}
          </div>

          {/* Camera Error banner */}
          {cameraError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Scanned Details Ticket View */}
        {bookingDetails && (
          <div className="bg-glass p-5 rounded-3xl border border-slate-900 space-y-4 animate-in slide-in-from-bottom-3 duration-250">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Decoded Boarding Pass Info
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Passenger</span>
                <span className="font-bold text-slate-200">{bookingDetails.passenger_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Train Route</span>
                <span className="font-semibold text-slate-200">{bookingDetails.train_name} ({bookingDetails.train_number})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Seat Node</span>
                <span className="font-extrabold text-indigo-400">Coach {bookingDetails.coach || 'WL'} / Seat {bookingDetails.seat_number || 'WL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking Status</span>
                <span className="font-bold text-white uppercase">{bookingDetails.status}</span>
              </div>
            </div>

            {/* Scan Action Controls */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => executeScanAction('entry')}
                disabled={actionLoading}
                className="py-2.5 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Scan Entry Check-in
              </button>
              <button
                onClick={() => executeScanAction('exit')}
                disabled={actionLoading}
                className="py-2.5 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Scan Exit Check-out
              </button>
            </div>

            {/* Action Output */}
            {scanResult && (
              <div className={`p-3 rounded-xl border text-center text-xs font-semibold flex items-center justify-center gap-2 ${
                scanResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
              }`}>
                {scanResult.success ? <CheckCircle2 className="w-4.5 h-4.5" /> : <AlertTriangle className="w-4.5 h-4.5" />}
                <span>{scanResult.message}</span>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
