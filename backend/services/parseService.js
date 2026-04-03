const XLSX = require("xlsx");

function parseLeadsFromBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((r) => ({
      clientName: (r.clientName || r.ClientName || r.name || "").toString().trim(),
      email: (r.email || r.Email || "").toString().trim().toLowerCase(),
      contactNo: (r.contactNo || r.ContactNo || r.phone || r.mobile || "").toString().trim()
    }))
    .filter((r) => r.clientName && (r.email || r.contactNo));
}

module.exports = { parseLeadsFromBuffer };
