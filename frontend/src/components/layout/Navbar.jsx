import React, { useState, useEffect, useRef, useContext } from "react";
import { logout } from "../../utils/auth";
import { SettingsContext } from "../../context/SettingsContext";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const Navbar = () => {
  const { theme, setTheme } = useContext(SettingsContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePic, setProfilePic] = useState("");
  const dropdownRef = useRef();

  // ✅ Fetch profile image
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get(`${API_BASE}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data?.user || res.data;

        if (data.profilePic?.fileUrl) {
          const baseUrl = API_BASE.replace("/api", "");
          setProfilePic(`${baseUrl}${data.profilePic.fileUrl}`);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchProfile();
  }, []);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className="flex justify-between items-center px-6 py-3"
      style={{ backgroundColor: "#006989", color: "#F1FAFA" }}
    >
      {/* Left */}
      <div className="font-semibold text-lg">Dashboard</div>

      {/* Right */}
      <div className="relative" ref={dropdownRef}>
        {/* Profile Image */}
        <img
          src={profilePic || "/default-avatar.png"}
          alt="profile"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-10 h-10 rounded-full cursor-pointer border-2 border-white"
        />

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-3 w-48 bg-white text-black rounded-lg shadow-lg overflow-hidden z-50">
            
            <button
              onClick={() => (window.location.href = "/profile")}
              className="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              👤 Profile
            </button>

            <button
              onClick={() => (window.location.href = "/settings")}
              className="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              ⚙️ Settings
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              className="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
            </button>

            <hr />

            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-red-500 hover:bg-gray-100"
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
