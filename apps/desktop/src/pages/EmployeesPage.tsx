import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeesStore } from "@/stores/employees.store";
import { EmployeeList } from "@/components/employees/EmployeeList";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EmployeeDeleteDialog } from "@/components/employees/EmployeeDeleteDialog";
import type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@insurance/shared";
import { Users } from "lucide-react";

export function EmployeesPage() {
  const navigate = useNavigate();
  const {
    employees,
    selectedEmployee,
    searchQuery,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    selectEmployee,
  } = useEmployees();
  const setSearchQuery = useEmployeesStore((s) => s.setSearchQuery);

  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(
    null,
  );

  const handleAdd = () => {
    setEditingEmployee(null);
    setShowForm(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDeactivate = (employee: Employee) => {
    setDeletingEmployee(employee);
    setShowDeleteDialog(true);
  };

  const handleView = (employee: Employee) => {
    navigate(`/employees/${employee.id}`);
  };

  const handleFormSubmit = async (
    data: CreateEmployeeInput | UpdateEmployeeInput,
  ) => {
    if (editingEmployee) {
      await updateEmployee(editingEmployee.id, data as UpdateEmployeeInput);
    } else {
      await createEmployee(data as CreateEmployeeInput);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingEmployee) {
      await deleteEmployee(deletingEmployee.id);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerez votre equipe et leurs acces
          </p>
        </div>
      </div>

      {/* Employee list */}
      <EmployeeList
        employees={employees}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onView={handleView}
      />

      {/* Form dialog */}
      <EmployeeForm
        open={showForm}
        onOpenChange={setShowForm}
        employee={editingEmployee}
        onSubmit={handleFormSubmit}
      />

      {/* Delete dialog */}
      <EmployeeDeleteDialog
        employee={deletingEmployee}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
