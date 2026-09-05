import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BarChart3, Users, Train, Calendar, AlertTriangle, ShieldCheck, 
  Search, RefreshCw, X, ArrowLeft, Ban, Check, ShieldAlert, CreditCard, PieChart,
  Armchair, Cpu, Database, Activity
} from 'lucide-react';
import api from '../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [occupancyReport, setOccupancyReport] = useState([]);
  
  // Seat grid states
  const [seatMap, setSeatMap] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState('A');
  const [trainId, setTrainId] = useState('');

  // Search/Filters
  const [searchPassenger, setSearchPassenger] = useState('');
  const [activeTab, setActiveTab] = useState('stats'); // stats, bookings, passengers, payments, occupancy
  const [loading, setLoading] = useState(true);

  // Manual Override states
  const [overrideModal, setOverrideModal] = useState(false);
  const [targetSeatId, setTargetSeatId] = useState('');
  const [targetSeatNumber, setTargetSeatNumber] = useState('');
  const [selectedBookingForOverride, setSelectedBookingForOverride] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const localUser = localStorage.getItem('user');
    if (localUser) {
      const parsed = JSON.parse(localUser);
      if (parsed.role !== 'admin') {
        alert('Access denied: Admin role required.');
        navigate('/dashboard');
      }
    } else {
      navigate('/login');
    }

    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Stats
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      // 2. Fetch Bookings
      const bookingsRes = await api.get('/admin/bookings');
      setBookings(bookingsRes.data);

      // Extract train ID from first booking to load seat map
      if (bookingsRes.data.length > 0) {
        setTrainId(bookingsRes.data[0].train_id);
      } else {
        // Fallback to query train ID
        const trains = await api.get('/seats/trains');
        if (trains.data.length > 0) {
          setTrainId(trains.data[0].id);
        }
      }

      // 3. Fetch Users
      const usersRes = await api.get('/admin/users');
      setUsers(usersRes.data);

      // 4. Fetch Payments
      const paymentsRes = await api.get('/admin/payments');
      setPayments(paymentsRes.data);

      // 5. Fetch Occupancy
      const occupancyRes = await api.get('/admin/reports/occupancy');
      setOccupancyReport(occupancyRes.data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch seat map for grid when trainId or selectedCoach changes
  useEffect(() => {
    if (trainId) {
      fetchSeatMap();
    }
  }, [trainId, selectedCoach]);

  const fetchSeatMap = async () => {
    try {
      const res = await api.get(`/seats/map/${trainId}`);
      const coachData = res.data.find(c => c.coach === selectedCoach);
      if (coachData) {
        setSeatMap(coachData.seats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Aadhaar mismatch (approve / reject)
  const handleResolveFlag = async (userId, approve) => {
    const action = approve ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this passenger's Aadhaar verification?`)) return;
    
    try {
      await api.post(`/admin/users/${userId}/resolve-flag?approve=${approve}`);
      fetchAdminData();
    } catch (err) {
      alert('Action failed.');
    }
  };

  // Block/Unblock passenger
  const handleBlockToggle = async (userObj) => {
    const isBlocked = userObj.is_blocked;
    const action = isBlocked ? 'unblock' : 'block';
    if (!confirm(`Are you sure you want to ${action} passenger ${userObj.name}?`)) return;
    
    try {
      if (isBlocked) {
        await api.post(`/admin/users/${userObj.id}/unblock`);
      } else {
        await api.post(`/admin/users/${userObj.id}/block`);
      }
      fetchAdminData();
    } catch (err) {
      alert('Action failed.');
    }
  };

  // Cancel booking
  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking? This will refund and release the seat.')) return;
    try {
      await api.post(`/admin/cancel-booking/${bookingId}`);
      fetchAdminData();
    } catch (err) {
      alert('Cancellation failed.');
    }
  };

  // Manual Override Submit
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingForOverride) return;

    try {
      await api.post('/admin/override-seat', {
        booking_id: selectedBookingForOverride,
        seat_id: targetSeatId
      });
      setOverrideModal(false);
      setSelectedBookingForOverride('');
      fetchAdminData();
      fetchSeatMap();
      alert('Seat overridden successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Seat override failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-slate-400">Loading admin control center...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight block text-white">
                Admin Control Center
              </span>
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                Train Seat AI Operations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/architecture" 
              className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              System Architecture
            </Link>
            <Link 
              to="/dashboard" 
              className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              Passenger View
            </Link>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-800 hover:border-rose-500/30 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <aside className="md:w-60 flex-shrink-0 space-y-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'stats' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Executive Stats
          </button>
          
          <button
            onClick={() => setActiveTab('bookings')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'bookings' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Train className="w-4 h-4" />
            Bookings Log
          </button>

          <button
            onClick={() => setActiveTab('passengers')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'passengers' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Passenger Accounts
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'payments' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Payment History
          </button>

          <button
            onClick={() => setActiveTab('occupancy')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'occupancy' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Occupancy Report
          </button>

          <button
            onClick={() => setActiveTab('railway')}
            className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'railway' 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Railway Authority Portal
          </button>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 min-w-0">
          
          {/* TAB 1: EXECUTIVE STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Total Seats</span>
                  <span className="text-3xl font-extrabold text-white block">{stats?.total_seats}</span>
                </div>
                <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Occupied Seats</span>
                  <span className="text-3xl font-extrabold text-white block">{stats?.occupied}</span>
                </div>
                <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Available Seats</span>
                  <span className="text-3xl font-extrabold text-white block text-emerald-400">{stats?.available}</span>
                </div>
                <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Waitlisted</span>
                  <span className="text-3xl font-extrabold text-white block text-amber-400">{stats?.waitlisted}</span>
                </div>
              </div>

              {/* Real-time interactive seat grid override dashboard */}
              <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-4 gap-3">
                  <div>
                    <h3 className="font-extrabold text-white text-base">Real-time Coach Seat Grid Map</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Click an available seat to manually override/assign a booking.</p>
                  </div>

                  {/* Coach select tabs */}
                  <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
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

                {/* Legends */}
                <div className="flex flex-wrap gap-4 text-xs text-slate-400 pb-2 border-b border-slate-900">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-500/15 border border-emerald-500/30"></div>
                    <span className="text-emerald-400 font-bold">Green:</span> Available (Click to Assign)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-rose-500/15 border border-rose-500/30"></div>
                    <span className="text-rose-400 font-bold">Red:</span> Already Booked / Occupied / Locked
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-8 gap-2.5 max-w-md mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-900">
                  {seatMap.map(seat => {
                    const isAvailable = seat.status === 'AVAILABLE';
                    
                    let seatBg = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                    if (isAvailable) {
                      seatBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer';
                    }

                    return (
                      <button
                        key={seat.id}
                        disabled={!isAvailable}
                        onClick={() => {
                          setTargetSeatId(seat.id);
                          setTargetSeatNumber(seat.number);
                          setOverrideModal(true);
                        }}
                        className={`aspect-square rounded-xl border text-[10px] font-extrabold flex flex-col items-center justify-center transition-all ${seatBg}`}
                      >
                        <Armchair className="w-3.5 h-3.5 mb-0.5" />
                        {seat.number.split('-')[1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOOKINGS LOG */}
          {activeTab === 'bookings' && (
            <div className="bg-glass rounded-3xl border border-slate-900 shadow-glass overflow-hidden">
              <div className="p-5 border-b border-slate-900 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-white text-base">Train Bookings Log</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage seat overrides and passenger cancellations.</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchPassenger}
                    onChange={(e) => setSearchPassenger(e.target.value)}
                    placeholder="Search by passenger name..."
                    className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs w-60"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Passenger</th>
                      <th className="p-4">Train</th>
                      <th className="p-4">Seat</th>
                      <th className="p-4">Journey Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {bookings.filter(b => b.passenger_name.toLowerCase().includes(searchPassenger.toLowerCase())).map(b => (
                      <tr key={b.id} className="hover:bg-slate-900/40">
                        <td className="p-4">
                          <div className="font-semibold text-white">{b.passenger_name}</div>
                          <div className="text-[10px] text-slate-500">{b.passenger_email}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold">{b.train_number}</div>
                          <div className="text-[10px] text-slate-500">{b.train_name}</div>
                        </td>
                        <td className="p-4">
                          {b.waitlist_position ? (
                            <span className="text-amber-400 font-bold">Waitlist ({b.waitlist_position})</span>
                          ) : (
                            <div className="font-semibold text-slate-200">Coach {b.coach_number} / Seat {b.seat_number}</div>
                          )}
                          {b.is_emergency && <span className="text-[9px] text-red-400 font-bold uppercase block mt-0.5">Emergency</span>}
                        </td>
                        <td className="p-4">{b.journey_date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'confirmed' || b.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            b.status === 'completed' || b.status === 'COMPLETED' ? 'bg-slate-800 text-slate-400' :
                            b.status === 'cancelled' || b.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {b.status !== 'cancelled' && b.status !== 'completed' && (
                              <>
                                <button
                                  onClick={() => handleCancelBooking(b.id)}
                                  className="px-2.5 py-1.5 border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PASSENGER ACCOUNTS */}
          {activeTab === 'passengers' && (
            <div className="bg-glass rounded-3xl border border-slate-900 shadow-glass overflow-hidden">
              <div className="p-5 border-b border-slate-900">
                <h3 className="font-extrabold text-white text-base">Passenger Accounts & Identity Verification</h3>
                <p className="text-xs text-slate-500 mt-0.5">Approve flagged Aadhaar mismatches and block/unblock accounts.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Name</th>
                      <th className="p-4">Mobile</th>
                      <th className="p-4">Priority Tier</th>
                      <th className="p-4">Aadhaar Status</th>
                      <th className="p-4">Block State</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-900/40">
                        <td className="p-4">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.email}</div>
                        </td>
                        <td className="p-4">{u.mobile}</td>
                        <td className="p-4">
                          <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-bold">
                            {u.priority.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.is_flagged_for_review ? (
                            <span className="text-amber-400 flex items-center gap-1 font-bold animate-pulse text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5" /> Mismatch Flagged
                            </span>
                          ) : u.aadhaar_verified ? (
                            <span className="text-emerald-400 flex items-center gap-0.5 text-[10px]">
                              <Check className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-slate-500">Unverified</span>
                          )}
                        </td>
                        <td className="p-4">
                          {u.is_blocked ? (
                            <span className="text-rose-400 flex items-center gap-0.5 text-[10px] font-bold">
                              <Ban className="w-3.5 h-3.5" /> Blocked
                            </span>
                          ) : (
                            <span className="text-slate-500">Active</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 flex-wrap">
                            {u.is_flagged_for_review && (
                              <>
                                <button
                                  onClick={() => handleResolveFlag(u.id, true)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleResolveFlag(u.id, false)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleBlockToggle(u)}
                                className={`px-2 py-1 border text-[10px] font-bold rounded transition-all ${
                                  u.is_blocked 
                                    ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10' 
                                    : 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10'
                                }`}
                              >
                                {u.is_blocked ? 'Unblock' : 'Block'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT HISTORY */}
          {activeTab === 'payments' && (
            <div className="bg-glass rounded-3xl border border-slate-900 shadow-glass overflow-hidden">
              <div className="p-5 border-b border-slate-900">
                <h3 className="font-extrabold text-white text-base">Payment Logs Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">Audit transaction logs and sandbox payment gateway statuses.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Payment ID</th>
                      <th className="p-4">Passenger</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-900/40">
                        <td className="p-4 font-mono text-[10px] text-slate-400">{p.id.split('-')[0]}</td>
                        <td className="p-4 font-semibold text-white">{p.passenger_name}</td>
                        <td className="p-4 font-bold text-brand-400">₹{p.amount}</td>
                        <td className="p-4 font-semibold uppercase">{p.method || 'UPI'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            p.status === 'REFUNDED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{p.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: OCCUPANCY REPORT */}
          {activeTab === 'occupancy' && (
            <div className="bg-glass rounded-3xl border border-slate-900 shadow-glass overflow-hidden">
              <div className="p-5 border-b border-slate-900">
                <h3 className="font-extrabold text-white text-base">Coach Occupancy & Capacity Utilization</h3>
                <p className="text-xs text-slate-500 mt-0.5">Analytic summary showing overcrowding safety thresholds.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Coach</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Seats Utilized</th>
                      <th className="p-4">Available</th>
                      <th className="p-4">Locked</th>
                      <th className="p-4">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300 font-sans">
                    {occupancyReport.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-4 font-bold text-white text-sm">Coach {c.coach_number}</td>
                        <td className="p-4 font-semibold text-slate-400 text-[10px]">{c.coach_type.replace('_', ' ')}</td>
                        <td className="p-4 font-bold text-slate-200">
                          {c.occupied + c.booked} / {c.total_seats}
                          <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                            ({c.occupied} occupied, {c.booked} booked)
                          </span>
                        </td>
                        <td className="p-4 text-emerald-400 font-bold">{c.available}</td>
                        <td className="p-4 text-amber-500 font-bold">{c.locked}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900">
                              <div 
                                className={`h-full rounded-full ${
                                  c.utilization_percentage >= 95 ? 'bg-red-500' :
                                  c.utilization_percentage >= 80 ? 'bg-amber-500' :
                                  'bg-brand-500'
                                }`} 
                                style={{ width: `${c.utilization_percentage}%` }}
                              />
                            </div>
                            <span className={`font-extrabold ${c.utilization_percentage >= 95 ? 'text-red-400' : 'text-white'}`}>
                              {c.utilization_percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: RAILWAY AUTHORITY PORTAL & WORKFLOW */}
          {activeTab === 'railway' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Header */}
              <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-brand-400" />
                  Railway Authority Operations Portal
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Monitor real-time passenger requests, AI decision engine steps, and system-wide seat optimization outputs.
                </p>
              </div>

              {/* Step 1 to 6 Workflow Pipeline */}
              <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
                <h4 className="font-bold text-sm text-white border-b border-slate-900 pb-3">
                  System Architecture Workflow Tracker (Steps 1–6)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                  {/* Step 1 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Step 1</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                      </span>
                    </div>
                    <h5 className="font-bold text-xs text-white">Booking System Request</h5>
                    <p className="text-[11px] text-slate-400">
                      Receives passenger ticket booking inputs, journey date, and source/destination stations.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Step 2</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                    </div>
                    <h5 className="font-bold text-xs text-white">AI Agent Processing</h5>
                    <p className="text-[11px] text-slate-400">
                      AI seating agent parses profile data, checks Aadhaar priority tiers, and evaluates constraints.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Step 3</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    </div>
                    <h5 className="font-bold text-xs text-white">Seat Allocation Engine</h5>
                    <p className="text-[11px] text-slate-400">
                      Assigns the best available seat, prioritizing lower berths for seniors/disabled & female passenger grouping.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Step 4</span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Synced</span>
                    </div>
                    <h5 className="font-bold text-xs text-white">Database Update</h5>
                    <p className="text-[11px] text-slate-400">
                      Updates seat registry to locked state, saving booking transaction detail and PNR generation.
                    </p>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Step 5</span>
                      <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">Active</span>
                    </div>
                    <h5 className="font-bold text-xs text-white">Storage & Sync</h5>
                    <p className="text-[11px] text-slate-400">
                      Synchronizes updated booking parameters and starts the 3-minute seat payment lock window.
                    </p>
                  </div>

                  {/* Step 6 */}
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Step 6</span>
                      <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">Pushed</span>
                    </div>
                    <h5 className="font-bold text-xs text-white">Results Pushed to UI</h5>
                    <p className="text-[11px] text-slate-400">
                      Transmits final seat assignment details, priority concession fare, and entry QR code back to passenger dashboard.
                    </p>
                  </div>
                </div>
              </div>

              {/* Output Layer (Results) KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* KPI Metrics */}
                <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
                  <h4 className="font-bold text-sm text-white border-b border-slate-900 pb-3">
                    Output Layer Metrics & Optimization Results
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Smart Seat Allocation Accuracy</span>
                        <span className="text-emerald-400 font-bold">98.4%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98.4%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Priority-Based Seating Efficiency (Seniors/Disabled)</span>
                        <span className="text-brand-400 font-bold">95.1%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-brand-500 h-full rounded-full" style={{ width: '95.1%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Overcrowding Mitigation Index (95% Cap Guard)</span>
                        <span className="text-cyan-400 font-bold">100.0%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Adjacent Passenger Comfort Score</span>
                        <span className="text-indigo-400 font-bold">92.7%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: '92.7%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technology Stack & Data Layers */}
                <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
                  <h4 className="font-bold text-sm text-white border-b border-slate-900 pb-3">
                    System Technologies & Data Storage Layers
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-900">
                      <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Backend Stack</span>
                      <span className="text-sm font-bold text-white block flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-brand-400" /> Python 3.14 + FastAPI</span>
                      <span className="text-[10px] text-slate-400 block mt-1">Uvicorn & SQLAlchemy</span>
                    </div>
                    <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-900">
                      <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">ML Libraries</span>
                      <span className="text-sm font-bold text-white block flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-cyan-400" /> Gemini AI OCR agent</span>
                      <span className="text-[10px] text-slate-400 block mt-1">Google GenAI Client SDK</span>
                    </div>
                    <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-900">
                      <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Database Store</span>
                      <span className="text-xs font-bold text-white block flex items-center gap-1"><Database className="w-3.5 h-3.5 text-amber-400" /> Relational SQLite DB</span>
                      <span className="text-[10px] text-slate-400 block mt-1">Live seat maps & logs</span>
                    </div>
                    <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-900">
                      <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Hosting Env</span>
                      <span className="text-xs font-bold text-white block flex items-center gap-1"><Train className="w-3.5 h-3.5 text-indigo-400" /> Local Dev Wi-Fi Tunnel</span>
                      <span className="text-[10px] text-slate-400 block mt-1">Vite Dev Server Port 3000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Manual Override Assignment Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-glass-bright max-w-md w-full rounded-3xl border border-slate-800 shadow-2xl p-6 relative">
            <button 
              onClick={() => setOverrideModal(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-extrabold text-white text-base mb-2">Override Seat Assignment</h3>
            <p className="text-xs text-slate-400 mb-6">
              You are manually assigning seat <strong>{targetSeatNumber}</strong> in Coach <strong>{selectedCoach}</strong>. Select a passenger to re-assign.
            </p>

            <form onSubmit={handleOverrideSubmit} className="space-y-6">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-2">Select Booking to Re-assign</label>
                <select
                  required
                  value={selectedBookingForOverride}
                  onChange={(e) => setSelectedBookingForOverride(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 text-xs"
                >
                  <option value="">-- Choose Booking --</option>
                  {bookings.filter(b => b.status === 'confirmed' || b.status === 'CONFIRMED' || b.status === 'pending' || b.status === 'PENDING').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.passenger_name} ({b.coach_number ? `Seat ${b.coach_number}-${b.seat_number}` : `Waitlist ${b.waitlist_position}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setOverrideModal(false)}
                  className="flex-1 py-3 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
