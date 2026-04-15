import React, { useState, useEffect, useMemo } from "react";
import api from "../api/axios";
import { CSVLink } from "react-csv";
import ClientLeadModal from "./ClientLeadModal";

const STATUS_OPTIONS = ["in-progress", "completed", "pending"];
const WEEK_OPTIONS = [
  { label: "All Data", value: "all" },
  { label: "This Week", value: "this" },
  { label: "Last Week", value: "last" },
];
const PAGE_SIZE = 10;

const ClientDataViewer = ({ title, role, currentUser, division, fetchLeads }) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [weekFilter, setWeekFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(null);

  // --- Load Leads ---
  const loadLeads = async () => {
    setLoading(true);
    try {
      let res;

      if (role === "employee") {
        res = await api.get("/clients/my");
      } else if (role === "teamlead") {
        res = await api.get(`/clients/team/${currentUser.team}`, {
          params: division ? { division } : {},
        });
      } else if (["manager", "admin", "superadmin"].includes(role)) {
        if (division) {
          res = await api.get(`/clients/division/${encodeURIComponent(division)}`);
        } else {
          res = await api.get("/clients");
        }
      }  

      const leads = Array.isArray(res.data) ? res.data : [];
      setData(leads);
      setFilteredData(leads);
      setCurrentPage(1);
    } catch (err) {
      console.error("Error fetching leads:", err);
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [division, role, fetchLeads]); // Ensure re-fetch on fetchLeads change

  // --- Filtering / search / date ---
  useEffect(() => {
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const getDateFromRow = (row) => {
      if (row.todayCallDate) return new Date(row.todayCallDate);
      if (row.callbackDate) return new Date(row.callbackDate);
      if (row.updatedAt) return new Date(row.updatedAt);
      if (row.createdAt) return new Date(row.createdAt);
      return null;
    };

    let filtered = [...data];

    if (weekFilter !== "all") {
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const lastMonday = new Date(thisMonday.getTime() - oneWeek);
      
      filtered = filtered.filter((row) => {
        const rowDate = new Date(row.updatedAt || row.createdAt);
        return weekFilter === "this"
          ? rowDate >= thisMonday && rowDate <= now
          : rowDate >= lastMonday && rowDate < thisMonday;
      });
    }

    if (dateRange.from && dateRange.to) {
      const from = new Date(dateRange.from);
      const to = new Date(dateRange.to);
      filtered = filtered.filter((row) => {
        const rowDate = new Date(row.updatedAt || row.createdAt);
        return rowDate >= from && rowDate <= to;
      });
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (row) =>
          (row.clientName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (row.email || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [weekFilter, dateRange, data, searchQuery]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  // --- File Upload (manager only) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return alert("No file selected");
    if (!division) return alert("No division selected");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("division", division);

    setUploading(true);
    try {
      const res = await api.post("/clients/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      alert(res.data?.message || "Upload successful");
      await loadLeads();
    } catch (err) {
      console.error("Upload error:", err);
      alert(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openLead = (lead) => setShowLeadModal(lead);
  const closeLead = () => {
    setShowLeadModal(null);
    loadLeads();
  };

  const saveLeadUpdates = async (leadId, payload) => {
    try {
      await api.patch(`/clients/${leadId}/call-log`, payload);
      if (payload.status) {
        await api.patch(`/clients/${leadId}/status`, { status: payload.status });
      }
      await loadLeads();
      alert("Lead updated");
    } catch (err) {
      console.error("Error saving lead updates:", err);
      alert(err?.response?.data?.message || "Update failed");
    }
  };

  const csvData = useMemo(
    () =>
      filteredData.map((row) => ({
        "Client Name": row.clientName,
        Email: row.email,
        "Contact No": row.contactNo,
        Priority: row.priority,
        Division: row.division,
        Status: row.status,
        Remarks: row.remarks || row.notes,
        "Callback Date": row.callbackDate,
        "Today Call Date": row.todayCallDate,
        "Time Zone": row.timeZone,
        Comment: row.comment,
      })),
    [filteredData]
  );

  return (
    <div className="min-h-screen bg-[#F1FAFA] text-[#002B3D] p-6">
      <div className="bg-white shadow-2xl rounded-2xl p-6 border border-[#CCE5E5]">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h2 className="text-3xl font-semibold text-[#006989]">{title}</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search..."
              className="border px-3 py-2 rounded"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              {WEEK_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>

            <CSVLink
              data={csvData}
              filename={`${title}_export.csv`}
              className="bg-[#00B4D8] text-white px-4 py-2 rounded"
            >
              Export CSV
            </CSVLink>

            {/* Upload visible only for manager */}
            {role === "manager" && division && (
              <label
                className={`cursor-pointer bg-[#006989] text-white px-4 py-2 rounded ${uploading ? "opacity-60" : ""}`}
              >
                Upload CSV
                <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-[#CCE5E5] rounded-lg shadow-md">
          {loading ? (
            <p className="text-center py-6">Loading data...</p>
          ) : (
            <>
              <table className="w-full text-left">
                <thead className="bg-[#006989] text-white">
                  <tr>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Contact No</th>
                    <th className="px-4 py-3">Division</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row) => (
                    <tr key={row._id} className="border-b hover:bg-[#E8F7F7]">
                      <td className="px-4 py-2">{row.clientName}</td>
                      <td className="px-4 py-2">{row.email}</td>
                      <td className="px-4 py-2">{row.contactNo}</td>
                      <td className="px-4 py-2">{row.division}</td>
                      <td className="px-4 py-2">{row.status}</td>
                      <td className="px-4 py-2">{row.remarks || row.notes}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => setShowLeadModal(row)}
                          className="bg-[#00B4D8] text-white px-3 py-1 rounded mr-2"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {Math.ceil(filteredData.length / PAGE_SIZE) > 1 && (
                <div className="flex justify-center items-center gap-3 py-3">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    Prev
                  </button>
                  <span>
                    Page {currentPage} of {Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))}
                  </span>
                  <button
                    disabled={currentPage === Math.ceil(filteredData.length / PAGE_SIZE)}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showLeadModal && (
        <ClientLeadModal
          lead={showLeadModal}
          onClose={() => setShowLeadModal(null)}
          reload={loadLeads}
          role={role}
          saveLeadUpdates={saveLeadUpdates}
        />
      )}
    </div>
  );
};

export default ClientDataViewer;
