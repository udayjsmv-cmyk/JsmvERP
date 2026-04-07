import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiEye, FiEyeOff, FiUpload } from "react-icons/fi";
import { getUser } from "../utils/auth";
import { SettingsContext } from "../context/SettingsContext";
import "../App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const Profile = () => {
  const { t, theme } = useContext(SettingsContext);
  const loggedUser = getUser();

  const [user, setUser] = useState({
    FirstName: "",
    LastName: "",
    email: "",
    role: "",
    profilePic: null
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [preview, setPreview] = useState("");

  // ✅ Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
          setError("Not authenticated. Please login again.");
          return;
        }

        const res = await axios.get(`${API_BASE}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data?.user || res.data;
        setUser(data);
       if (data.profilePic?.fileUrl) {
        const baseUrl = API_BASE.replace("/api", ""); // http://localhost:8080
        const fullUrl = `${baseUrl}${data.profilePic.fileUrl}`;

        setPreview(fullUrl);
      }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleEditToggle = () => setEditing((prev) => !prev);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordToggle = () => setShowPassword((prev) => !prev);

  // ✅ Image Upload Preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setPreview(imageUrl);
      setUser((prev) => ({ ...prev, profilePic: file }));
    }
  };

  // ✅ Save Profile Changes
const handleSave = async () => {
  try {
    setLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Not authenticated. Please log in again.");
      return;
    }

    // ✅ Update basic details
    await axios.put(
      `${API_BASE}/auth/profile`,
      {
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // ✅ Upload profile pic separately
    if (user.profilePic instanceof File) {
      const imgData = new FormData();
      imgData.append("profilePic", user.profilePic);

      await axios.put(`${API_BASE}/auth/profile-pic`, imgData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
    }

    alert("Profile updated successfully!");
    setEditing(false);
  } catch (err) {
    console.error(err);
    alert(err.response?.data?.message || "Failed to update profile");
  } finally {
    setLoading(false);
  }
};
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg font-semibold text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-center mt-6">{error}</p>;
  }

  return (
    <div
      className={`max-w-4xl mx-auto mt-10 p-8 rounded-2xl shadow-lg transition-transform hover:-translate-y-2 hover:shadow-xl
        ${theme === "dark"
          ? "bg-[#002B3D] text-[#F1FAFA]"
          : "bg-[#F1FAFA] text-[#002B3D]"
        }`}
    >
      <div className="flex flex-col md:flex-row items-center md:items-start md:space-x-10">
        {/* Profile Image */}
        <div className="flex flex-col items-center space-y-4">
          <img
            src={preview || "/default-avatar.png"}
            alt="Profile"
            className={`w-40 h-40 rounded-full border-4 object-cover transition-transform duration-300 hover:scale-105
      ${theme === "dark" ? "border-[#00B4D8]" : "border-[#006989]"}`}
          />

          {editing && (
            <label
              className="cursor-pointer flex items-center gap-2 px-5 py-2 rounded-lg text-white font-semibold shadow-md transition duration-300 transform hover:scale-105 hover:shadow-[0_0_15px_rgba(0,180,216,0.6)]"
              style={{
                background: "linear-gradient(135deg, #006989, #00B4D8, #7F00FF)",
                backgroundSize: "300% 300%",
                animation: "gradientShift 6s ease infinite",
              }}
            >
              <FiUpload />
              {t.changePhoto || "Change Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Profile Details */}
        <div className="flex-1 w-full mt-6 md:mt-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-semibold text-blue">
              {user.FirstName} {user.LastName}
            </h2>

            <button
              onClick={handleEditToggle}
              className={`px-5 py-2 rounded-lg font-semibold text-white shadow-md transition duration-300 transform hover:scale-105 ${editing
                ? "bg-red-500 hover:bg-red-600"
                : ""
                }`}
              style={
                editing
                  ? {}
                  : {
                    background: "linear-gradient(135deg, #006989, #00B4D8, #7F00FF)",
                    backgroundSize: "300% 300%",
                    animation: "gradientShift 6s ease infinite",
                  }
              }
            >
              {editing ? t.cancel || "Cancel" : t.editProfile || "Edit Profile"}
            </button>
          </div>

          <p className="mb-6 text-lg">
            {t.role || "Role"}:{" "}
            <span className="font-semibold capitalize">{user.role}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-blue">
            {/* First Name */}
            <div>
              <label className="block mb-2 font-medium">
                {t.firstName || "First Name"}
              </label>
              <input
                type="text"
                name="FirstName"
                value={user.FirstName}
                disabled={!editing}
                onChange={handleChange}
                className={`text-black px-4 py-2 rounded-lg border focus:outline-none transition-colors
                  ${editing
                    ? "border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]"
                    : theme === "dark"
                      ? "border-[#00B4D8] bg-[#002B3D]"
                      : "border-[#006989] bg-[#F1FAFA]"
                  }`}
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block mb-2 font-medium">
                {t.lastName || "Last Name"}
              </label>
              <input
                type="text"
                name="LastName"
                value={user.LastName}
                disabled={!editing}
                onChange={handleChange}
                className={`text-black px-4 py-2 rounded-lg border focus:outline-none transition-colors
                  ${editing
                    ? "border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]"
                    : theme === "dark"
                      ? "border-[#00B4D8] bg-[#002B3D]"
                      : "border-[#006989] bg-[#F1FAFA]"
                  }`}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block mb-2 font-medium">
                {t.email || "Email"}
              </label>
              <input
                type="email"
                name="email"
                value={user.email}
                disabled={!editing}
                onChange={handleChange}
                className={`text-black px-4 py-2 rounded-lg border focus:outline-none transition-colors
                  ${editing
                    ? "border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]"
                    : theme === "dark"
                      ? "border-[#00B4D8] bg-[#002B3D]"
                      : "border-[#006989] bg-[#F1FAFA]"
                  }`}
              />
            </div>
          </div>

          {/* Save Button */}
          {editing && (
            <div className="mt-8">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-3 text-white font-semibold rounded-lg shadow-md transition duration-300 transform hover:scale-105 hover:shadow-[0_0_15px_rgba(0,180,216,0.6)]"
                style={{
                  background: "linear-gradient(135deg, #00B16A, #00B4D8, #7F00FF)",
                  backgroundSize: "300% 300%",
                  animation: "gradientShift 6s ease infinite",
                }}
              >
                {loading
                  ? t.saving || "Saving..."
                  : t.saveSettings || "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
