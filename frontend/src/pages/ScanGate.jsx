import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Train, QrCode, CheckCircle, X, Shield, Activity, RefreshCw, Check, AlertTriangle, ArrowRight, User, MapPin, Calendar } from 'lucide-react';
import axios from 'axios';

export default function ScanGate() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Confirmation dialog states
  const [confirmType, setConfirmType] = useState(null); // 'entry' or 'exit'

  const apiPublic = axios.create({
    baseURL: window.location.origin
  });

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiPublic.get(`/bookings/public-details/${bookingId}`);
      if (res.data) {
        setBooking(res.data);
      } else {
        setError("Invalid Ticket: Booking not found in database.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch booking details. Please verify your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const executeScan = async (type) => {
    setActionLoading(true);
    setScanMessage(null);
    setConfirmType(null); // Close confirmation dialog
    try {
      const endpoint = type === 'entry' 
        ? `/bookings/scan-entry/${bookingId}` 
        : `/bookings/scan-exit/${bookingId}`;
      const res = await apiPublic.post(endpoint);
      setScanMessage({ success: true, message: res.data.message });
      
      // Reload booking state
      fetchBookingDetails();
    } catch (err) {
      setScanMessage({ success: false, message: err.response?.data?.detail || 'Scan request failed' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-slate-400 text-sm">Loading Ticket Details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full mb-4">
          <X className="w-8 h-8 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Ticket Check Failed</h3>
        <p className="text-slate-400 text-sm max-w-xs">{error}</p>
        <button 
          onClick={fetchBookingDetails}
          className="mt-6 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-semibold rounded-xl"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md p-4 sticky top-0 z-40">
        <div className="flex items-center justify-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold text-sm text-white tracking-wider uppercase">
            AI Station Gate Scanner
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col justify-between space-y-6">
        
        <div className="space-y-6">
          {/* E-Ticket Display */}
          <div className="bg-glass-bright rounded-3xl border border-slate-800/80 overflow-hidden shadow-2xl relative">
            {/* Top status bar */}
            <div className="px-5 py-4 bg-slate-900/60 border-b border-slate-900 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-300">Train Seating Ticket</span>
              </div>
              <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${
                booking?.status === 'confirmed' || booking?.status === 'CONFIRMED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : booking?.status === 'OCCUPIED'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {booking?.status}
              </span>
            </div>

            {/* Ticket details */}
            <div className="p-6 space-y-5">
              {/* Train Name and Number */}
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Train Service</span>
                <span className="text-base font-extrabold text-white block mt-0.5">
                  {booking?.train_name}
                </span>
                <span className="text-[11px] text-indigo-400 font-mono">#{booking?.train_number}</span>
              </div>

              {/* Station Route Leg */}
              <div className="grid grid-cols-5 items-center bg-slate-950 p-3 rounded-2xl border border-slate-900/80">
                <div className="col-span-2 text-left">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">From</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">{booking?.source_station}</span>
                </div>
                <div className="col-span-1 flex justify-center text-slate-600">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">To</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">{booking?.destination_station}</span>
                </div>
              </div>

              {/* Passenger and seat details */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Passenger</span>
                  <span className="text-xs font-bold text-slate-300 block mt-0.5 truncate">
                    {booking?.passenger_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Seating Node</span>
                  <span className="text-xs font-bold text-indigo-400 block mt-0.5">
                    Coach {booking?.coach || 'WL'} / Seat {booking?.seat_number || 'Waitlisted'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket barcode effect decorative */}
            <div className="px-6 py-3 bg-slate-900/30 border-t border-slate-900 flex justify-between items-center">
              <span className="text-[9px] font-mono text-slate-600">UID: {bookingId.slice(0, 18)}...</span>
              <span className="text-[9px] text-slate-500 font-semibold uppercase">Scan sandbox ticket</span>
            </div>
          </div>

          {/* Scan result alert banner */}
          {scanMessage && (
            <div className={`p-4 rounded-2xl border text-center text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
              scanMessage.success 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
            }`}>
              {scanMessage.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{scanMessage.message}</span>
            </div>
          )}
        </div>

        {/* Dynamic Action Area: Confirmation Dialog (Yes/No) or Primary Scan Buttons */}
        <div className="space-y-4">
          {confirmType ? (
            /* Confirmation Popup/Prompt (Yes/No) */
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="text-center space-y-1.5">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Confirm Gate Action
                </h4>
                <p className="text-xs text-slate-400">
                  Do you want to confirm the <strong>{confirmType === 'entry' ? 'Entry' : 'Exit'}</strong> QR scan for seat <strong>{booking?.seat_number || 'Waitlist'}</strong>?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmType(null)}
                  disabled={actionLoading}
                  className="py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  No, Cancel
                </button>
                <button
                  onClick={() => executeScan(confirmType)}
                  disabled={actionLoading}
                  className={`py-3 text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 ${
                    confirmType === 'entry' 
                      ? 'bg-emerald-600 hover:bg-emerald-500' 
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Yes, Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Standard gate trigger buttons */
            <div className="space-y-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center block">
                Select station gate option below
              </span>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmType('entry')}
                  disabled={actionLoading}
                  className="py-3.5 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Scan Entry Gate
                </button>
                <button
                  onClick={() => setConfirmType('exit')}
                  disabled={actionLoading}
                  className="py-3.5 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Scan Exit Gate
                </button>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-[10px] text-slate-600 border-t border-slate-900/60 mt-auto">
        Train Seat AI Security Sandbox
      </footer>
    </div>
  );
}
