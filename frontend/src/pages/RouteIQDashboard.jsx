import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Train, Calendar, MapPin, ArrowLeft, Armchair, Sparkles, 
  CheckCircle2, Clock, Users, RefreshCw, X, Cpu, Zap, Activity, ShieldCheck, QrCode, AlertTriangle, Camera
} from 'lucide-react';
import api from '../api';

export default function RouteIQDashboard() {
  const [trains, setTrains] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState('');
  const [selectedClass, setSelectedClass] = useState('SL');
  
  // Simulation config sliders
  const [seniorMix, setSeniorMix] = useState(20);
  const [disabledMix, setDisabledMix] = useState(10);
  const [femaleMix, setFemaleMix] = useState(30);
  const [generalMix, setGeneralMix] = useState(40);
  const [density, setDensity] = useState(65);
  
  // Real stats from DB or calculated
  const [loading, setLoading] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState([]);
  const [occupancyRate, setOccupancyRate] = useState(65);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [emergencyAllocated, setEmergencyAllocated] = useState(0);
  
  // Route segments data
  const [routeSegments, setRouteSegments] = useState([
    { from: 'Bengaluru', to: 'Yesvantpur', density: 40, status: 'low' },
    { from: 'Yesvantpur', to: 'Nelamangala', density: 75, status: 'medium' },
    { from: 'Nelamangala', to: 'Kunigal', density: 95, status: 'high' },
    { from: 'Kunigal', to: 'Tumkur', density: 30, status: 'low' }
  ]);

  // Seat map state
  const [seatMap, setSeatMap] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState('A');
  const [activeBookings, setActiveBookings] = useState([]);
  const [scanningBookingId, setScanningBookingId] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchTrains();
  }, []);

  const fetchTrains = async () => {
    try {
      const res = await api.get('/seats/trains');
      setTrains(res.data);
      if (res.data.length > 0) {
        setSelectedTrain(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedTrain) {
      fetchSeatMap();
      fetchSimulationStats();
    }
  }, [selectedTrain, selectedCoach]);

  const fetchSeatMap = async () => {
    try {
      const res = await api.get(`/seats/map/${selectedTrain}`);
      const coachData = res.data.find(c => c.coach === selectedCoach);
      if (coachData) {
        setSeatMap(coachData.seats);
      }
      
      // Fetch bookings to find active bookings for scanning simulation
      const bookingsRes = await api.get('/admin/bookings').catch(() => ({ data: [] }));
      const activeForTrain = bookingsRes.data.filter(b => b.train_id === selectedTrain);
      setActiveBookings(activeForTrain);
      if (activeForTrain.length > 0 && !scanningBookingId) {
        setScanningBookingId(activeForTrain[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSimulationStats = async () => {
    try {
      const statsRes = await api.get('/admin/stats');
      const s = statsRes.data;
      if (s) {
        const total = s.total_seats || 416;
        const occupied = s.occupied || 0;
        const calculatedRate = Math.round((occupied / total) * 100) || density;
        setOccupancyRate(calculatedRate);
        setWaitlistCount(s.waitlisted || 0);
        
        // Calculate dynamic pricing multiplier
        if (calculatedRate >= 90) setSurgeMultiplier(1.5);
        else if (calculatedRate >= 75) setSurgeMultiplier(1.2);
        else if (calculatedRate < 25) setSurgeMultiplier(0.9);
        else setSurgeMultiplier(1.0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run AI Optimization simulation
  const handleRunSimulation = () => {
    setLoading(true);
    setSimulationLogs(['[RouteIQ] Initializing AI Seat Allocation Simulator...']);
    
    setTimeout(() => {
      setSimulationLogs(prev => [...prev, `[RouteIQ] Selecting train route config. Target density: ${density}%.`]);
    }, 500);

    setTimeout(() => {
      setSimulationLogs(prev => [...prev, `[RouteIQ] Distributing passenger priority matrix: Seniors P1 (${seniorMix}%), Disabled P2 (${disabledMix}%), Females P3 (${femaleMix}%), General P4 (${generalMix}%).`]);
    }, 1000);

    setTimeout(() => {
      // Calculate dynamic surge
      let calculatedSurge = 1.0;
      if (density >= 90) calculatedSurge = 1.5;
      else if (density >= 75) calculatedSurge = 1.2;
      else if (density < 25) calculatedSurge = 0.9;
      setSurgeMultiplier(calculatedSurge);
      
      setSimulationLogs(prev => [...prev, `[RouteIQ] Dynamic Seating Agent active. Surging fare pricing: ${calculatedSurge}x multiplier applied.`]);
    }, 1500);

    setTimeout(() => {
      setSimulationLogs(prev => [...prev, `[RouteIQ] Running leg-wise route optimization. Segment Nelamangala -> Kunigal reports high volume (95% density).`]);
      setRouteSegments([
        { from: 'Bengaluru', to: 'Yesvantpur', density: Math.max(10, density - 25), status: 'low' },
        { from: 'Yesvantpur', to: 'Nelamangala', density: Math.min(100, density + 10), status: 'medium' },
        { from: 'Nelamangala', to: 'Kunigal', density: Math.min(100, density + 30), status: 'high' },
        { from: 'Kunigal', to: 'Tumkur', density: Math.max(10, density - 35), status: 'low' }
      ]);
    }, 2000);

    setTimeout(() => {
      // Mock emergency reclaim
      const mockEmergencies = Math.round(density / 15);
      setEmergencyAllocated(mockEmergencies);
      setSimulationLogs(prev => [...prev, `[RouteIQ] Checked for no-shows. Conditionally re-allocated ${mockEmergencies} seats to standby passengers.`]);
    }, 2500);

    setTimeout(() => {
      setSimulationLogs(prev => [...prev, `[RouteIQ] AI Seating Optimization complete. Red (Booked), Green (Available), Blue (User selection) nodes synchronized.`]);
      setLoading(false);
      fetchSeatMap();
      fetchSimulationStats();
    }, 3000);
  };

  // Simulate Entry Scan (Gate Simulator)
  const handleEntryScan = async () => {
    if (!scanningBookingId) return;
    setScanResult(null);
    try {
      const res = await api.post(`/bookings/scan-entry/${scanningBookingId}`);
      setScanResult({ success: true, message: res.data.message });
      setSimulationLogs(prev => [...prev, `[Gate Scanner] Entry QR code successfully scanned. Seat ${res.data.seat} status updated to OCCUPIED (Red).`]);
      fetchSeatMap();
      fetchSimulationStats();
    } catch (err) {
      setScanResult({ success: false, message: err.response?.data?.detail || 'Scan failed' });
    }
  };

  // Simulate Exit Scan (Gate Simulator)
  const handleExitScan = async () => {
    if (!scanningBookingId) return;
    setScanResult(null);
    try {
      const res = await api.post(`/bookings/scan-exit/${scanningBookingId}`);
      setScanResult({ success: true, message: res.data.message });
      setSimulationLogs(prev => [...prev, `[Gate Scanner] Exit QR code scanned. Seat ${res.data.seat} is now VACANT (Green).`]);
      setSimulationLogs(prev => [...prev, `[AI Agent] Instantly auto-allocating seat ${res.data.seat} to next eligible passenger on waitlist.`]);
      fetchSeatMap();
      fetchSimulationStats();
    } catch (err) {
      setScanResult({ success: false, message: err.response?.data?.detail || 'Scan failed' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight block text-white">
                Train Seat RouteIQ
              </span>
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                Intelligent Capacity Optimization & Flow Simulator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Control panel sidebar (lg:col-span-4) */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-5">
            <h3 className="font-extrabold text-sm text-white border-b border-slate-900 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              Simulation Inputs
            </h3>

            {/* Select active train */}
            <div className="space-y-2">
              <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Select Train</label>
              <select
                value={selectedTrain}
                onChange={(e) => setSelectedTrain(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {trains.map(t => (
                  <option key={t.id} value={t.id}>{t.train_name} ({t.train_number})</option>
                ))}
              </select>
            </div>

            {/* Density slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Booking Density</label>
                <span className="text-xs font-extrabold text-indigo-400">{density}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Priority Mix sliders */}
            <div className="space-y-4 pt-3 border-t border-slate-900">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Passenger Priority Mix</span>
              
              {/* Seniors P1 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">Seniors (P1)</span>
                  <span className="font-bold text-slate-200">{seniorMix}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={seniorMix}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSeniorMix(val);
                    setGeneralMix(Math.max(0, 100 - val - disabledMix - femaleMix));
                  }}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Disabled P2 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">Disabled (P2)</span>
                  <span className="font-bold text-slate-200">{disabledMix}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={disabledMix}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDisabledMix(val);
                    setGeneralMix(Math.max(0, 100 - seniorMix - val - femaleMix));
                  }}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Females P3 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">Ladies (P3)</span>
                  <span className="font-bold text-slate-200">{femaleMix}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={femaleMix}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFemaleMix(val);
                    setGeneralMix(Math.max(0, 100 - seniorMix - disabledMix - val));
                  }}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* General P4 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">General (P4)</span>
                  <span className="font-bold text-slate-200">{generalMix}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={generalMix}
                  disabled={true}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-not-allowed accent-brand-500 opacity-60"
                />
              </div>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running AI Optimizer...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  Run AI Optimization
                </>
              )}
            </button>
          </div>

          {/* Workflow tracker block matching user handwritten diagram */}
          <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass space-y-4">
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Allocation Workflow Tracker
            </h4>
            
            <div className="space-y-2.5 pl-2 relative border-l border-slate-900">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-brand-500/10 border border-brand-500/30 text-[10px] text-brand-400 font-bold flex items-center justify-center rounded">1</span>
                <span className="text-slate-400">Register & Login</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-brand-500/10 border border-brand-500/30 text-[10px] text-brand-400 font-bold flex items-center justify-center rounded">2</span>
                <span className="text-slate-400">Profile & Aadhaar OCR Verification</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-brand-500/10 border border-brand-500/30 text-[10px] text-brand-400 font-bold flex items-center justify-center rounded">3</span>
                <span className="text-slate-400">Select Date & Run Allocation (P1-P5)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-brand-500/10 border border-brand-500/30 text-[10px] text-brand-400 font-bold flex items-center justify-center rounded">4</span>
                <span className="text-slate-400">Gate Entry QR Scan (Seat → Occupied)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-brand-500/10 border border-brand-500/30 text-[10px] text-brand-400 font-bold flex items-center justify-center rounded">5</span>
                <span className="text-slate-400">Gate Exit QR Scan (Seat → Vacated)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold flex items-center justify-center rounded">6</span>
                <span className="text-slate-300 font-semibold">AI Auto-allocates to Waitlist</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Gauges, Heatmaps, and Seat Grid (lg:col-span-8) */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* Gauges & Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Occupancy circular progress card */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass flex flex-col items-center justify-center space-y-3">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider text-center">Occupancy Rate</span>
              <div className="relative w-16 h-16 flex items-center justify-center">
                {/* SVG circular track */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" className="stroke-slate-900 stroke-2 fill-none" />
                  <circle 
                    cx="32" 
                    cy="32" 
                    r="28" 
                    className="stroke-indigo-500 stroke-2 fill-none transition-all duration-500" 
                    strokeDasharray="176" 
                    strokeDashoffset={176 - (176 * occupancyRate) / 100}
                  />
                </svg>
                <span className="absolute text-sm font-extrabold text-white">{occupancyRate}%</span>
              </div>
            </div>

            {/* Surge multiplier */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass flex flex-col items-center justify-center space-y-1.5 text-center">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Dynamic Pricing Surge</span>
              <span className="text-3xl font-extrabold text-indigo-400">{surgeMultiplier}x</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                surgeMultiplier > 1.2 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                surgeMultiplier > 1.0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                surgeMultiplier < 1.0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                'bg-slate-900 text-slate-500 border border-slate-800'
              }`}>
                {surgeMultiplier > 1.0 ? 'Surge Active' : surgeMultiplier < 1.0 ? 'Discount Active' : 'Base Fare'}
              </span>
            </div>

            {/* Waitlist count */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass flex flex-col items-center justify-center space-y-1.5 text-center">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Waitlist Queue</span>
              <span className="text-3xl font-extrabold text-amber-400">{waitlistCount}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Pending Passenger(s)</span>
            </div>

            {/* Emergency allocations */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass flex flex-col items-center justify-center space-y-1.5 text-center">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Emergency Allocated</span>
              <span className="text-3xl font-extrabold text-rose-400">{emergencyAllocated}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">No-shows Reclaimed</span>
            </div>
          </div>

          {/* Interactive track segment density map */}
          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-4">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-400" />
              Route Leg-wise Capacity Heatmap
            </h3>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-4 px-2">
              {routeSegments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  {/* Station node */}
                  <div className="flex flex-col items-center text-center space-y-1 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-md">
                      {seg.from.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">{seg.from}</span>
                  </div>

                  {/* Connecting track line */}
                  {idx < routeSegments.length && (
                    <div className="flex-1 w-full md:w-auto h-1.5 md:h-1 rounded-full relative bg-slate-900 overflow-hidden border border-slate-900/60 my-2 md:my-0 min-w-[60px]">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          seg.density >= 90 ? 'bg-rose-500 animate-pulse' :
                          seg.density >= 70 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} 
                        style={{ width: `${seg.density}%` }}
                      />
                      {/* Floating tooltip text on hover */}
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-extrabold text-white opacity-0 hover:opacity-100 bg-slate-950/80 transition-all cursor-pointer">
                        {seg.density}% density
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}
              
              {/* Final station node */}
              <div className="flex flex-col items-center text-center space-y-1 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-md">
                  T
                </div>
                <span className="text-[10px] font-bold text-slate-300">Tumkur</span>
              </div>
            </div>
          </div>

          {/* Interactive seat inspector grid */}
          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-4 gap-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Seat Status Grid Inspector</h3>
                <p className="text-xs text-slate-500 mt-0.5">Click a coach to review seat layouts color-coded by the flowchart legend.</p>
              </div>

              {/* Coach select tabs */}
              <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                {['A', 'B', 'C', 'D', 'E', 'F'].map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCoach(c)}
                    className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center transition-all ${
                      selectedCoach === c 
                        ? 'bg-brand-600 text-white' 
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Flowchart Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pb-2 border-b border-slate-900">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-emerald-500/15 border border-emerald-500/30"></div>
                <span className="text-emerald-400 font-bold">Green:</span> Seat Booking Availability (Available)
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-rose-500/15 border border-rose-500/30"></div>
                <span className="text-rose-400 font-bold">Red:</span> Already Booked / Occupied / Locked
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-500"></div>
                <span className="text-blue-400 font-bold">Blue:</span> Your Selection / May Book / Cancel
              </div>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-8 gap-2.5 max-w-md mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-900">
              {seatMap.map(seat => {
                const isAvailable = seat.status === 'AVAILABLE';
                
                let seatBg = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                if (isAvailable) {
                  seatBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer';
                }

                return (
                  <div
                    key={seat.id}
                    className={`aspect-square rounded-xl border text-[10px] font-extrabold flex flex-col items-center justify-center transition-all ${seatBg}`}
                  >
                    <Armchair className="w-3.5 h-3.5 mb-0.5" />
                    {seat.number.split('-')[1]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive QR scanning simulation simulator */}
          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Gate Scanning simulation panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-brand-400" />
                  Live Gate QR Scanner Simulation
                </h4>
                <Link
                  to="/scanner"
                  className="px-2.5 py-1 border border-indigo-500/25 hover:border-indigo-500/40 rounded-lg text-indigo-400 hover:text-indigo-300 text-[10px] font-bold flex items-center gap-1 bg-indigo-500/5 transition-all shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Webcam Scanner
                </Link>
              </div>
              
              <div className="space-y-3">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Select Active Booking ID</label>
                <select
                  value={scanningBookingId}
                  onChange={(e) => setScanningBookingId(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  {activeBookings.length === 0 ? (
                    <option value="">No active bookings found</option>
                  ) : (
                    activeBookings.map(b => (
                      <option key={b.id} value={b.id}>{b.passenger_name} ({b.train_number} - {b.seat_number || 'Waitlisted'})</option>
                    ))
                  )}
                </select>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleEntryScan}
                    disabled={!scanningBookingId}
                    className="py-2.5 bg-brand-600/10 hover:bg-brand-600/25 border border-brand-500/20 text-brand-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Scan Entry Gate
                  </button>
                  <button
                    onClick={handleExitScan}
                    disabled={!scanningBookingId}
                    className="py-2.5 bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    Scan Exit Gate
                  </button>
                </div>

                {scanResult && (
                  <div className={`p-3 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${
                    scanResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                  }`}>
                    {scanResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{scanResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Simulation Logger stream console */}
            <div className="space-y-3.5 flex flex-col">
              <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                AI Agent Allocation Logic Stream
              </h4>
              
              <div className="flex-1 bg-slate-950 p-4 rounded-2xl border border-slate-900 font-mono text-[10px] text-indigo-400/90 overflow-y-auto max-h-[160px] space-y-1.5 shadow-inner">
                {simulationLogs.length === 0 ? (
                  <span className="text-slate-600 italic">No simulation logs. Click 'Run AI Optimization' to trigger.</span>
                ) : (
                  simulationLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed break-all">
                      <span className="text-slate-600 mr-1.5">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
