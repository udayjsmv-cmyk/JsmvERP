import React, { useState } from "react";
import ClientDataViewer from "../../components/ClientDataViewer";
import { getUserRole, getUser } from "../../utils/auth";
import toast from "react-hot-toast";

const Calling = () => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fetchLeads, setFetchLeads] = useState(false);

  const role = getUserRole();
  const currentUser = getUser();

  const categories = [
    "ColdCalling",
    "FollowUp",
    "Registered",
    "Paid",
    "Un-paid",
    "PST",
    "H4-EAD",
    "High-Income",
    "Business",
  ];

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedCategory) {
      return toast.error("Select category first");
    }

    if (!file) {
      return toast.error("Select a file");
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("division", selectedCategory);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/clients/upload-leads`, // ✅ FIXED
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Upload failed");
      }

      toast.success(
        `Inserted: ${data.inserted}, Failed: ${data.failed}`
      );

      setFile(null);
      setFetchLeads(prev => !prev);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Calling Department</h2>

      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="border p-2 mb-4"
      >
        <option value="">Select Category</option>
        {categories.map(cat => (
          <option key={cat}>{cat}</option>
        ))}
      </select>

      {role === "manager" && (
        <form onSubmit={handleUpload} className="mb-4">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button
            type="submit"
            disabled={uploading}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      )}

      <ClientDataViewer
        role={role}
        currentUser={currentUser}
        division={selectedCategory}
        fetchLeads={fetchLeads}
      />
    </div>
  );
};

export default Calling;
