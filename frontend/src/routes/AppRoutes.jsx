// src/routes/AppRoutes.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Employees from "../pages/Employees";
import Settings from "../pages/Settings";
import Calling from "../pages/departments/Calling";
import Prepare from "../pages/departments/Prepare";
import Account from "../pages/departments/Account";
import Payment from "../pages/departments/Payment";
import Reviewer from "../pages/departments/Reviewer";
import ClientsPage from "../pages/ClientsPage";
import ProtectedRoute from "./ProtectedRoute";
import { isLoggedIn, getUser } from "../utils/auth";
import Login from "../pages/Login";

export const AppRoutes = () => {
  const user = getUser();
  const role = user?.role || "";

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route
          path="/login"
          element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Default route */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Main pages */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="employees" element={<Employees />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="settings" element={<Settings />} />

          {/* Department routes */}
          <Route path="departments/calling" element={<Calling role={role} />} />
          <Route path="departments/prepare" element={<Prepare />} />
          <Route path="departments/reviewer" element={<Reviewer />} />
          <Route path="departments/account" element={<Account />} />
          <Route path="departments/payment" element={<Payment />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};
