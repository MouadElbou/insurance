import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeBulkStats } from "@/hooks/useEmployeeBulkStats";
import { useEmployeesStore } from "@/stores/employees.store";
import { EmployeeCard } from "@/components/employees/EmployeeCard";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EmployeeDeleteDialog } from "@/components/employees/EmployeeDeleteDialog";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@insurance/shared";
import { ChevronRight, UserPlus, Headset } from "lucide-react";

const BAR_HEIGHTS = [65, 45, 85, 55, 95, 75];
const BAR_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];

function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const {
    employees,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  } = useEmployees();
  const { statsMap } = useEmployeeBulkStats();
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
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
            <span>Équipe</span>
            <ChevronRight className="h-2.5 w-2.5" />
            <span className="text-primary">Collaborateurs</span>
          </nav>
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface">
            Collaborateurs
          </h2>
          <p className="text-on-surface-variant mt-1">
            Gérez les accès et suivez la performance de votre équipe de
            courtage.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="group px-6 py-3 bg-white border border-outline-variant/30 rounded-xl font-bold text-primary flex items-center gap-3 hover:bg-primary hover:text-white transition-all duration-300 shadow-sm"
        >
          <UserPlus className="h-5 w-5 transition-transform group-hover:rotate-90" />
          Ajouter un Collaborateur
        </button>
      </div>

      {/* Employee cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee, index) => (
            <div
              key={employee.id}
              className="animate-slide-up"
              style={{
                animationDelay: `${Math.min(index * 50, 300)}ms`,
                animationFillMode: "both",
              }}
            >
              <EmployeeCard
                employee={employee}
                index={index}
                stats={statsMap[employee.id]}
                onView={handleView}
              />
            </div>
          ))}
        </div>
      )}

      {/* Management Insights */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold tracking-tight mb-6">
              Performance de l'Équipe
            </h3>
            <div className="flex items-end gap-1 h-48 mb-6">
              {BAR_HEIGHTS.map((height, i) => (
                <div
                  key={i}
                  className={`flex-1 ${i === BAR_HEIGHTS.length - 1 ? "bg-primary" : "bg-primary/20"} rounded-t-lg transition-all hover:bg-primary/40 group relative`}
                  style={{ height: `${height}%` }}
                >
                  {(i === 0 || i === BAR_HEIGHTS.length - 1) && (
                    <div
                      className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-white px-2 py-1 rounded text-[10px] ${i === BAR_HEIGHTS.length - 1 ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity whitespace-nowrap`}
                    >
                      {BAR_LABELS[i]}:{" "}
                      {i === 0 ? "1.2M" : "4.8M"}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {BAR_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
          {/* Decorative blur */}
          <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-1 glass-card border border-white/50 rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-bold tracking-tight mb-6">
            Dernières Activités
          </h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-1 bg-secondary rounded-full" />
              <div>
                <p className="text-sm font-bold text-on-surface">
                  Nouvelle Police Validée
                </p>
                <p className="text-xs text-on-surface-variant">
                  Par Ahmed M. &bull; Il y a 12 min
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-1 bg-tertiary rounded-full" />
              <div>
                <p className="text-sm font-bold text-on-surface">
                  Modification de Profil
                </p>
                <p className="text-xs text-on-surface-variant">
                  Sara B. a mis à jour ses accès
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-1 bg-primary rounded-full" />
              <div>
                <p className="text-sm font-bold text-on-surface">
                  Objectif Mensuel Atteint
                </p>
                <p className="text-xs text-on-surface-variant">
                  Équipe Commerciale &bull; +15% vs Mai
                </p>
              </div>
            </div>
          </div>
          <button className="w-full mt-8 py-3 border border-outline-variant/30 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
            Journal complet
          </button>
        </div>
      </div>

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

      {/* FAB */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-105 transition-transform group z-50">
        <Headset className="h-6 w-6" />
        <span className="absolute right-full mr-4 px-3 py-1 bg-on-surface text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Support Équipe
        </span>
      </button>
    </div>
  );
}
