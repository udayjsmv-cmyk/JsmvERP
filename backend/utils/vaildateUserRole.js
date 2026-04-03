exports.validateUserRole=(department, role)=>{

  if (["admin", "manager"].includes(role) && department !== "Administration") {
    throw new Error("Admin/Manager must belong to Administration department");
  }


  if (department === "Administration" && !["admin", "manager"].includes(role)) {
    throw new Error("Administration department users must be admin or manager");
  }

 
  if (
    department === "PreparationDepartment" &&
    !["preparer", "reviewer", "filer", "corrections"].includes(role)
  ) {
    throw new Error("PreparationDepartment users must be preparer, reviewer, filer, or corrections");
  }


  if (
    ["CallingDepartment", "AccountsDepartment", "PaymentsDepartment"].includes(department) &&
    !["employee", "teamlead"].includes(role)
  ) {
    throw new Error(`${department} users must be 'employee' or 'teamlead'`);
  }

  if (role === "teamlead" && !["CallingDepartment", "Administration"].includes(department)) {
    throw new Error("TeamLead must belong to CallingDepartment or Administration");
  }

  return true;
}
