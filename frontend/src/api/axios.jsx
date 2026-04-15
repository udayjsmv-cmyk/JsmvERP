import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://jsmvcrm.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  withCredentials: true,
});

// attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
