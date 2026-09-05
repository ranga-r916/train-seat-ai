import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerDashboard from './pages/PassengerDashboard';
import BookSeat from './pages/BookSeat';
import AdminDashboard from './pages/AdminDashboard';
import ArchitectureDashboard from './pages/ArchitectureDashboard';
import RouteIQDashboard from './pages/RouteIQDashboard';
import ScanGate from './pages/ScanGate';
import WebcamScanner from './pages/WebcamScanner';

// Helper to protect routes
const PrivateRoute = ({ children, requireAdmin = false }) => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const parsedUser = JSON.parse(user);
  if (requireAdmin && parsedUser.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Public Scan Gate Route */}
        <Route path="/scan-gate/:bookingId" element={<ScanGate />} />
        
        {/* Public Webcam Scanner Route */}
        <Route path="/scanner" element={<WebcamScanner />} />
        
        {/* Protected Passenger Routes */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <PassengerDashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/architecture" 
          element={
            <PrivateRoute>
              <ArchitectureDashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/route-iq" 
          element={
            <PrivateRoute>
              <RouteIQDashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/book" 
          element={
            <PrivateRoute>
              <BookSeat />
            </PrivateRoute>
          } 
        />

        {/* Protected Admin Route */}
        <Route 
          path="/admin" 
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminDashboard />
            </PrivateRoute>
          } 
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
