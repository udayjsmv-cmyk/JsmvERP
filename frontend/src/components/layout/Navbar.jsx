import React, { useState, useContext } from "react";
import { logout } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../context/UserContext"; // ✅ ADD

const Navbar = () => {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  const { user } = useContext(UserContext); // ✅ USE CONTEXT

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setDarkMode(!darkMode);
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL.replace("/api", "");

  return (
    <nav className="flex justify-between items-center px-6 py-3 
      bg-gradient-to-r from-[#006989] to-[#00B4D8] 
      dark:from-gray-900 dark:to-gray-800 
      text-white shadow-md">

      {/* Left */}
      <div className="text-lg font-semibold tracking-wide">
        Welcome,{" "}
        <span className="font-bold">
          {user?.FirstName} {user?.LastName}
        </span>
      </div>

      {/* Right */}
      <div className="relative flex items-center gap-3">

        {/* Name + Role */}
        <div className="hidden md:flex flex-col text-right leading-tight">
          <span className="font-semibold text-sm">
            {user?.FirstName} {user?.LastName}
          </span>
          <span className="text-xs opacity-80 capitalize">
            {user?.role}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative">
          <img
            src={
              user?.profilePic?.fileUrl
                ? `${baseUrl}${user.profilePic.fileUrl}`
                : "https://i.pravatar.cc/40"
            }
            alt="profile"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-11 h-11 rounded-full cursor-pointer border-2 border-white object-cover shadow-md hover:scale-105 transition"
          />

          {/* Online dot */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></span>
        </div>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-14 w-56 
            backdrop-blur-md bg-white/90 dark:bg-gray-800/90
            text-black dark:text-white 
            rounded-xl shadow-2xl py-2 z-50 border border-gray-200 dark:border-gray-700">

            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="font-semibold">
                {user?.FirstName} {user?.LastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>

            <button
              onClick={() => {
                navigate("/profile");
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              👤 Profile
            </button>

            <button
              onClick={() => {
                navigate("/settings");
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              ⚙️ Settings
            </button>

            <button
              onClick={toggleTheme}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>

            <hr className="border-gray-200 dark:border-gray-700 my-1" />

            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
