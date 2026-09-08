import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Train, Calendar, MapPin, Loader2, ArrowLeft, Armchair, 
  Sparkles, CheckCircle2, ShieldCheck, Clock, Users, Plus, Trash, Check, AlertCircle, FileText, Download,
  Radio, Navigation, Zap, Compass, Info, X, ChevronRight, Activity, ArrowRight, Gauge
} from 'lucide-react';
import api from '../api';

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BookSeat() {
  const [trains, setTrains] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState('');
  const [journeyDate, setJourneyDate] = useState(getTodayDateString());
  const [source, setSource] = useState('KSR Bengaluru');
  const [destination, setDestination] = useState('Tumkur');
  
  // Search-first states
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedClass, setSelectedClass] = useState('SL');
  const [liveStatusModalTrain, setLiveStatusModalTrain] = useState(null);
  
  // Passenger selection (family booking)
  const [allUsers, setAllUsers] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState([]);
  
  // Seat selection states
  const [seatMap, setSeatMap] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState('C'); // default coach for SL
  const [selectedSeatId, setSelectedSeatId] = useState(null);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState('');
  const [isAiMode, setIsAiMode] = useState(true);
  
  // States
  const [loadingMap, setLoadingMap] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  // Payment checkout modal states
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [checkoutResponseList, setCheckoutResponseList] = useState([]); // from book API
  const [totalFare, setTotalFare] = useState(0);
  const [timerString, setTimerString] = useState('03:00');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [confirmedBookings, setConfirmedBookings] = useState([]);

  const navigate = useNavigate();
  const timerRef = useRef(null);
  const dateInputRef = useRef(null);

  // Station lists and distances matching backend
  const allUniqueStations = [
    'KSR Bengaluru', 'Yesvantpur', 'Chikbanavar', 'Nelamangala', 'Kunigal', 'Tumkur',
    'Kengeri', 'Bidadi', 'Ramanagara', 'Channapatna', 'Maddur', 'Mandya', 'Srirangapatna',
    'Mysuru Junction', 'Chennai Central', 'Arakkonam', 'Katpadi', 'Jolarpettai', 'Bangarapet',
    'Krishnarajapuram',
    
    // All-India Cities
    'New Delhi', 'Kota Junction', 'Ratlam Junction', 'Vadodara Junction', 'Surat', 'Mumbai Central',
    'Kanpur Central', 'Prayagraj Junction', 'Patna Junction', 'Howrah Junction', 'Bhopal Junction',
    'Nagpur Junction', 'Secunderabad Junction', 'Pune Junction', 'Solapur', 'Bhubaneswar',
    'Visakhapatnam', 'Vijayawada', 'Jaipur Junction', 'Ahmedabad Junction', 'Lucknow Charbagh', 'Guwahati'
  ];

  const STATION_DISTANCES = {
    // Existing local route mappings (relative to KSR Bengaluru = 2270)
    "ksr bengaluru": 2270,
    "bengaluru city local": 2270,
    "bengaluru": 2270,
    "yesvantpur": 2276,
    "chikbanavar": 2283,
    "nelamangala": 2298,
    "kunigal": 2343,
    "tumkur": 2340,
    "kengeri": 2258,
    "bidadi": 2240,
    "ramanagara": 2225,
    "channapatna": 2214,
    "maddur": 2190,
    "mandya": 2177,
    "srirangapatna": 2145,
    "mysuru junction": 2132,
    "mysore": 2132,
    "krishnarajapuram": 2284,
    "bangarapet": 2340,
    "jolarpettai": 2415,
    "katpadi": 2499,
    "arakkonam": 2555,
    "chennai central": 2629,
    "chennai": 2629,

    // New All-India Route Mappings (relative to New Delhi = 0)
    "new delhi": 0,
    "delhi": 0,
    "kota junction": 460,
    "ratlam junction": 730,
    "vadodara junction": 990,
    "surat": 1120,
    "mumbai central": 1380,
    "mumbai": 1380,
    "kanpur central": 440,
    "prayagraj junction": 630,
    "patna junction": 1000,
    "howrah junction": 1450,
    "kolkata": 1450,
    "bhopal junction": 700,
    "nagpur junction": 1090,
    "secunderabad junction": 1670,
    "hyderabad": 1670,
    "pune junction": 1570,
    "pune": 1570,
    "solapur": 1830,
    "bhubaneswar": 1200,
    "visakhapatnam": 1640,
    "vijayawada": 2000,
    "jaipur junction": 300,
    "jaipur": 300,
    "ahmedabad junction": 930,
    "ahmedabad": 930,
    "lucknow charbagh": 510,
    "lucknow": 510,
    "guwahati": 1950,
  };

  const calculateFare = (src, dst, priorityLevel, coachClass) => {
    const distSrc = STATION_DISTANCES[src.toLowerCase()] || 0;
    const distDst = STATION_DISTANCES[dst.toLowerCase()] || 70;
    let distance = Math.abs(distDst - distSrc);
    if (distance === 0) distance = 10;
    
    let fare = 2.0 * distance;
    let multiplier = 1.0;
    if (coachClass === '3A') multiplier = 2.0;
    else if (coachClass === '2S') multiplier = 0.5;
    
    fare = fare * multiplier;
    
    if (priorityLevel === 'P1_SENIOR' || priorityLevel === 'P2_DISABLED') {
      fare = fare * 0.5;
    }
    return Math.round(fare * 100) / 100;
  };

  const getOccupancyRate = () => {
    if (!seatMap || seatMap.length === 0) return 0.5; // default moderate
    const occupied = seatMap.filter(s => s.status !== 'AVAILABLE').length;
    return occupied / seatMap.length;
  };

  const TUMKUR_TRAINS = [
    '12079', '17326', '16579', '06571', '17316', '12725',
    '06575', '12629', '17309', '16535', '16589', '16227'
  ];
  const MYSURU_TRAINS = [
    '16021', '16231', '16591', '16235', '20607', '12007',
    '16558', '12976', '12614', '16216', '12609'
  ];
  const CHENNAI_TRAINS = [
    '12608', '12610', '12578', '22626', '20608', '12640',
    '12008', '12658', '12692'
  ];

  const CORRIDOR_BENGALURU_TUMKUR = ['KSR Bengaluru', 'Yesvantpur', 'Chikbanavar', 'Nelamangala', 'Kunigal', 'Tumkur'];
  const CORRIDOR_BENGALURU_MYSURU = ['KSR Bengaluru', 'Kengeri', 'Bidadi', 'Ramanagara', 'Channapatna', 'Maddur', 'Mandya', 'Srirangapatna', 'Mysuru Junction'];
  const CORRIDOR_BENGALURU_CHENNAI = ['KSR Bengaluru', 'Krishnarajapuram', 'Bangarapet', 'Jolarpettai', 'Katpadi', 'Arakkonam', 'Chennai Central'];
  const CORRIDOR_DELHI_MUMBAI = ['New Delhi', 'Kota Junction', 'Ratlam Junction', 'Vadodara Junction', 'Surat', 'Mumbai Central'];
  const CORRIDOR_DELHI_HOWRAH = ['New Delhi', 'Kanpur Central', 'Prayagraj Junction', 'Patna Junction', 'Howrah Junction'];
  const CORRIDOR_DELHI_BENGALURU = ['New Delhi', 'Bhopal Junction', 'Nagpur Junction', 'Secunderabad Junction', 'KSR Bengaluru'];
  const CORRIDOR_MUMBAI_CHENNAI = ['Mumbai Central', 'Pune Junction', 'Solapur', 'Chennai Central'];
  const CORRIDOR_HOWRAH_CHENNAI = ['Howrah Junction', 'Bhubaneswar', 'Visakhapatnam', 'Vijayawada', 'Chennai Central'];

  const getRouteForTrain = (trainOrNumber) => {
    let trainNumber = '';
    let src = '';
    let dest = '';

    if (typeof trainOrNumber === 'object' && trainOrNumber !== null) {
      trainNumber = String(trainOrNumber.train_number || '').replace(/^[A-Za-z]+-/, '').trim();
      src = (trainOrNumber.source_station || trainOrNumber.source || '').toLowerCase();
      dest = (trainOrNumber.destination_station || trainOrNumber.dest || '').toLowerCase();
    } else {
      trainNumber = String(trainOrNumber || '').replace(/^[A-Za-z]+-/, '').trim();
    }

    // 1. Direct Corridor Direction matching based on train source & destination
    if (src && dest) {
      if (src.includes('bengaluru') && dest.includes('tumkur')) return [...CORRIDOR_BENGALURU_TUMKUR];
      if (src.includes('tumkur') && dest.includes('bengaluru')) return [...CORRIDOR_BENGALURU_TUMKUR].reverse();

      if (src.includes('bengaluru') && dest.includes('mysuru')) return [...CORRIDOR_BENGALURU_MYSURU];
      if (src.includes('mysuru') && dest.includes('bengaluru')) return [...CORRIDOR_BENGALURU_MYSURU].reverse();

      if (src.includes('bengaluru') && dest.includes('chennai')) return [...CORRIDOR_BENGALURU_CHENNAI];
      if (src.includes('chennai') && dest.includes('bengaluru')) return [...CORRIDOR_BENGALURU_CHENNAI].reverse();

      if (src.includes('chennai') && dest.includes('mysuru')) {
        return ['Chennai Central', 'Arakkonam', 'Katpadi', 'Jolarpettai', 'Bangarapet', 'KSR Bengaluru', 'Mandya', 'Mysuru Junction'];
      }
      if (src.includes('mysuru') && dest.includes('chennai')) {
        return ['Mysuru Junction', 'Mandya', 'KSR Bengaluru', 'Bangarapet', 'Jolarpettai', 'Katpadi', 'Arakkonam', 'Chennai Central'];
      }

      if (src.includes('delhi') && dest.includes('mumbai')) return [...CORRIDOR_DELHI_MUMBAI];
      if (src.includes('mumbai') && dest.includes('delhi')) return [...CORRIDOR_DELHI_MUMBAI].reverse();

      if (src.includes('delhi') && dest.includes('howrah')) return [...CORRIDOR_DELHI_HOWRAH];
      if (src.includes('howrah') && dest.includes('delhi')) return [...CORRIDOR_DELHI_HOWRAH].reverse();

      if (src.includes('delhi') && dest.includes('bengaluru')) return [...CORRIDOR_DELHI_BENGALURU];
      if (src.includes('bengaluru') && dest.includes('delhi')) return [...CORRIDOR_DELHI_BENGALURU].reverse();

      if (src.includes('mumbai') && dest.includes('chennai')) return [...CORRIDOR_MUMBAI_CHENNAI];
      if (src.includes('chennai') && dest.includes('mumbai')) return [...CORRIDOR_MUMBAI_CHENNAI].reverse();

      if (src.includes('howrah') && dest.includes('chennai')) return [...CORRIDOR_HOWRAH_CHENNAI];
      if (src.includes('chennai') && dest.includes('howrah')) return [...CORRIDOR_HOWRAH_CHENNAI].reverse();
    }

    // 2. Train Number List Fallbacks
    if (TUMKUR_TRAINS.includes(trainNumber)) {
      return [...CORRIDOR_BENGALURU_TUMKUR];
    }
    if (MYSURU_TRAINS.includes(trainNumber)) {
      return [...CORRIDOR_BENGALURU_MYSURU];
    }
    if (CHENNAI_TRAINS.includes(trainNumber) || trainNumber === '12657' || trainNumber === '12608' || trainNumber === '12639') {
      return [...CORRIDOR_BENGALURU_CHENNAI];
    }
    if (trainNumber === '12952') return [...CORRIDOR_DELHI_MUMBAI];
    if (trainNumber === '12302') return [...CORRIDOR_DELHI_HOWRAH];
    if (['12628', '22691'].includes(trainNumber)) return [...CORRIDOR_DELHI_BENGALURU];
    if (trainNumber === '12163') return [...CORRIDOR_MUMBAI_CHENNAI];
    if (trainNumber === '12842') return [...CORRIDOR_HOWRAH_CHENNAI];

    return [];
  };

  const calculateDuration = (depTime, arrTime) => {
    if (!depTime || !arrTime) return '';
    const [depH, depM] = depTime.split(':').map(Number);
    const [arrH, arrM] = arrTime.split(':').map(Number);
    
    let depMinutes = depH * 60 + depM;
    let arrMinutes = arrH * 60 + arrM;
    
    if (arrMinutes < depMinutes) {
      arrMinutes += 24 * 60;
    }
    
    const diff = arrMinutes - depMinutes;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    
    return `${hours}h ${mins}m`;
  };

  const STATION_CODES = {
    'ksr bengaluru': 'SBC',
    'yesvantpur': 'YPR',
    'chikbanavar': 'BAW',
    'nelamangala': 'NMGA',
    'kunigal': 'KIGL',
    'tumkur': 'TK',
    'kengeri': 'KGI',
    'bidadi': 'BID',
    'ramanagara': 'RMGM',
    'channapatna': 'CPT',
    'maddur': 'MAD',
    'mandya': 'MYA',
    'srirangapatna': 'S',
    'mysuru junction': 'MYS',
    'mysore': 'MYS',
    'krishnarajapuram': 'KJM',
    'bangarapet': 'BWT',
    'jolarpettai': 'JTJ',
    'katpadi': 'KPD',
    'arakkonam': 'AJJ',
    'chennai central': 'MAS',
    'chennai': 'MAS',
    'new delhi': 'NDLS',
    'delhi': 'NDLS',
    'kota junction': 'KOTA',
    'ratlam junction': 'RTM',
    'vadodara junction': 'BRC',
    'surat': 'ST',
    'mumbai central': 'MMCT',
    'mumbai': 'MMCT',
    'kanpur central': 'CNB',
    'prayagraj junction': 'PRYJ',
    'patna junction': 'PNBE',
    'howrah junction': 'HWH',
    'kolkata': 'HWH',
    'bhopal junction': 'BPL',
    'nagpur junction': 'NGP',
    'secunderabad junction': 'SC',
    'hyderabad': 'SC',
    'pune junction': 'PUNE',
    'pune': 'PUNE',
    'solapur': 'SUR',
    'bhubaneswar': 'BBS',
    'visakhapatnam': 'VSKP',
    'vijayawada': 'BZA',
    'jaipur junction': 'JP',
    'jaipur': 'JP',
    'ahmedabad junction': 'ADI',
    'ahmedabad': 'ADI',
    'lucknow charbagh': 'LKO',
    'lucknow': 'LKO',
    'guwahati': 'GHY',
  };

  const getStationCode = (stName) => {
    return STATION_CODES[(stName || '').toLowerCase()] || (stName || '').slice(0, 3).toUpperCase();
  };

  const getWhereIsMyTrainInfo = (t, route, searchSrc, searchDst) => {
    const rawNumber = String(t.train_number || '12000').replace(/^[A-Za-z]+-/, '').trim();
    const numHash = rawNumber.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // Train category
    const nameLower = (t.train_name || '').toLowerCase();
    let category = { label: 'EXPRESS', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    if (nameLower.includes('vande bharat')) {
      category = { label: '⚡ VANDE BHARAT', color: 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-300 border-purple-500/40' };
    } else if (nameLower.includes('shatabdi')) {
      category = { label: '🚄 SHATABDI', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    } else if (nameLower.includes('rajdhani')) {
      category = { label: '⭐ RAJDHANI', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
    } else if (nameLower.includes('double decker')) {
      category = { label: '💺 DOUBLE DECKER', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    } else if (nameLower.includes('sampark') || nameLower.includes('superfast') || nameLower.includes('sf')) {
      category = { label: '🌟 SUPERFAST', color: 'bg-brand-500/20 text-brand-300 border-brand-500/40' };
    } else if (nameLower.includes('memu') || nameLower.includes('local')) {
      category = { label: '🚈 SUBURBAN MEMU', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
    }

    // Delay calculation
    const lastDigit = parseInt(rawNumber.slice(-1)) || 0;
    let delayMins = 0;
    let delayBadge = 'ON TIME';
    let delayColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if ([7, 8, 9].includes(lastDigit)) {
      delayMins = (lastDigit * 2) - 4;
      delayBadge = `DELAYED ${delayMins}m`;
      delayColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    } else if ([3, 5].includes(lastDigit)) {
      delayMins = -3;
      delayBadge = '3m EARLY';
      delayColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }

    const getPlatform = (st) => `PF ${(((numHash + (st || '').length) % 4) + 1)}`;
    const depPlatform = getPlatform(searchSrc);
    const arrPlatform = getPlatform(searchDst);

    const speed = 75 + (numHash % 32);

    // Intermediate timings
    const [depH, depM] = (t.departure_time || '08:00').split(':').map(Number);
    const [arrH, arrM] = (t.arrival_time || '14:00').split(':').map(Number);
    let startMin = depH * 60 + depM;
    let endMin = arrH * 60 + arrM;
    if (endMin < startMin) endMin += 1440;
    const totalDuration = endMin - startMin;

    const totalRouteStops = Math.max(route.length - 1, 1);
    const srcIndex = Math.max(route.findIndex(s => s.toLowerCase() === (searchSrc || '').toLowerCase()), 0);
    const dstIndex = Math.min(Math.max(route.findIndex(s => s.toLowerCase() === (searchDst || '').toLowerCase()), srcIndex + 1), route.length - 1);

    const getTimeForStation = (idx, isArr) => {
      const fraction = idx / totalRouteStops;
      let minAtSt = Math.round(startMin + fraction * totalDuration);
      if (idx > 0 && idx < totalRouteStops) {
        minAtSt = isArr ? minAtSt - 2 : minAtSt + 2;
      }
      minAtSt = ((minAtSt % 1440) + 1440) % 1440;
      const h = String(Math.floor(minAtSt / 60)).padStart(2, '0');
      const m = String(minAtSt % 60).padStart(2, '0');
      return `${h}:${m}`;
    };

    const userDepTime = srcIndex === 0 ? t.departure_time : getTimeForStation(srcIndex, false);
    const userArrTime = dstIndex === totalRouteStops ? t.arrival_time : getTimeForStation(dstIndex, true);
    const userDuration = calculateDuration(userDepTime, userArrTime);

    const distSrc = STATION_DISTANCES[(searchSrc || '').toLowerCase()] || 0;
    const distDst = STATION_DISTANCES[(searchDst || '').toLowerCase()] || 120;
    const journeyDist = Math.abs(distDst - distSrc) || 75;

    const currentStopIndex = Math.min(Math.max(srcIndex, 0), route.length - 1);
    const currentStation = route[currentStopIndex] || route[0];
    const nextStation = route[Math.min(currentStopIndex + 1, route.length - 1)];

    const timeline = route.map((st, i) => {
      const code = getStationCode(st);
      const pf = getPlatform(st);
      const schArr = i === 0 ? '--' : getTimeForStation(i, true);
      const schDep = i === route.length - 1 ? '--' : getTimeForStation(i, false);
      const isPassed = i < currentStopIndex;
      const isCurrent = i === currentStopIndex;
      const isUpcoming = i > currentStopIndex;

      const d0 = STATION_DISTANCES[(route[0] || '').toLowerCase()] || 0;
      const dCurr = STATION_DISTANCES[(st || '').toLowerCase()] || (i * 45);
      const kmFromStart = Math.abs(dCurr - d0);

      return {
        name: st,
        code,
        platform: pf,
        distanceKm: kmFromStart,
        schArr,
        schDep,
        isPassed,
        isCurrent,
        isUpcoming,
        delayMins: isPassed || isCurrent ? delayMins : 0
      };
    });

    return {
      category,
      delayBadge,
      delayColor,
      delayMins,
      depPlatform,
      arrPlatform,
      speed,
      userDepTime,
      userArrTime,
      userDuration,
      journeyDist,
      currentStation,
      nextStation,
      timeline
    };
  };

  const allCorridors = [
    CORRIDOR_BENGALURU_TUMKUR,
    [...CORRIDOR_BENGALURU_TUMKUR].reverse(),
    CORRIDOR_BENGALURU_MYSURU,
    [...CORRIDOR_BENGALURU_MYSURU].reverse(),
    CORRIDOR_BENGALURU_CHENNAI,
    [...CORRIDOR_BENGALURU_CHENNAI].reverse(),
    ['Chennai Central', 'Arakkonam', 'Katpadi', 'Jolarpettai', 'Bangarapet', 'KSR Bengaluru', 'Mandya', 'Mysuru Junction'],
    ['Mysuru Junction', 'Mandya', 'KSR Bengaluru', 'Bangarapet', 'Jolarpettai', 'Katpadi', 'Arakkonam', 'Chennai Central'],
    CORRIDOR_DELHI_MUMBAI,
    [...CORRIDOR_DELHI_MUMBAI].reverse(),
    CORRIDOR_DELHI_HOWRAH,
    [...CORRIDOR_DELHI_HOWRAH].reverse(),
    CORRIDOR_DELHI_BENGALURU,
    [...CORRIDOR_DELHI_BENGALURU].reverse(),
    CORRIDOR_MUMBAI_CHENNAI,
    [...CORRIDOR_MUMBAI_CHENNAI].reverse(),
    CORRIDOR_HOWRAH_CHENNAI,
    [...CORRIDOR_HOWRAH_CHENNAI].reverse(),
  ];

  const getValidSources = () => {
    const sources = new Set();
    allCorridors.forEach(route => {
      for (let i = 0; i < route.length - 1; i++) {
        sources.add(route[i]);
      }
    });
    return Array.from(sources).sort();
  };

  const getValidDestinations = (selectedSource) => {
    if (!selectedSource) return [];
    const destinations = new Set();
    allCorridors.forEach(route => {
      const srcIdx = route.findIndex(st => st.toLowerCase() === selectedSource.toLowerCase());
      if (srcIdx !== -1) {
        for (let i = srcIdx + 1; i < route.length; i++) {
          destinations.add(route[i]);
        }
      }
    });
    return Array.from(destinations).sort();
  };

  const currentTrain = searchResults.find(t => t.id === selectedTrain);

  useEffect(() => {
    const localUser = localStorage.getItem('user');
    if (localUser) {
      const parsed = JSON.parse(localUser);
      setUser(parsed);
      if (!parsed.aadhaar_verified) {
        alert('Aadhaar verification is required to access bookings.');
        navigate('/dashboard');
      }
    } else {
      navigate('/login');
    }
    
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const trainsRes = await api.get('/seats/trains');
      setTrains(trainsRes.data);

      try {
        const usersRes = await api.get('/admin/users');
        const otherUsers = usersRes.data.filter(u => u.id !== JSON.parse(localStorage.getItem('user')).id && u.aadhaar_verified);
        setAllUsers(otherUsers);
      } catch {
        setAllUsers([
          { id: '34823902-8d9c-4861-8cf9-111122223333', name: 'Ramesh Kumar (Father)', priority: 'P1_SENIOR', email: 'ramesh@example.com', mobile: '+919998887771', is_blocked: false },
          { id: '908f90a2-2b3d-491c-bf1b-444455556666', name: 'Saraswathi Kumar (Mother)', priority: 'P3_FEMALE', email: 'saras@example.com', mobile: '+919998887772', is_blocked: false },
          { id: '128c92b2-6c3e-4d8e-be8e-777788889999', name: 'Vijay Kumar (Brother)', priority: 'P4_GENERAL', email: 'vijay@example.com', mobile: '+919998887773', is_blocked: false }
        ]);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading initial parameters.');
    }
  };

  useEffect(() => {
    if (selectedTrain) {
      fetchSeatMap();
    }
  }, [selectedTrain, selectedCoach, isAiMode]);

  const fetchSeatMap = async () => {
    if (!selectedTrain) return;
    setLoadingMap(true);
    try {
      const res = await api.get(`/seats/map/${selectedTrain}`);
      const coachData = res.data.find(c => c.coach.toUpperCase() === selectedCoach.toUpperCase());
      if (coachData && coachData.seats) {
        setSeatMap(coachData.seats);
      } else if (res.data && res.data.length > 0) {
        setSeatMap(res.data[0].seats);
        setSelectedCoach(res.data[0].coach);
      }
    } catch (err) {
      console.error('Error loading seat map:', err);
    } finally {
      setLoadingMap(false);
    }
  };

  const handleSearchTrains = async (e) => {
    if (e) e.preventDefault();
    if (!source || !destination) {
      setError('Please select both source and destination.');
      return;
    }
    if (source === destination) {
      setError('Source and Destination cannot be the same.');
      return;
    }
    const todayStr = getTodayDateString();
    if (!journeyDate || journeyDate < todayStr) {
      setError('Cannot search or book trains for past dates. Please select today or a future date.');
      setJourneyDate(todayStr);
      return;
    }
    
    setSearching(true);
    setError('');
    setSelectedTrain('');
    setSeatMap([]);
    
    try {
      const trainsRes = await api.get('/seats/trains');
      const allTrains = trainsRes.data;
      
      const fetchPromises = [];
      
      for (const t of allTrains) {
        const route = getRouteForTrain(t);
        const srcIdx = route.findIndex(st => st.toLowerCase() === source.toLowerCase());
        const dstIdx = route.findIndex(st => st.toLowerCase() === destination.toLowerCase());
        
        if (srcIdx !== -1 && dstIdx !== -1 && srcIdx < dstIdx) {
          fetchPromises.push((async () => {
            let avail3A = 0;
            let availSL = 0;
            let avail2S = 0;
            
            try {
              const mapRes = await api.get(`/seats/map/${t.id}`);
              const seatMapData = mapRes.data;
              for (const coach of seatMapData) {
                const coachNum = coach.coach.toUpperCase();
                if (['A', 'B'].includes(coachNum)) {
                  avail3A += coach.available || 0;
                } else if (['C', 'D'].includes(coachNum)) {
                  availSL += coach.available || 0;
                } else if (['E', 'F'].includes(coachNum)) {
                  avail2S += coach.available || 0;
                }
              }
            } catch (mapErr) {
              console.error(`Error loading seat map for train ${t.train_number}:`, mapErr);
            }
            
            const priorityVal = user?.priority || 'P4_GENERAL';
            const fare3A = calculateFare(source, destination, priorityVal, '3A');
            const fareSL = calculateFare(source, destination, priorityVal, 'SL');
            const fare2S = calculateFare(source, destination, priorityVal, '2S');
            
            const wimtInfo = getWhereIsMyTrainInfo(t, route, source, destination);
            return {
              ...t,
              avail3A,
              availSL,
              avail2S,
              fare3A,
              fareSL,
              fare2S,
              route,
              ...wimtInfo
            };
          })());
        }
      }
      
      const results = await Promise.all(fetchPromises);
      results.sort((a, b) => {
        const timeA = String(a.userDepTime || a.departure_time || '00:00');
        const timeB = String(b.userDepTime || b.departure_time || '00:00');
        return timeA.localeCompare(timeB);
      });
      setSearchResults(results);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setError('Error searching for trains.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectTrainAndClass = (train, coachClass) => {
    setSelectedTrain(train.id);
    setSelectedClass(coachClass);
    
    const classCoaches = { '3A': 'A', 'SL': 'C', '2S': 'E' };
    setSelectedCoach(classCoaches[coachClass] || 'A');
    
    setSelectedSeatId(null);
    setSelectedSeatNumber('');
  };

  // Handle adding family member
  const handleAddFamilyMember = (passenger) => {
    if (selectedFamily.some(f => f.id === passenger.id)) return;
    if (selectedFamily.length >= 5) {
      alert('You can book for a maximum of 6 passengers (self + 5 family members) at a time.');
      return;
    }
    setSelectedFamily([...selectedFamily, passenger]);
  };

  // Handle removing family member
  const handleRemoveFamilyMember = (id) => {
    setSelectedFamily(selectedFamily.filter(f => f.id !== id));
  };

  // Start checkout countdown
  const startPaymentTimer = (secondsRemaining) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    let time = secondsRemaining;
    timerRef.current = setInterval(() => {
      time--;
      if (time <= 0) {
        clearInterval(timerRef.current);
        setCheckoutModal(false);
        alert('Seat lock window expired! Your seats have been released back to the pool.');
        // Trigger manual seat map update to reflect released lock
        fetchSeatMap();
      } else {
        const mins = Math.floor(time / 60);
        const secs = time % 60;
        setTimerString(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
  };

  // Initiate Booking (Locks seats and calls backend /book or /book-family)
  const handleInitiateBooking = async () => {
    setError('');
    const todayStr = getTodayDateString();
    if (!journeyDate || journeyDate < todayStr) {
      setError('Cannot book tickets for past dates. Please select today or a future date.');
      setJourneyDate(todayStr);
      return;
    }
    setBookingLoading(true);
    
    try {
      const currentTrain = trains.find(t => t.id === selectedTrain);
      const isGroup = selectedFamily.length > 0;

      let bookingsList = [];
      let orderId = '';
      
      if (isGroup) {
        // Family group booking (P5)
        const pids = [user.id, ...selectedFamily.map(f => f.id)];
        const res = await api.post('/bookings/book-family', {
          train_id: selectedTrain,
          journey_date: journeyDate,
          source_station: source,
          destination_station: destination,
          passenger_ids: pids,
          coach_class: selectedClass
        });
        bookingsList = res.data;
        orderId = res.data[0].razorpay_order_id;
      } else {
        // Single booking
        const payload = {
          train_id: selectedTrain,
          journey_date: journeyDate,
          source_station: source,
          destination_station: destination,
          coach_class: selectedClass
        };
        // Add manual seat ID if in manual mode
        if (!isAiMode && selectedSeatId) {
          payload.seat_id = selectedSeatId;
        }

        const res = await api.post('/bookings/book', payload);
        bookingsList = [res.data];
        orderId = res.data.razorpay_order_id;
      }

      // Calculate total fare
      const total = bookingsList.reduce((sum, b) => sum + b.fare, 0);
      setTotalFare(total);
      setRazorpayOrderId(orderId);
      setCheckoutResponseList(bookingsList);
      
      // Open Checkout and start 3-minute lock timer
      setCheckoutModal(true);
      setPaymentSuccess(false);
      setTimerString('03:00');
      startPaymentTimer(180);

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Seat allocation failed. Train might be full.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Simulate Razorpay payment confirmation
  const handleSimulatePayment = async () => {
    setPaymentLoading(true);
    try {
      // Confirm each lead booking in checkoutData
      // Group bookings share a razorpay order ID and confirm all seats linked to it
      const leadBooking = checkoutResponseList[0];
      
      const res = await api.post('/payments/confirm', {
        booking_id: leadBooking.id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: `pay_mock_${uuid()}`,
        razorpay_signature: 'signature_mock_verification_passed',
        method: paymentMethod
      });

      if (res.data.status === 'success') {
        if (timerRef.current) clearInterval(timerRef.current);
        setPaymentSuccess(true);
        
        // Fetch confirmed booking structures (including QR codes)
        const updatedBookings = await api.get('/bookings/my');
        const confirmedList = updatedBookings.data.filter(b => 
          res.data.booking_ids.includes(b.id)
        );
        setConfirmedBookings(confirmedList);
      }
    } catch (err) {
      console.error(err);
      alert('Payment confirmation failed. Try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const [downloadingTicketId, setDownloadingTicketId] = useState(null);

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

  const uuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const coachClasses = { '3A': ['A', 'B'], 'SL': ['C', 'D'], '2S': ['E', 'F'] };
  const activeCoaches = coachClasses[selectedClass] || ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-all text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
              <Train className="w-5 h-5 text-brand-400" />
            </div>
            <span className="font-bold text-sm text-slate-200">Local Route Booking</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
          <div className="p-4 mb-6 text-sm bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Panel 1: Route Config & Family Booking */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Search Configuration */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
              <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wide text-brand-300">
                1. Search Route
              </h3>

              <form onSubmit={handleSearchTrains} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5">Source Station</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <select 
                      value={source} 
                      onChange={(e) => {
                        const newSrc = e.target.value;
                        setSource(newSrc);
                        const validDests = getValidDestinations(newSrc);
                        if (!validDests.includes(destination)) {
                          setDestination(validDests[0] || '');
                        }
                      }}
                      className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 text-xs"
                    >
                      {getValidSources().map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5">Destination Station</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <select 
                      value={destination} 
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 text-xs"
                      disabled={!source}
                    >
                      {getValidDestinations(source).map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-400 text-xs font-semibold">Date of Journey</label>
                    <span className="text-[10px] text-brand-400 font-medium">Today onwards only</span>
                  </div>
                  <div 
                    onClick={() => {
                      try { dateInputRef.current?.showPicker(); } catch (err) {}
                    }} 
                    className="relative cursor-pointer group"
                  >
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-brand-400 group-hover:text-brand-300 transition-colors pointer-events-none" />
                    <input 
                      ref={dateInputRef}
                      type="date" 
                      value={journeyDate}
                      min={getTodayDateString()}
                      onClick={(e) => {
                        try { e.target.showPicker(); } catch (err) {}
                      }}
                      onFocus={(e) => {
                        try { e.target.showPicker(); } catch (err) {}
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        const todayStr = getTodayDateString();
                        if (val && val < todayStr) {
                          setError("Past dates cannot be selected because they have already occurred. Date reset to today.");
                          setJourneyDate(todayStr);
                        } else {
                          setError("");
                          setJourneyDate(val);
                        }
                      }}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-800 group-hover:border-brand-500/50 rounded-xl text-white focus:outline-none focus:border-brand-500 text-xs font-sans cursor-pointer transition-all [color-scheme:dark]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try { dateInputRef.current?.showPicker(); } catch (err) {}
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 text-slate-400 hover:text-brand-300 rounded-lg transition-colors"
                      title="Open Calendar Picker"
                    >
                      <Calendar className="w-4 h-4 text-brand-400" />
                    </button>
                  </div>
                  {/* Quick Select Preset Buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setJourneyDate(getTodayDateString())}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        journeyDate === getTodayDateString() 
                          ? 'bg-brand-500 text-white shadow-sm' 
                          : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        setJourneyDate(`${d.getFullYear()}-${m}-${day}`);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        (() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return journeyDate === `${d.getFullYear()}-${m}-${day}`;
                        })() 
                          ? 'bg-brand-500 text-white shadow-sm' 
                          : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        setJourneyDate(`${d.getFullYear()}-${m}-${day}`);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        (() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 2);
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return journeyDate === `${d.getFullYear()}-${m}-${day}`;
                        })() 
                          ? 'bg-brand-500 text-white shadow-sm' 
                          : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      Day After
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Train className="w-4 h-4" />
                      Search Trains
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Family booking select panel */}
            <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass">
              <h3 className="font-bold text-white mb-1.5 text-sm uppercase tracking-wide text-brand-300 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Family Booking
              </h3>
              <p className="text-[10px] text-slate-400 mb-4">
                Add verified family members to book adjacent seats. All tickets are paid in one transaction.
              </p>

              {/* Selected members list */}
              {selectedFamily.length > 0 && (
                <div className="space-y-2 mb-4">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Passengers ({selectedFamily.length + 1})</span>
                  <div className="p-2 bg-brand-500/5 rounded-xl border border-brand-500/10 text-xs text-white font-medium flex items-center justify-between">
                    <span>{user?.name} (Lead)</span>
                    <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full font-bold">{user?.priority?.replace('_', ' ')}</span>
                  </div>
                  {selectedFamily.map(f => (
                    <div key={f.id} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center justify-between">
                      <span>{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">{f.priority?.replace('_', ' ')}</span>
                        <button onClick={() => handleRemoveFamilyMember(f.id)} className="text-rose-400 hover:text-rose-300">
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add member select box */}
              {allUsers.length > 0 && (
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1.5">Add Verified Passenger</label>
                  <div className="flex flex-col gap-2">
                    {allUsers.filter(u => !selectedFamily.some(f => f.id === u.id)).map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAddFamilyMember(u)}
                        className="p-2 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/40 rounded-xl text-left text-xs transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="text-slate-200 font-medium">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.email}</div>
                        </div>
                        <Plus className="w-4 h-4 text-brand-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Panel 2 & 3: Search Results & Seating Map */}
          <div className="lg:col-span-3 space-y-6">
            
            {searching && (
              <div className="bg-glass p-12 rounded-3xl border border-slate-900 shadow-glass text-center space-y-4 py-20">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto" />
                <h3 className="font-extrabold text-white text-lg">Searching Schedules & Seats</h3>
                <p className="text-slate-400 text-sm">Querying active schedules, routes, and live seat maps...</p>
              </div>
            )}

            {!searching && !hasSearched && (
              <div className="bg-glass p-12 rounded-3xl border border-slate-900 shadow-glass text-center space-y-6 flex flex-col items-center justify-center py-24">
                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 shadow-glass-bright">
                  <Train className="w-10 h-10 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-xl mb-1">Search Trains to Book</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Enter your source, destination, and travel date in the search panel to view daily runs, times, fares, and live seat availability.
                  </p>
                </div>
              </div>
            )}

            {!searching && hasSearched && searchResults.length === 0 && (
              <div className="bg-glass p-12 rounded-3xl border border-slate-900 shadow-glass text-center space-y-4 py-20">
                <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                <h3 className="font-extrabold text-white text-lg">No Trains Found</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  No trains are scheduled from <strong className="text-white">{source}</strong> to <strong className="text-white">{destination}</strong> in this direction. Try searching in the opposite direction.
                </p>
              </div>
            )}

            {!searching && hasSearched && searchResults.length > 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    {searchResults.length} Trains found on {journeyDate}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Route: <strong className="text-slate-300">{source}</strong> ➔ <strong className="text-slate-300">{destination}</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  {searchResults.map(t => {
                    const duration = calculateDuration(t.departure_time, t.arrival_time);
                    const isTrainSelected = selectedTrain === t.id;
                    
                    const classesInfo = [
                      { code: '3A', name: 'AC 3-Tier', avail: t.avail3A, fare: t.fare3A },
                      { code: 'SL', name: 'Sleeper Class', avail: t.availSL, fare: t.fareSL },
                      { code: '2S', name: 'Second Sitting', avail: t.avail2S, fare: t.fare2S }
                    ];

                    return (
                      <div 
                        key={t.id} 
                        className={`bg-glass rounded-3xl border transition-all overflow-hidden ${
                          isTrainSelected ? 'border-brand-500/50 shadow-glass-bright' : 'border-slate-900 hover:border-slate-800'
                        }`}
                      >
                        {/* Upper Train details */}
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900">
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-extrabold text-white text-base">{t.train_name}</span>
                              <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-bold rounded-lg uppercase font-mono">{t.train_number}</span>
                              {t.category && (
                                <span className={`px-2 py-0.5 border text-[9px] font-extrabold rounded-lg ${t.category.color}`}>
                                  {t.category.label}
                                </span>
                              )}
                              {/* Live Running Badge */}
                              <span className={`px-2.5 py-0.5 border text-[10px] font-extrabold rounded-full flex items-center gap-1.5 ${t.delayColor || 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                                </span>
                                {t.delayBadge || 'ON TIME'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Runs: Daily</span>
                              <div className="flex gap-1 text-[9px] font-extrabold text-slate-400">
                                {['M','T','W','T','F','S','S'].map((day, idx) => (
                                  <span key={idx} className="w-3.5 h-3.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">
                                    {day}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Time details */}
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="font-extrabold text-white text-base block">{t.userDepTime || t.departure_time}</span>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold">{source}</span>
                              <span className="text-[9px] text-brand-400 font-extrabold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20 inline-block mt-0.5">
                                {t.depPlatform || 'PF 1'}
                              </span>
                            </div>
                            <div className="flex flex-col items-center min-w-[80px]">
                              <span className="text-[10px] text-slate-400 font-bold">{t.userDuration || duration}</span>
                              <div className="w-20 h-0.5 bg-slate-800 relative my-1">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                              </div>
                              <span className="text-[9px] text-slate-500 font-semibold">{t.journeyDist || 70} km</span>
                            </div>
                            <div>
                              <span className="font-extrabold text-white text-base block">{t.userArrTime || t.arrival_time}</span>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold">{destination}</span>
                              <span className="text-[9px] text-slate-400 font-extrabold bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 inline-block mt-0.5">
                                {t.arrPlatform || 'PF 2'}
                              </span>
                            </div>
                          </div>

                          {/* Live Running Status Action Button */}
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLiveStatusModalTrain(t);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 hover:border-brand-500 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm group"
                              title="View live station-by-station running status and schedule"
                            >
                              <Radio className="w-3.5 h-3.5 animate-pulse text-brand-400" />
                              <span>Live Running Status</span>
                            </button>
                            <span className="text-[9px] text-slate-500 italic">
                              GPS / Cell Tower Live
                            </span>
                          </div>
                        </div>

                        {/* Live Running Status Mini Ticker */}
                        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              <strong className="text-white">Live Status:</strong> Left <span className="text-emerald-400 font-bold">{t.currentStation || source}</span> ({t.depPlatform}) • Speed: <span className="text-brand-400 font-bold">{t.speed || 88} km/h</span> • Next Stop: <span className="text-white font-bold">{t.nextStation || destination}</span>
                            </span>
                          </div>
                          {/* Coach position preview */}
                          <div className="flex items-center gap-1 overflow-x-auto text-[9px] text-slate-400 font-mono">
                            <span className="text-[9px] text-slate-500 font-sans uppercase font-bold mr-1">Rake:</span>
                            <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">ENG</span>
                            <span className="px-1 py-0.5 rounded bg-slate-900 text-slate-500">SLR</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">A (3A)</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">B (3A)</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold">C (SL)</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold">D (SL)</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">E (2S)</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">F (2S)</span>
                            <span className="px-1 py-0.5 rounded bg-slate-900 text-slate-500">SLR</span>
                          </div>
                        </div>

                        {/* Class buttons cards */}
                        <div className="p-4 bg-slate-900/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {classesInfo.map(cls => {
                            const isClassSelected = isTrainSelected && selectedClass === cls.code;
                            const isAvail = cls.avail > 0;
                            
                            return (
                              <button
                                key={cls.code}
                                onClick={() => handleSelectTrainAndClass(t, cls.code)}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                  isClassSelected 
                                    ? 'bg-brand-500/10 border-brand-500/80 shadow-inner shadow-brand-500/5' 
                                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-extrabold text-xs text-slate-200">{cls.code}</span>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">{cls.name}</span>
                                </div>
                                <div className="flex justify-between items-baseline mt-2">
                                  <span className="font-extrabold text-base text-white">₹{cls.fare}</span>
                                  <span className={`text-[10px] font-extrabold ${isAvail ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {isAvail ? `${cls.avail} Seats` : 'WL Available'}
                                  </span>
                                </div>
                                {(user?.priority === 'P1_SENIOR' || user?.priority === 'P2_DISABLED') && (
                                  <div className="text-[9px] text-brand-400 font-bold mt-1">
                                    ✓ 50% Concession Applied
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Seating Grid and summary loaded when train selected */}
                {selectedTrain && (
                  <>
                    <hr className="border-slate-900 my-8" />
                    
                    <h3 className="font-extrabold text-white text-base mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-brand-400" />
                      Seating Allocation & Map Choice
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      
                      {/* Left: Interactive Coach Grid */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* Booking Mode Selector */}
                        {selectedFamily.length === 0 && (
                          <div className="bg-glass p-3 rounded-2xl border border-slate-900 flex gap-2">
                            <button
                              onClick={() => setIsAiMode(true)}
                              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                                isAiMode 
                                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10' 
                                  : 'hover:bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Sparkles className="w-4 h-4" />
                              AI Agent Auto-Allocation
                            </button>
                            
                            <button
                              onClick={() => setIsAiMode(false)}
                              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                                !isAiMode 
                                  ? 'bg-brand-600 text-white shadow-md' 
                                  : 'hover:bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Armchair className="w-4 h-4" />
                              Manual Seat Map Choice
                            </button>
                          </div>
                        )}

                        {/* Coach Seating Grid Section */}
                        {(!isAiMode || selectedFamily.length > 0) && (
                          <div className="bg-glass p-6 rounded-3xl border border-slate-900 shadow-glass space-y-6">
                            
                            {/* Coach select tabs */}
                            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs font-semibold">Selected Coach:</span>
                                <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  {activeCoaches.map(c => {
                                    const coachLabel = { A: '3A', B: '3A', C: 'SL', D: 'SL', E: '2S', F: '2S' };
                                    return (
                                      <button
                                        key={c}
                                        onClick={() => { setSelectedCoach(c); setSelectedSeatId(null); setSelectedSeatNumber(''); }}
                                        className={`w-9 h-9 rounded-lg text-xs font-extrabold flex flex-col items-center justify-center transition-all ${
                                          selectedCoach === c 
                                            ? 'bg-brand-600 text-white shadow-md' 
                                            : 'text-slate-500 hover:text-white hover:bg-slate-900/60'
                                        }`}
                                      >
                                        <span>{c}</span>
                                        <span className="text-[8px] opacity-75 font-bold tracking-tight">{coachLabel[c]}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="text-[10px] text-slate-400 font-semibold uppercase bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                                {selectedCoach === 'A' ? 'AC 3-Tier (3A) — Seniors/Disabled Priority' :
                                 selectedCoach === 'B' ? 'AC 3-Tier (3A) — Ladies Only' :
                                 selectedCoach === 'C' ? 'Sleeper Class (SL) — General Seating' :
                                 selectedCoach === 'D' ? 'Sleeper Class (SL) — General Seating' :
                                 selectedCoach === 'E' ? 'Second Sitting (2S) — General Seating' :
                                 'Second Sitting (2S) — General Seating'}
                              </div>
                            </div>

                            {/* Legends */}
                            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pb-2 border-b border-slate-900">
                              <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded bg-emerald-500/15 border border-emerald-500/30"></div>
                                <span className="text-emerald-400 font-bold">Green:</span> Available (Seat booking Availability)
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded bg-rose-500/15 border border-rose-500/30"></div>
                                <span className="text-rose-400 font-bold">Red:</span> Already Booked / Occupied
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-500"></div>
                                <span className="text-blue-400 font-bold">Blue:</span> Your Selection (May Book / Cancel)
                              </div>
                            </div>

                            {/* Interactive Seat Grid */}
                            {loadingMap ? (
                              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-2" />
                                <span>Loading coach grid...</span>
                              </div>
                            ) : seatMap.length === 0 ? (
                              <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-950/50 rounded-2xl border border-slate-900">
                                <Armchair className="w-8 h-8 text-slate-600 mb-2" />
                                <span className="text-xs font-semibold text-slate-400">Loading or no seats found for Coach {selectedCoach}</span>
                                <button
                                  type="button"
                                  onClick={fetchSeatMap}
                                  className="mt-3 px-3 py-1.5 bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg text-xs hover:bg-brand-600/30 transition-all font-semibold"
                                >
                                  Retry Loading Coach
                                </button>
                              </div>
                            ) : (
                              <div>
                                {selectedFamily.length > 0 && (
                                  <div className="p-3 mb-4 text-xs bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded-xl">
                                    ℹ️ Family booking allocates adjacent seats in Coach <strong>{selectedCoach}</strong> dynamically. Refer to coach layout below.
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-8 gap-2.5 max-w-md mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-900">
                                  {seatMap.map(seat => {
                                    const isAvailable = seat.status === 'AVAILABLE';
                                    const isSelected = selectedSeatId === seat.id;
                                    
                                    let seatBgClass = 'bg-rose-500/10 border-rose-500/25 text-rose-400 cursor-not-allowed';
                                    if (isAvailable) {
                                      if (isSelected) {
                                        seatBgClass = 'bg-blue-600 border-blue-500 text-white animate-pulse shadow-md shadow-blue-500/25';
                                      } else {
                                        seatBgClass = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20';
                                      }
                                    }

                                    return (
                                      <button
                                        key={seat.id}
                                        disabled={!isAvailable || selectedFamily.length > 0}
                                        onClick={() => {
                                          setSelectedSeatId(seat.id);
                                          setSelectedSeatNumber(seat.number);
                                        }}
                                        className={`aspect-square rounded-xl border text-[10px] font-extrabold flex flex-col items-center justify-center transition-all ${seatBgClass}`}
                                      >
                                        <Armchair className="w-3.5 h-3.5 mb-0.5" />
                                        {seat.number.split('-')[1]}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Suggestion Mode Info */}
                        {isAiMode && selectedFamily.length === 0 && (
                          <div className="bg-glass p-8 rounded-3xl border border-slate-900 shadow-glass text-center space-y-6 flex flex-col items-center justify-center py-12">
                            <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 shadow-glass-bright animate-bounce">
                              <Sparkles className="w-8 h-8" />
                            </div>
                            <div className="max-w-md">
                              <h3 className="font-extrabold text-white text-lg mb-2">AI Seat Suggester Agent</h3>
                              <p className="text-sm text-slate-400 leading-relaxed">
                                Our AI Agent reads your <strong>{user?.priority?.replace('_', ' ')}</strong> priority tier and automatically matches you with the best available seat, prioritizing accessibility, closeness to exits, and seating zones.
                              </p>
                            </div>
                            <div className="flex gap-6 pt-4 border-t border-slate-900/60 w-full max-w-sm justify-center">
                              <div className="text-center">
                                <span className="text-[10px] text-slate-500 font-bold block uppercase">Your Priority</span>
                                <span className="text-sm font-bold text-white">{user?.priority?.split('_')[0]}</span>
                              </div>
                              <div className="w-px h-8 bg-slate-900"></div>
                              <div className="text-center">
                                <span className="text-[10px] text-slate-500 font-bold block uppercase">Target Zone</span>
                                <span className="text-sm font-bold text-white">
                                  {user?.priority === 'P1_SENIOR' ? 'Coach A (Rows 1-4)' :
                                   user?.priority === 'P2_DISABLED' ? 'Coach A (Rows 5-8)' :
                                   user?.priority === 'P3_FEMALE' ? 'Coach B (Ladies)' :
                                   'Coach C-F (General)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Summary details */}
                      <div className="lg:col-span-1">
                        <div className="bg-glass p-5 rounded-3xl border border-slate-900 shadow-glass space-y-5 sticky top-24">
                          <h3 className="font-bold text-white text-sm uppercase tracking-wide text-brand-300">
                            2. Summary
                          </h3>

                          <div className="space-y-4 text-xs">
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">Train</span>
                              <span className="font-semibold text-slate-200">{currentTrain?.train_name}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">Date</span>
                              <span className="font-semibold text-slate-200">{journeyDate}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">From</span>
                              <span className="font-semibold text-slate-200">{source}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">To</span>
                              <span className="font-semibold text-slate-200">{destination}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">Class</span>
                              <span className="font-bold text-indigo-400 uppercase">
                                {selectedClass === '3A' ? 'AC 3-Tier (3A)' :
                                 selectedClass === 'SL' ? 'Sleeper Class (SL)' :
                                 'Second Sitting (2S)'}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">Seat Allocation</span>
                              <span className="font-bold text-brand-400 uppercase">
                                {selectedFamily.length > 0 ? 'AI adjacent' : 
                                 isAiMode ? 'AI Suggestion' : (selectedSeatNumber || 'Select Seat')}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-900 pb-2">
                              <span className="text-slate-400">Estimated Fare</span>
                              <div className="text-right">
                                <span className="font-extrabold text-sm text-indigo-400">
                                  ₹{Math.round(calculateFare(source, destination, user?.priority, selectedClass) * (
                                    getOccupancyRate() >= 0.8 ? 1.5 :
                                    getOccupancyRate() >= 0.5 ? 1.2 :
                                    getOccupancyRate() < 0.2 ? 0.9 : 1.0
                                  ) * 100) / 100}
                                </span>
                                {getOccupancyRate() >= 0.5 && (
                                  <span className="text-[9px] text-rose-400 font-bold block uppercase mt-0.5 animate-pulse">
                                    {getOccupancyRate() >= 0.8 ? '🔥 1.5x Surge pricing' : '📈 1.2x Demand Surge'}
                                  </span>
                                )}
                                {getOccupancyRate() < 0.2 && (
                                  <span className="text-[9px] text-emerald-400 font-bold block uppercase mt-0.5">
                                    📉 10% Demand Discount
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={handleInitiateBooking}
                            disabled={bookingLoading || (!isAiMode && !selectedSeatId && selectedFamily.length === 0)}
                            className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                          >
                            {bookingLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Allocating & Locking...
                              </>
                            ) : (
                              <>
                                Lock Seating & Checkout
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                    </div>
                  </>
                )}

              </div>
            )}

          </div>
        </div>
      </main>

      {/* Live Running Status Modal */}
      {liveStatusModalTrain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base">
                      {liveStatusModalTrain.train_name}
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-bold rounded-lg uppercase font-mono">
                      {liveStatusModalTrain.train_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live GPS Running Status & Route Schedule
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLiveStatusModalTrain(null)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Telemetry Bar */}
            <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-800/80 grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Status</span>
                <span className={`text-xs font-extrabold ${liveStatusModalTrain.delayMins > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {liveStatusModalTrain.delayBadge || 'ON TIME'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Speed</span>
                <span className="text-xs font-extrabold text-brand-400">
                  {liveStatusModalTrain.speed || 88} km/h
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Signal Source</span>
                <span className="text-xs font-extrabold text-slate-300 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cell Tower GPS
                </span>
              </div>
            </div>

            {/* Content: Station Timeline */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  Station Itinerary & Platform Schedule
                </span>
                <span className="text-[10px] text-slate-500">
                  Total Distance: ~{liveStatusModalTrain.journeyDist || 75} km
                </span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {(liveStatusModalTrain.timeline || []).map((st, i) => {
                  return (
                    <div key={i} className="relative flex items-start justify-between gap-4 text-xs">
                      {/* Timeline dot */}
                      <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        st.isCurrent 
                          ? 'bg-brand-500 border-brand-300 ring-4 ring-brand-500/20' 
                          : st.isPassed 
                          ? 'bg-emerald-500 border-emerald-400' 
                          : 'bg-slate-900 border-slate-700'
                      }`}>
                        {st.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                      </div>

                      {/* Station Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{st.name}</span>
                          <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 font-bold rounded">
                            {st.code}
                          </span>
                          <span className="px-1.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[10px] font-bold rounded">
                            {st.platform}
                          </span>
                          {st.isCurrent && (
                            <span className="px-2 py-0.5 bg-brand-500 text-white font-extrabold text-[9px] rounded-full uppercase tracking-wider animate-pulse">
                              Current Train Location
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Distance: {st.distanceKm} km from origin
                        </span>
                      </div>

                      {/* Scheduled / Actual Times */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Arr:</span>
                          <span className="font-mono text-slate-300 font-bold">{st.schArr}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold ml-1">Dep:</span>
                          <span className="font-mono text-slate-300 font-bold">{st.schDep}</span>
                        </div>
                        <span className={`text-[10px] font-bold mt-0.5 block ${
                          st.isPassed 
                            ? 'text-emerald-400' 
                            : st.isCurrent 
                            ? 'text-brand-400 font-extrabold' 
                            : 'text-slate-500'
                        }`}>
                          {st.isPassed ? '✓ Departed' : st.isCurrent ? '📍 Halting Now' : 'Scheduled'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coach Position / Rake Layout Guide */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block mb-2">
                  Coach Sequence & Platform Guide (Rake Formation)
                </span>
                <p className="text-[11px] text-slate-400 mb-3">
                  Check coach order from Engine to Guard Van to position yourself on the platform before arrival:
                </p>
                <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center gap-2 overflow-x-auto font-mono text-[10px]">
                  <span className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 shrink-0 font-bold">
                    🚂 Engine
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 shrink-0">SLR</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 shrink-0">GS</span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                    A (3A)
                  </span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                    B (3A)
                  </span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                    C (SL)
                  </span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                    D (SL)
                  </span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                    E (2S)
                  </span>
                  <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                    F (2S)
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 shrink-0">GS</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 shrink-0">SLR (Guard)</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex justify-between items-center">
              <span className="text-[11px] text-slate-500 italic">
                * Real-time GPS and cellular network tracking updated continuously.
              </span>
              <button
                onClick={() => setLiveStatusModalTrain(null)}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-md shadow-brand-600/20"
              >
                Close Tracking
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Razorpay Simulated payment checkout modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-glass-bright max-w-lg w-full rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-400 animate-pulse" />
                <h3 className="font-extrabold text-white text-base">Razorpay Checkout Sandbox</h3>
              </div>
              <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-1.5 text-amber-400 text-xs font-bold font-sans">
                <Clock className="w-4 h-4 animate-spin" />
                <span>{timerString}</span>
              </div>
            </div>

            {/* Content body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {!paymentSuccess ? (
                <>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Confirm Locked Tickets</span>
                    
                    <div className="space-y-3">
                      {checkoutResponseList.map((ticket, idx) => (
                        <div key={ticket.id} className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-white font-medium block">
                              Passenger {idx + 1}: {idx === 0 ? user?.name : selectedFamily[idx - 1]?.name}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {ticket.waitlist_position 
                                ? `Placed on Waitlist (${ticket.waitlist_position})` 
                                : `Coach ${ticket.coach} / Seat ${ticket.seat_number}`}
                            </span>
                          </div>
                          <span className="font-bold text-brand-400">₹{ticket.fare}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                      <span className="text-slate-400 text-xs font-bold uppercase">Total Amount</span>
                      <span className="text-base font-extrabold text-white">₹{totalFare}</span>
                    </div>
                  </div>

                  {/* Payment option selection */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Select Payment Mode</span>
                    <div className="grid grid-cols-2 gap-3">
                      {['UPI', 'CARD', 'NET_BANKING', 'WALLET'].map(m => (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod(m)}
                          className={`p-3 border rounded-xl text-xs font-semibold transition-all ${
                            paymentMethod === m 
                              ? 'bg-brand-500/10 border-brand-500 text-brand-400' 
                              : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {m.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sandbox confirmation */}
                  <div className="p-3 bg-amber-500/5 border border-amber-500/10 text-amber-400 rounded-xl text-[10px] leading-relaxed">
                    ⚠️ This is the Razorpay mock sandbox. Clicking "Confirm Payment" simulates a successful Razorpay gateway webhook response, which immediately updates booking status and creates journey QR codes.
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setCheckoutModal(false);
                      }}
                      className="flex-1 py-3 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel Booking
                    </button>
                    <button
                      onClick={handleSimulatePayment}
                      disabled={paymentLoading}
                      className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {paymentLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Confirm Payment (₹{totalFare})
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Payment Success View */
                <div className="text-center space-y-6 py-6 flex flex-col items-center">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full animate-bounce">
                    <Check className="w-8 h-8" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-white">Payment Successful!</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Your tickets have been confirmed and seats secured. Show the QR codes below at station check-in gates.
                    </p>
                  </div>

                  {/* Display QR codes */}
                  <div className="w-full space-y-4">
                    {confirmedBookings.map((cb, idx) => (
                      <div key={cb.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                        <div className="flex items-center gap-4">
                          {cb.qr_code ? (
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
                                  ? window.location.origin.replace('localhost', '10.169.183.135').replace('127.0.0.1', '10.169.183.135') + `/scan-gate/${cb.id}`
                                  : window.location.origin + `/scan-gate/${cb.id}`
                              )}`} 
                              alt="Confirmed QR" 
                              className="w-20 h-20 bg-white p-1 rounded-xl flex-shrink-0" 
                            />
                          ) : (
                            <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-1.5 text-center text-[8px] text-slate-500 flex-shrink-0">
                              Waitlist Confirmation
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Passenger {idx + 1}</span>
                            <h4 className="font-bold text-white text-sm">
                              {idx === 0 ? user?.name : selectedFamily[idx - 1]?.name}
                            </h4>
                            <div className="flex gap-4 text-[11px] text-slate-400 mt-1">
                              <span>Coach: <strong className="text-white">{cb.coach || 'WL'}</strong></span>
                              <span>Seat: <strong className="text-white">{cb.seat_number || 'WL'}</strong></span>
                              {cb.waitlist_position && (
                                <span className="text-amber-400 font-bold">WL Position: {cb.waitlist_position}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadTicketPdf(cb.id)}
                          disabled={downloadingTicketId === cb.id}
                          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-95 whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          {downloadingTicketId === cb.id ? 'Generating PDF...' : 'Download PDF Ticket'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setCheckoutModal(false);
                      navigate('/dashboard');
                    }}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
