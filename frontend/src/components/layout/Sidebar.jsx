import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getUserRole } from "../../utils/auth";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [deptOpen, setDeptOpen] = useState(false);
  const location = useLocation();
  const role = getUserRole();

  // ✅ Role-based access config
  const roleConfig = {
    admin: {
      dashboard: true,
      employees: true,
      clients: true,
      departments: ["calling", "preparer", "reviewer", "account", "payment"],
    },
    manager: {
      dashboard: true,
      employees: true,
      clients: true,
      departments: ["calling", "preparer", "reviewer", "account", "payment"],
    },
    employee: {
      dashboard: true, // ✅ Dashboard enabled for employee
      employees: false,
      clients: false,
      departments: ["calling"],
    },
    preparer: {
      dashboard: false,
      employees: false,
      clients: false,
      departments: ["prepare"],
    },
    reviewer: {
      dashboard: false,
      employees: false,
      clients: false,
      departments: ["reviewer"],
    },
     // ✅ NEW ROLE: TL (Team Lead)
    teamlead: {
      dashboard: true,
      employees: false,
      clients: false,
      departments: ["calling"],
    },
  };

  const permissions = roleConfig[role] || {};

  useEffect(() => {
    if (location.pathname.startsWith("/departments")) {
      setDeptOpen(true);
    }
  }, [location.pathname]);

  // ✅ Active link styling
  const linkClasses = (path) =>
    `flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
      location.pathname.startsWith(path)
        ? "bg-[#00B4D8] text-[#002B3D] font-semibold"
        : "text-[#F1FAFA] hover:bg-[#00B4D8] hover:text-[#002B3D]"
    }`;

  const isDepartmentActive = location.pathname.startsWith("/departments");

  // ✅ Department label formatter
  const formatLabel = (name) =>
    name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div
      className={`flex flex-col h-screen transition-all duration-300 shadow-lg ${
        isOpen ? "w-64" : "w-20"
      } bg-[#006989]`}
    >
      {/* Toggle Sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[#F1FAFA] hover:text-[#00B4D8] p-4 focus:outline-none self-start"
      >
        <i className="fa-solid fa-bars text-xl"></i>
      </button>

      {/* Navigation */}
      <nav className="flex flex-col mt-4 space-y-2 flex-1 overflow-auto">
        {/* Dashboard */}
        {permissions.dashboard && (
          <Link to="/dashboard" className={linkClasses("/dashboard")}>
            <i className="fa-solid fa-gauge mr-3 w-5"></i>
            {isOpen && "Dashboard"}
          </Link>
        )}

        {/* Employees */}
        {permissions.employees && (
          <Link to="/employees" className={linkClasses("/employees")}>
            <i className="fa-solid fa-users mr-3 w-5"></i>
            {isOpen && "Employees"}
          </Link>
        )}

        {/* Clients */}
        {permissions.clients && (
          <Link to="/clients" className={linkClasses("/clients")}>
            <i className="fa-solid fa-user-tie mr-3 w-5"></i>
            {isOpen && "Clients"}
          </Link>
        )}

        {/* Departments */}
        {permissions.departments?.length === 1 ? (
          // ✅ Single department
          <Link
            to={`/departments/${permissions.departments[0]}`}
            className={linkClasses(`/departments/${permissions.departments[0]}`)}
          >
            <i className="fa-solid fa-building mr-3 w-5"></i>
            {isOpen && formatLabel(permissions.departments[0])}
          </Link>
        ) : permissions.departments?.length > 1 ? (
          <>
            {/* Dropdown Button */}
            <button
              onClick={() => setDeptOpen(!deptOpen)}
              className={`flex items-center justify-between px-4 py-2 rounded-md w-full focus:outline-none transition-all duration-200 ${
                isDepartmentActive
                  ? "bg-[#00B4D8] text-[#002B3D] font-semibold"
                  : "text-[#F1FAFA] hover:bg-[#00B4D8] hover:text-[#002B3D]"
              }`}
            >
              <div className="flex items-center">
                <i className="fa-solid fa-building mr-3 w-5"></i>
                {isOpen && "Departments"}
              </div>

              {isOpen && (
                <i
                  className={`fa-solid transition-transform duration-200 ${
                    deptOpen ? "fa-chevron-up" : "fa-chevron-down"
                  }`}
                ></i>
              )}
            </button>

            {/* Dropdown Items */}
            {deptOpen && isOpen && (
              <div className="flex flex-col ml-8 space-y-1">
                {permissions.departments.map((dept) => (
                  <Link
                    key={dept}
                    to={`/departments/${dept}`}
                    className={linkClasses(`/departments/${dept}`)}
                  >
                    {formatLabel(dept)}
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}
      </nav>
    </div>
  );
};

export default Sidebar;
