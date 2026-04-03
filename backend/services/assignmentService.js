// Normalize team names to match schema enum exactly
function normalizeTeamName(name) {
  const validTeams = [
    "RainBow Tax Filings",
    "On Time Tax Filings",
    "GrandTax Filings",
    "TaxFilerWay",
  ];

  return validTeams.find((t) => t === name) || null;
}

// Round-robin assignment logic
function roundRobinAssign(leads, employees, uploaderId, division) {
  if (!Array.isArray(employees) || employees.length === 0) {
    return [];
  }

  const docs = [];
  let index = 0;

  for (const lead of leads) {
    const employee = employees[index % employees.length];
    index++;

    docs.push({
      clientName: lead.clientName || undefined,
      email: lead.email || undefined,
      contactNo: lead.contactNo || undefined,

      // Division (from request)
      division: division || "ColdCalling",

      // Assignment
      assignedTo: employee._id,
      assignedAt: new Date(),

      // Upload info
      uploadedBy: uploaderId,

      // ✅ FIXED IMPORTANT FIELDS
      teamName: normalizeTeamName(employee.teamName),
      teamleadId: employee.teamleadId || null,
      managerId: employee.managerId || null,

      // Defaults
      status: "pending",
      priority: "LOW",
      timeZone: "EST",

      createdAt: new Date(),
    });
  }

  return docs;
}

module.exports = {
  roundRobinAssign,
};