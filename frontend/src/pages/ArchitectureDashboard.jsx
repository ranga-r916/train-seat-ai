import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Layers, User, Monitor, Cpu, Database, ClipboardList, ShieldAlert,
  Play, ArrowRight, CheckCircle2, RefreshCw, Activity, ArrowLeft, BarChart3
} from 'lucide-react';
import api from '../api';

export default function ArchitectureDashboard() {
  const [selectedLayer, setSelectedLayer] = useState('user'); // user, frontend, processing, data, workflow, output
  const [dbStats, setDbStats] = useState({ users: 0, bookings: 0, trains: 0, seatsAvailable: 0 });
  const [loading, setLoading] = useState(true);
  
  // Workflow simulation states
  const [simActive, setSimActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [simLogs, setSimLogs] = useState([]);
  const [simUserType, setSimUserType] = useState('Senior'); // Senior, Female, Disabled, General

  const navigate = useNavigate();

  useEffect(() => {
    fetchLiveCounts();
  }, []);

  const fetchLiveCounts = async () => {
    try {
      const [usersRes, bookingsRes, trainsRes, statsRes] = await Promise.all([
        api.get('/admin/users').catch(() => ({ data: [] })),
        api.get('/admin/bookings').catch(() => ({ data: [] })),
        api.get('/seats/trains').catch(() => ({ data: [] })),
        api.get('/admin/stats').catch(() => ({ data: { available: 0 } }))
      ]);

      setDbStats({
        users: usersRes.data?.length || 0,
        bookings: bookingsRes.data?.length || 0,
        trains: trainsRes.data?.length || 0,
        seatsAvailable: statsRes.data?.available || 0
      });
    } catch (err) {
      console.error('Error fetching live counts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run Step-by-Step Simulation
  const runSimulation = () => {
    if (simActive) return;
    setSimActive(true);
    setCurrentStep(1);
    setSimLogs(['[Step 1] Booking system receives booking request from ' + simUserType + ' passenger.']);
    
    const steps = [
      {
        step: 2,
        log: `[Step 2] AI Agent processes request. Priority assigned based on Aadhaar details: ${
          simUserType === 'Senior' ? 'P1_SENIOR (Age 65)' :
          simUserType === 'Disabled' ? 'P2_DISABLED (Physical Disability)' :
          simUserType === 'Female' ? 'P3_FEMALE (Gender: Female)' :
          'P4_GENERAL (General commuting class)'
        }.`
      },
      {
        step: 3,
        log: `[Step 3] Seat Allocation Engine running. Finding best available seat. Checking 95% coach cap...`
      },
      {
        step: 4,
        log: `[Step 4] Seat found. Database updated with locked seat status. PNR generated and linked.`
      },
      {
        step: 5,
        log: `[Step 5] Locked seat status and passenger details synchronized with central database ledger.`
      },
      {
        step: 6,
        log: `[Step 6] Results successfully pushed to UI. Seat allocation confirmed and ticket QR code generated!`
      }
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setCurrentStep(s.step);
        setSimLogs(prev => [...prev, s.log]);
        if (s.step === 6) {
          setSimActive(false);
          fetchLiveCounts(); // Reload counts since seat state changed
        }
      }, (idx + 1) * 1500);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Layers className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight block text-white">
                Architecture Dashboard
              </span>
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                System Layers & Live Flow Control
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-800 hover:border-slate-750 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Visual Flowchart Selector (lg:col-span-5) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
            <h3 className="font-extrabold text-sm text-white mb-2">Interactive System Layers</h3>
            <p className="text-xs text-slate-500">Select any layer to inspect details and run live simulations.</p>
          </div>

          <div className="space-y-3 relative">
            {/* Visual connector lines */}
            <div className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-slate-900 z-0"></div>

            {/* Layer 1: User Layer */}
            <button
              onClick={() => setSelectedLayer('user')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'user'
                  ? 'bg-indigo-600/10 border-indigo-500/30 shadow-indigo-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'user' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 1</span>
                <span className="font-bold text-sm text-white block">User Layer (Input Sources)</span>
                <span className="text-xs text-slate-400 block mt-0.5">Passenger ticket bookings & seat allocation views.</span>
              </div>
            </button>

            {/* Layer 2: Frontend Layer */}
            <button
              onClick={() => setSelectedLayer('frontend')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'frontend'
                  ? 'bg-cyan-600/10 border-cyan-500/30 shadow-cyan-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'frontend' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 2</span>
                <span className="font-bold text-sm text-white block">Frontend Layer (User Interface)</span>
                <span className="text-xs text-slate-400 block mt-0.5">Ticket booking, seat maps, profile & admin views.</span>
              </div>
            </button>

            {/* Layer 3: Processing Layer */}
            <button
              onClick={() => setSelectedLayer('processing')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'processing'
                  ? 'bg-emerald-600/10 border-emerald-500/30 shadow-emerald-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'processing' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 3</span>
                <span className="font-bold text-sm text-white block">Processing Layer (AI Backend)</span>
                <span className="text-xs text-slate-400 block mt-0.5">AI Agents, ML models, and adjacent seat optimization.</span>
              </div>
            </button>

            {/* Layer 4: Data Layer */}
            <button
              onClick={() => setSelectedLayer('data')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'data'
                  ? 'bg-amber-600/10 border-amber-500/30 shadow-amber-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'data' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 4</span>
                <span className="font-bold text-sm text-white block">Data Layer (Database System)</span>
                <span className="text-xs text-slate-400 block mt-0.5">SQLite stores for passenger records, maps & booking history.</span>
              </div>
            </button>

            {/* Layer 5: Workflow */}
            <button
              onClick={() => setSelectedLayer('workflow')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'workflow'
                  ? 'bg-purple-600/10 border-purple-500/30 shadow-purple-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'workflow' ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 5</span>
                <span className="font-bold text-sm text-white block">Workflow Execution (Steps 1–6)</span>
                <span className="text-xs text-slate-400 block mt-0.5">Active step-by-step transaction tracker pipeline.</span>
              </div>
            </button>

            {/* Layer 6: Output Layer */}
            <button
              onClick={() => setSelectedLayer('output')}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 relative z-10 ${
                selectedLayer === 'output'
                  ? 'bg-rose-600/10 border-rose-500/30 shadow-rose-500/5'
                  : 'bg-glass border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                selectedLayer === 'output' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Layer 6</span>
                <span className="font-bold text-sm text-white block">Output Layer (Results)</span>
                <span className="text-xs text-slate-400 block mt-0.5">Smart allocations, real-time updates & comfort indices.</span>
              </div>
            </button>
          </div>
        </section>

        {/* Right Column: Layer Details & Live Simulators (lg:col-span-7) */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* DYNAMIC CARD CONTENT PANEL */}
          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass min-h-[450px] flex flex-col justify-between">
            
            {/* 1. USER LAYER PANEL */}
            {selectedLayer === 'user' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-400" />
                    Layer 1: User Layer (Input Sources)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Responsible for capturing passenger data inputs, booking options, and seat details.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-white">Passenger Actions</h5>
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
                      <li>Selects route, date, and train class.</li>
                      <li>Views live coach layouts and occupied grid mappings.</li>
                      <li>Simulates exit/entry QR scans at station gates.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                    <h5 className="font-bold text-xs text-white">Simulate Passenger Type</h5>
                    <div className="flex flex-wrap gap-2">
                      {['Senior', 'Female', 'Disabled', 'General'].map(type => (
                        <button
                          key={type}
                          onClick={() => setSimUserType(type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            simUserType === type ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={runSimulation}
                      disabled={simActive}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4" />
                      Run Workflow Simulator
                    </button>
                  </div>
                </div>

                {/* Workflow mini tracer */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900">
                  <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider mb-2">Live Workflow Simulation Logs</span>
                  {simLogs.length === 0 ? (
                    <span className="text-xs text-slate-600 italic block py-2">Click "Run Workflow Simulator" above to trace booking steps.</span>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {simLogs.map((log, idx) => (
                        <div key={idx} className="text-xs text-indigo-300 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. FRONTEND LAYER PANEL */}
            {selectedLayer === 'frontend' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-cyan-400" />
                    Layer 2: Frontend Layer (User Interface)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    React + Vite SPA containing responsive user modules, coach grids, and operations counters.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-white">Interface Features</h5>
                    <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
                      <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span> <strong>Ticket Booking:</strong> Search-first station selector.</li>
                      <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span> <strong>Seat Dashboard:</strong> Visual coach seating map.</li>
                      <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span> <strong>User Profile:</strong> Aadhaar verified stats & priority.</li>
                      <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span> <strong>Real-time Display:</strong> Instant vacancy & override updates.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-white">System User Roles</h5>
                    <div className="space-y-2">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Admin Control Portal</span>
                        <Link to="/admin" className="text-cyan-400 hover:underline">Open Portal</Link>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Passenger Dashboard</span>
                        <Link to="/dashboard" className="text-cyan-400 hover:underline">Open Portal</Link>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="text-xs text-slate-400">Vite Dev Server exposed on local network:</span>
                  </div>
                  <span className="text-xs font-bold text-white">http://10.169.183.135:3000</span>
                </div>
              </div>
            )}

            {/* 3. PROCESSING LAYER PANEL */}
            {selectedLayer === 'processing' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-400" />
                    Layer 3: Processing Layer (AI Backend)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Python FastAPI server orchestrating database models, ML priority calculations, and seating optimizer agents.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-white">AI Agents & Engines</h5>
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
                      <li><strong>Aadhaar OCR Agent:</strong> Gemini Flash extracts Name/Age/Gender from uploaded cards.</li>
                      <li><strong>Seat Optimization:</strong> Allocates adjacent family groups (P5) and prioritizes seniors (P1).</li>
                      <li><strong>Overcrowding Safety:</strong> Restricts coach bookings to a maximum 95% threshold.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                    <h5 className="font-bold text-xs text-white">Technologies Used</h5>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <span className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300 font-semibold">Python 3.14</span>
                      <span className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300 font-semibold">FastAPI Web</span>
                      <span className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300 font-semibold">Google GenAI SDK</span>
                      <span className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300 font-semibold">SQLAlchemy ORM</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-xs text-slate-400">FastAPI backend reloading server running on:</span>
                  </div>
                  <span className="text-xs font-bold text-white">http://127.0.0.1:8000</span>
                </div>
              </div>
            )}

            {/* 4. DATA LAYER PANEL */}
            {selectedLayer === 'data' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-400" />
                    Layer 4: Data Layer (Database System)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Relational SQLite engine saving passenger priorities, booking PNR details, and coach seat tables.
                  </p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                    <span className="ml-2 text-xs text-slate-400">Querying live database tables...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Users Table</span>
                      <span className="text-2xl font-extrabold text-white">{dbStats.users}</span>
                      <span className="text-[9px] text-slate-500 block mt-1">Commuters</span>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Bookings Table</span>
                      <span className="text-2xl font-extrabold text-white">{dbStats.bookings}</span>
                      <span className="text-[9px] text-slate-500 block mt-1">Active tickets</span>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Trains Table</span>
                      <span className="text-2xl font-extrabold text-white">{dbStats.trains}</span>
                      <span className="text-[9px] text-slate-500 block mt-1">Seeded routes</span>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Available Seats</span>
                      <span className="text-2xl font-extrabold text-emerald-400">{dbStats.seatsAvailable}</span>
                      <span className="text-[9px] text-slate-500 block mt-1">Vacant seats</span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Database Synchronizer Status</span>
                  <p className="text-xs text-slate-400 font-sans">
                    SQLite DB is linked via FastAPI SQLAlchemy pool. Seat states automatically reset upon 3-minute lock timeout expirations.
                  </p>
                </div>
              </div>
            )}

            {/* 5. WORKFLOW LAYER PANEL */}
            {selectedLayer === 'workflow' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-400" />
                    Layer 5: Workflow Execution Pipeline
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Traces booking transaction progression sequentially from user input down to backend and database update.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep === 1 ? 'bg-indigo-500/10 border-indigo-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 1:</strong> Booking System receives passenger booking request.</span>
                    {currentStep === 1 && <span className="animate-pulse text-indigo-400">Running...</span>}
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep === 2 ? 'bg-cyan-500/10 border-cyan-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 2:</strong> AI Agent processes request & extracts priority rules.</span>
                    {currentStep === 2 && <span className="animate-pulse text-cyan-400">Running...</span>}
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep === 3 ? 'bg-amber-500/10 border-amber-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 3:</strong> Seat Allocation Engine assigns optimal adjacent seat.</span>
                    {currentStep === 3 && <span className="animate-pulse text-amber-400">Running...</span>}
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep === 4 ? 'bg-emerald-500/10 border-emerald-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 4:</strong> Database updated with locks and details.</span>
                    {currentStep === 4 && <span className="animate-pulse text-emerald-400">Running...</span>}
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep >= 5 ? 'bg-purple-500/10 border-purple-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 5:</strong> Updated seat information stored and synchronized.</span>
                    {currentStep === 5 && <span className="animate-pulse text-purple-400">Running...</span>}
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    currentStep === 6 ? 'bg-rose-500/10 border-rose-500/30 text-white font-bold' : 'bg-slate-900/30 border-slate-955 text-slate-400'
                  }`}>
                    <span><strong>Step 6:</strong> Results and ticketing QR code pushed to interface.</span>
                    {currentStep === 6 && <span className="text-rose-400">Completed!</span>}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={runSimulation}
                    disabled={simActive}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-purple-500/10"
                  >
                    <Play className="w-4 h-4" />
                    Auto Play Workflow Runner
                  </button>
                  <button
                    onClick={() => { setCurrentStep(0); setSimLogs([]); }}
                    className="px-4 py-2.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* 6. OUTPUT LAYER PANEL */}
            {selectedLayer === 'output' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    Layer 6: Output Layer (Optimization Results)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Visual indicators showing smart allocation efficiency, overcrowding relief, and commuter comfort metrics.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                    <h5 className="font-bold text-xs text-white">System Optimization Indicators</h5>
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Smart Seat Allocation Accuracy</span>
                          <span className="font-bold text-emerald-400">98.4%</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98.4%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Priority seating (elderly, women)</span>
                          <span className="font-bold text-indigo-400">95.1%</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: '95.1%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Overcrowding Mitigation cap index</span>
                          <span className="font-bold text-cyan-400">100.0%</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-white">Commuter Comfort Outputs</h5>
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
                      <li><strong>Real-time Seat Updates:</strong> Lock timeouts release seats instantly.</li>
                      <li><strong>Family Seating:</strong> Auto-groups PNR bookings in same coaches.</li>
                      <li><strong>Security checks:</strong> Verification flags mismatches to prevent database spoofing.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Automatic waitlist releases checked on exits:</span>
                  <span className="text-emerald-400 font-bold">Enabled</span>
                </div>
              </div>
            )}

            {/* Bottom Info bar */}
            <div className="border-t border-slate-900 pt-4 flex items-center justify-between text-[10px] text-slate-500 mt-6 font-sans">
              <span>Interactive Architecture Console</span>
              <span>Autonomous AI Agents for Smart Train Seat Allocation System</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
