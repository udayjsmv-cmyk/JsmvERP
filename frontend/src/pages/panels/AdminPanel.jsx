import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminPanel() {
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  

  const [filters, setFilters] = useState({
    team: "",
    employee: "",
    status: "",
    search: "",
    division: "",
  });

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({});
  const [pipeline, setPipeline] = useState({
    stages: {},
    categories: {},
  });

  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [searchTimeout, setSearchTimeout] = useState(null);

  const categoryOrder = [
    "ColdCalling",
    "FollowUp",
    "Registered",
    "Un-paid",
    "Paid",
    "PST",
    "H4-EAD",
    "High-Income",
    "Business",
  ];
  const [previewUrl, setPreviewUrl] = useState(null);
const [showPreview, setShowPreview] = useState(false);

  // ================= FETCH =================
  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [filters, page]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients", {
        params: { ...filters, page, limit: 10 },
      });

      setClients(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      console.error("Client fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/clients/employees");
      setEmployees(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const [statsRes, pipeRes] = await Promise.all([
        api.get("/clients/dashboard-stats"),
        api.get("/clients/pipeline-stats"),
      ]);

      setStats(statsRes.data || {});
      setPipeline(pipeRes.data || {});
    } catch (err) {
      console.error("Dashboard error", err);
    }
  };
const openPreview = (fileId, fileName) => {
  if (!fileId) {
    alert("File not available");
    return;
  }

  const url = `http://localhost:8080/api/clients/document/${fileId}`;

  const ext = (fileName || "").split(".").pop().toLowerCase();

  let type = "other";
  if (ext === "pdf") type = "pdf";
  else if (["jpg", "jpeg", "png"].includes(ext)) type = "image";
  else type = "other";

  setPreviewUrl({ url, type }); 
  setShowPreview(true);
};
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "search") {
      clearTimeout(searchTimeout);

      const timeout = setTimeout(() => {
        setFilters((prev) => ({ ...prev, search: value }));
        setPage(1);
      }, 400);

      setSearchTimeout(timeout);
    } else {
      setFilters((prev) => ({ ...prev, [name]: value }));
      setPage(1);
    }
  };

  const applyCategoryFilter = (cat) => {
    setFilters((prev) => ({
      ...prev,
      division: prev.division === cat ? "" : cat,
    }));
    setPage(1);
  };

  // ================= MODAL =================
  const openModal = async (type) => {
    try {
      let url = "";

      if (type === "documents") url = "/clients/documents-grouped";
      if (type === "preparation") url = "/clients/preparation-grouped";
      if (type === "payments") url = "/clients/payments-grouped";

      const res = await api.get(url);

      setModalTitle(type.toUpperCase());
      setModalData(res.data || []);
      setShowModal(true);
    } catch (err) {
      console.error("Modal error", err);
    }
  };

  // ================= UI COMPONENT =================
  const Card = ({ title, value, color, onClick, active }) => (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl shadow cursor-pointer transition transform hover:scale-105 ${color}
      ${active ? "ring-2 ring-black" : ""}`}
    >
      <p className="text-sm">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold">Admin Panel</h1>

      {/* ===== STATS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card title="Total" value={stats.total || 0} color="bg-white" />
        <Card title="Pending" value={stats.pending || 0} color="bg-yellow-100" />
        <Card title="In Progress" value={stats["in-progress"] || 0} color="bg-blue-100" />
        <Card title="Completed" value={stats.completed || 0} color="bg-green-100" />
        <Card title="Failed" value={stats.failed || 0} color="bg-red-100" />
      </div>

      {/* ===== PIPELINE ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          title="Documents"
          value={pipeline?.stages?.documents || 0}
          color="bg-yellow-200"
          onClick={() => openModal("documents")}
        />
        <Card
          title="Preparation"
          value={pipeline?.stages?.preparation || 0}
          color="bg-purple-200"
          onClick={() => openModal("preparation")}
        />
        <Card
          title="Payments"
          value={pipeline?.stages?.payments || 0}
          color="bg-green-300"
          onClick={() => openModal("payments")}
        />
      </div>

      {/* ===== CATEGORY ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {categoryOrder.map((cat) => (
          <Card
            key={cat}
            title={cat}
            value={pipeline?.categories?.[cat] || 0}
            color="bg-white"
            active={filters.division === cat}
            onClick={() => applyCategoryFilter(cat)}
          />
        ))}
      </div>

      {/* ===== FILTERS ===== */}
      <div className="bg-white p-4 rounded-xl shadow flex flex-wrap gap-4">
        <input
          name="search"
          placeholder="Search..."
          onChange={handleChange}
          className="border px-3 py-2 rounded w-60"
        />

        <select name="team" onChange={handleChange} className="border p-2 rounded">
          <option value="">All Teams</option>
          <option value="RainBow Tax Filings">RainBow</option>
          <option value="On Time Tax Filings">On Time</option>
          <option value="GrandTax Filings">GrandTax</option>
          <option value="TaxFilerWay">TaxFilerWay</option>
        </select>

        <select name="employee" onChange={handleChange} className="border p-2 rounded">
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.FirstName} {emp.LastName}
            </option>
          ))}
        </select>

        <select name="status" onChange={handleChange} className="border p-2 rounded">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* ===== TABLE ===== */}
      <div className="bg-white rounded-xl shadow p-4">
        {loading ? (
          <p>Loading...</p>
        ) : clients.length === 0 ? (
          <p>No clients found</p>
        ) : (
          <table className="w-full border text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Team</th>
                <th>Status</th>
                <th>Division</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c._id}>
                  <td>{c.clientName}</td>
                  <td>{c.email}</td>
                  <td>{c.contactNo}</td>
                  <td>{c.teamName}</td>
                  <td>{c.status}</td>
                  <td>{c.division}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">

          <div className="bg-white w-[90%] max-w-6xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">

            <div className="flex justify-between items-center p-5 bg-blue-600 text-white">
              <h2 className="text-xl font-bold">{modalTitle}</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-gray-50">
              {modalData.map((team, i) => (
                <div key={i} className="bg-white rounded-xl shadow border">
                  <div className="px-5 py-3 bg-blue-100 flex justify-between">
                    <h3 className="font-bold">{team.teamName}</h3>
                    <span>{team.employees.length} Employees</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {team.employees.map((emp, j) => {
                      const list =
                        emp.docs ||
                        emp.preparations ||
                        emp.payments ||
                        [];

                      return (
                        <div key={j} className="border p-3 rounded">
                          <div className="flex justify-between">
                            <p>{emp.employeeName}</p>
                            <span>{list.length}</span>
                          </div>

                          <ul className="space-y-3 mt-3">
  {list.map((item, k) => (
    <li
      key={k}
      className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition"
    >
      {/* TOP */}
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold text-gray-800 text-base">
            {item.clientName}
          </p>
          <p className="text-xs text-gray-500">
            {item.email || "-"} | {item.contactNo || "-"}
          </p>
        </div>

        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
          {item.status || "N/A"}
        </span>
      </div>

      {/* META INFO */}
      <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
        <p>
          📅 Uploaded:
          {item.uploadedAt
            ? new Date(item.uploadedAt).toLocaleDateString()
            : "-"}
        </p>
        <p>📂 Division: {item.division || "-"}</p>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 mt-3">

        <button
        onClick={() => openPreview(item._id, item.fileName)}
        className="px-3 py-1 bg-indigo-600 text-white rounded"
      >
        View
      </button>

        {/* DELETE BUTTON */}
        <button
          onClick={async () => {
            if (!window.confirm("Delete this document?")) return;

            try {
              await api.delete(`/clients/document/${item._id}`);
              alert("Deleted Successfully");

              // refresh modal
              setShowModal(false);
            } catch (err) {
              console.error(err);
              alert("Delete failed");
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
        >
          Delete
        </button>
      </div>
    </li>
  ))}
</ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
      {showPreview && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-white w-[90%] h-[90%] rounded-lg relative">

      <button
        onClick={() => setShowPreview(false)}
        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded"
      >
        Close
      </button>

      {/* PDF */}
      {previewUrl?.type === "pdf" && (
        <iframe src={previewUrl.url} className="w-full h-full" />
      )}

      {/* IMAGE */}
      {previewUrl?.type === "image" && (
        <img src={previewUrl.url} className="w-full h-full object-contain" />
      )}

    </div>
  </div>
)}
    </div>
  );
}
