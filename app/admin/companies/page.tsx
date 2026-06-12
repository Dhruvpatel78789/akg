"use client";

import { useEffect, useState } from "react";
import { 
  Building2, Users, Mail, Phone, MapPin, 
  Percent, FileText, CheckCircle2, AlertTriangle, 
  Trash2, Edit, Plus, X, UploadCloud, Download, Lock, ShieldAlert, Eye
} from "lucide-react";

type Game = {
  _id: string;
  name: string;
};

type GameDiscount = {
  gameId: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
};

type Company = {
  _id: string;
  name: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  billingAddress: string;
  gstNumber?: string;
  allowedGameIds: string[] | Game[];
  discountPercentage: number;
  gameDiscounts?: GameDiscount[];
  status: "ACTIVE" | "INACTIVE";
};

type Employee = {
  _id: string;
  employeeId: string;
  name: string;
  mobile: string;
  email: string;
  address?: string;
  dateOfBirth?: string;
  department?: string;
  designation?: string;
  gender?: string;
  joiningDate?: string;
  emergencyContact?: string;
  notes?: string;
  status: string;
  mustChangePassword?: boolean;
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Tabs
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);

  // Company Modal form
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    billingAddress: "",
    gstNumber: "",
    allowedGameIds: [] as string[],
    discountPercentage: 0,
    gameDiscounts: [] as GameDiscount[],
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  // Game Discount row states inside Company Modal
  const [newDiscGameId, setNewDiscGameId] = useState("");
  const [newDiscType, setNewDiscType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [newDiscValue, setNewDiscValue] = useState(0);

  // Employee Edit / Add Modal form
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showCreateEmployeeModal, setShowCreateEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  
  const [employeeForm, setEmployeeForm] = useState({
    employeeId: "",
    name: "",
    mobile: "",
    email: "",
    address: "",
    dateOfBirth: "",
    department: "",
    designation: "",
    gender: "MALE",
    joiningDate: "",
    emergencyContact: "",
    notes: "",
    status: "ACTIVE"
  });

  // Upload employee CSV states
  const [dragActive, setDragActive] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    success: boolean;
    successCount?: number;
    rejectedCount?: number;
    rejectedRows?: Array<{ rowIndex: number; error: string }>;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const resC = await fetch("/api/admin/companies");
      const dataC = await resC.json();
      if (resC.ok && dataC.success) {
        setCompanies(dataC.companies || []);
      }

      const resG = await fetch("/api/games");
      const dataG = await resG.json();
      if (resG.ok && dataG.success) {
        setGames(dataG.games || []);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load companies data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadEmployees(companyId: string) {
    setEmpLoading(true);
    setUploadResults(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/employees`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEmpLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCompanyId) {
      loadEmployees(selectedCompanyId);
    } else {
      setEmployees([]);
    }
  }, [selectedCompanyId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedCompanyId) return;
    if (!file.name.endsWith(".csv")) {
      setMessage("Please upload a valid CSV file (.csv)");
      return;
    }

    setUploading(true);
    setUploadResults(null);
    setMessage("");

    try {
      const text = await file.text();
      const response = await fetch(`/api/admin/companies/${selectedCompanyId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const data = await response.json();
      setUploading(false);

      if (response.ok && data.success) {
        setUploadResults({
          success: true,
          successCount: data.successCount,
          rejectedCount: data.rejectedCount,
          rejectedRows: data.rejectedRows,
        });
        loadEmployees(selectedCompanyId);
      } else {
        setMessage(data.message || "Failed to process CSV file.");
      }
    } catch {
      setUploading(false);
      setMessage("Network error processing upload.");
    }
  };

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const url = editingCompany 
        ? `/api/admin/companies/${editingCompany._id}` 
        : "/api/admin/companies";
      const method = editingCompany ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(editingCompany ? "Company updated successfully!" : "Company created successfully!");
        setShowCompanyModal(false);
        setEditingCompany(null);
        loadData();
      } else {
        setMessage(data.message || "Operation failed.");
      }
    } catch {
      setMessage("Network error submitting company details.");
    }
  }

  async function handleDeleteCompany(id: string) {
    if (!confirm("Are you sure you want to delete this company?")) return;
    setMessage("");

    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Company deleted successfully.");
        if (selectedCompanyId === id) setSelectedCompanyId(null);
        loadData();
      } else {
        setMessage(data.message || "Delete failed.");
      }
    } catch {
      setMessage("Network error deleting company.");
    }
  }

  // Employee CRUD operations
  function startEditEmployee(emp: any) {
    setSelectedEmployee(emp);
    setEmployeeForm({
      employeeId: emp.employeeId || "",
      name: emp.name,
      mobile: emp.mobile,
      email: emp.email,
      address: emp.address || "",
      dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split("T")[0] : "",
      department: emp.department || "",
      designation: emp.designation || "",
      gender: emp.gender || "MALE",
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "",
      emergencyContact: emp.emergencyContact || "",
      notes: emp.notes || "",
      status: emp.status
    });
    setShowEmployeeModal(true);
  }

  async function handleCreateEmployeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId) return;

    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MANUAL", ...employeeForm })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Employee created successfully");
        setShowCreateEmployeeModal(false);
        loadEmployees(selectedCompanyId);
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Failed to create employee");
      }
    } catch {
      setMessage("Connection error creating employee.");
    }
  }

  async function handleEmployeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee || !selectedCompanyId) return;

    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/employees/${selectedEmployee._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Employee details updated");
        setShowEmployeeModal(false);
        setSelectedEmployee(null);
        loadEmployees(selectedCompanyId);
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Failed to save employee changes");
      }
    } catch {
      setMessage("Connection error updating employee.");
    }
  }

  async function handleResetPassword(empId: string) {
    if (!confirm("Are you sure you want to reset this employee's password?")) return;
    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/employees/${empId}/reset-password`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Password reset to NEW1234\nUser must change password on next login");
      } else {
        alert(data.message || "Failed to reset password");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleEmployeeStatus(emp: Employee) {
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/employees/${emp._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadEmployees(selectedCompanyId!);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteEmployee(empId: string) {
    if (!confirm("Are you sure you want to delete this employee? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/employees/${empId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Employee deleted successfully");
        loadEmployees(selectedCompanyId!);
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Failed to delete employee");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleDownloadTemplate() {
    const csvContent = "employeeId,name,mobile,email,address,dateOfBirth,department,designation\nEMP001,John Doe,9876543210,john@company.com,123 Corporate Way,1990-05-15,Engineering,Developer";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "employee_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDownloadErrorCSV() {
    if (!uploadResults?.rejectedRows) return;
    const headers = "Row Number,Error Description\n";
    const rows = uploadResults.rejectedRows.map(row => `${row.rowIndex},"${row.error.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `upload_errors_${selectedCompanyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleGameCheckbox(gameId: string, checked: boolean) {
    setCompanyForm(prev => {
      const ids = checked 
        ? [...prev.allowedGameIds, gameId] 
        : prev.allowedGameIds.filter(id => id !== gameId);
      return { ...prev, allowedGameIds: ids };
    });
  }

  // Pricing & Game discount list handlers inside Company Form
  function handleAddGameDiscount() {
    if (!newDiscGameId || newDiscValue <= 0) return;
    
    // Check duplication
    if (companyForm.gameDiscounts.some(d => d.gameId === newDiscGameId)) {
      alert("Discount configuration already exists for this game.");
      return;
    }

    const item: GameDiscount = {
      gameId: newDiscGameId,
      discountType: newDiscType,
      discountValue: newDiscValue
    };

    setCompanyForm(prev => ({
      ...prev,
      gameDiscounts: [...prev.gameDiscounts, item]
    }));

    setNewDiscGameId("");
    setNewDiscValue(0);
  }

  function handleRemoveGameDiscount(gameId: string) {
    setCompanyForm(prev => ({
      ...prev,
      gameDiscounts: prev.gameDiscounts.filter(d => d.gameId !== gameId)
    }));
  }

  return (
    <section className="min-w-0 pb-10">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)]">Companies</h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Manage corporate partnerships, employees, and billing rates.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCompany(null);
            setCompanyForm({
              name: "",
              contactPerson: "",
              contactNumber: "",
              email: "",
              billingAddress: "",
              gstNumber: "",
              allowedGameIds: [],
              discountPercentage: 0,
              gameDiscounts: [],
              status: "ACTIVE",
            });
            setShowCompanyModal(true);
          }}
          className="flex h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-6 text-xs font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-md"
        >
          <Plus size={16} />
          Create Company
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5 animate-fade-in">
          {message}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Companies Master List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-black text-[var(--text-muted)] uppercase tracking-wider">Partners</h3>
          {loading ? (
            <p className="text-sm font-bold text-[var(--text-muted)] animate-pulse">Loading companies...</p>
          ) : companies.length === 0 ? (
            <p className="text-sm font-bold text-[var(--text-muted)] bg-white p-4 rounded-2xl ring-1 ring-black/5">No companies configured.</p>
          ) : (
            <div className="grid gap-3">
              {companies.map((c) => {
                const isSelected = selectedCompanyId === c._id;
                return (
                  <div 
                    key={c._id}
                    onClick={() => setSelectedCompanyId(c._id)}
                    className={`rounded-3xl p-5 border text-left cursor-pointer transition relative group ${
                      isSelected 
                        ? "bg-white border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]/20" 
                        : "bg-white border-transparent hover:border-gray-200 shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5 ${
                          c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-gray-150 text-gray-700"
                        }`}>
                          {c.status}
                        </span>
                        <h4 className="text-lg font-black text-[var(--primary)] flex items-center gap-1.5">
                          <Building2 size={18} className="text-gray-400" />
                          {c.name}
                        </h4>
                        <p className="text-xs text-gray-500 font-bold mt-1">Contact: {c.contactPerson}</p>
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCompany(c);
                            setCompanyForm({
                              name: c.name,
                              contactPerson: c.contactPerson,
                              contactNumber: c.contactNumber,
                              email: c.email,
                              billingAddress: c.billingAddress,
                              gstNumber: c.gstNumber || "",
                              allowedGameIds: (c.allowedGameIds || []).map((g: any) => typeof g === "object" ? g._id : g),
                              discountPercentage: c.discountPercentage || 0,
                              gameDiscounts: c.gameDiscounts || [],
                              status: c.status,
                            });
                            setShowCompanyModal(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition"
                          title="Edit Company"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompany(c._id);
                          }}
                          className="p-1.5 hover:bg-rose-50 rounded-full text-rose-600 transition"
                          title="Delete Company"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500">
                      <div className="flex items-center gap-1">
                        <Percent size={12} className="text-gray-400" />
                        <span>Discount: {c.discountPercentage}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText size={12} className="text-gray-400" />
                        <span>GST: {c.gstNumber || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Columns: Company Detail & Employee Management */}
        <div className="lg:col-span-2">
          {selectedCompanyId ? (
            <div className="space-y-6">
              {/* Employee CSV Upload and List Section */}
              <div className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5 space-y-6">
                <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
                  <h3 className="text-lg font-black text-[var(--primary)] flex items-center gap-2">
                    <Users size={20} className="text-gray-400" />
                    Employee Directory ({employees.length})
                  </h3>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEmployeeForm({
                          employeeId: "",
                          name: "",
                          mobile: "",
                          email: "",
                          address: "",
                          dateOfBirth: "",
                          department: "",
                          designation: "",
                          gender: "MALE",
                          joiningDate: "",
                          emergencyContact: "",
                          notes: "",
                          status: "ACTIVE"
                        });
                        setShowCreateEmployeeModal(true);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-black text-white bg-[var(--primary)] px-3 py-1.5 rounded-full hover:opacity-95 transition active:scale-95"
                    >
                      <Plus size={12} />
                      Add Employee
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 text-[11px] font-black text-[var(--primary)] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-100 transition active:scale-95"
                    >
                      <Download size={12} />
                      Sample Template
                    </button>
                  </div>
                </div>

                {/* Default password reference display block */}
                <p className="text-xs font-black text-indigo-700 bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 flex justify-between items-center">
                  <span>Current Default Password: NEW1234</span>
                </p>

                {/* CSV Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    dragActive ? "border-[var(--primary)] bg-emerald-50/20" : "border-gray-200 bg-gray-50/30"
                  }`}
                >
                  <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                    <UploadCloud size={32} className="text-gray-400" />
                    <p className="text-xs font-bold text-gray-700">
                      {uploading ? "Processing CSV..." : "Drag and drop CSV employee data here, or click to browse"}
                    </p>
                    <p className="text-[10px] text-gray-400">CSV must include columns: employeeId, name, mobile, email</p>
                  </label>
                </div>

                {/* Upload Validation Output */}
                {uploadResults && (
                  <div className={`p-4 rounded-2xl border text-xs font-bold ${
                    uploadResults.rejectedCount && uploadResults.rejectedCount > 0 
                      ? "bg-amber-50 border-amber-100 text-amber-900" 
                      : "bg-emerald-50 border-emerald-100 text-emerald-900"
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-black flex items-center gap-1">
                          {uploadResults.rejectedCount && uploadResults.rejectedCount > 0 ? (
                            <AlertTriangle size={14} className="text-amber-600" />
                          ) : (
                            <CheckCircle2 size={14} className="text-emerald-600" />
                          )}
                          CSV Processing Summary
                        </p>
                        <p>✓ Successfully inserted: <span className="font-black text-emerald-700">{uploadResults.successCount || 0} employees</span></p>
                        {uploadResults.rejectedCount && uploadResults.rejectedCount > 0 && (
                          <p>⚠️ Rejected rows: <span className="font-black text-amber-700">{uploadResults.rejectedCount} rows</span></p>
                        )}
                      </div>

                      {uploadResults.rejectedCount && uploadResults.rejectedCount > 0 && (
                        <button
                          onClick={handleDownloadErrorCSV}
                          className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-white border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100/50"
                        >
                          <Download size={11} />
                          Errors Report
                        </button>
                      )}
                    </div>

                    {uploadResults.rejectedRows && uploadResults.rejectedRows.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200/50 space-y-1 max-h-32 overflow-y-auto font-mono text-[10px] text-amber-700">
                        {uploadResults.rejectedRows.slice(0, 5).map((row, idx) => (
                          <p key={idx}>Row {row.rowIndex}: {row.error}</p>
                        ))}
                        {uploadResults.rejectedRows.length > 5 && (
                          <p className="text-gray-400 italic">...and {uploadResults.rejectedRows.length - 5} more error rows.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Employees Table List */}
                {empLoading ? (
                  <p className="text-sm font-bold text-[var(--text-muted)] animate-pulse">Loading employee roster...</p>
                ) : employees.length === 0 ? (
                  <p className="text-sm font-bold text-[var(--text-muted)] py-4 text-center">Roster is empty. Drag a CSV template to populate accounts.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-2xl">
                    <table className="w-full text-left text-xs min-w-[600px]">
                      <thead>
                        <tr className="bg-gray-50 border-b text-[var(--text-muted)] font-black uppercase tracking-wider">
                          <th className="p-3">ID</th>
                          <th>Name</th>
                          <th>Mobile</th>
                          <th>Email</th>
                          <th>Dept / Pos</th>
                          <th>Status</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp) => (
                          <tr key={emp._id} className="border-b last:border-0 hover:bg-gray-50/50 font-bold text-gray-700">
                            <td className="p-3 font-mono font-black text-[var(--primary)]">{emp.employeeId}</td>
                            <td className="font-black text-gray-900">{emp.name}</td>
                            <td>{emp.mobile}</td>
                            <td>{emp.email}</td>
                            <td>{emp.department || emp.designation ? `${emp.department || "-"} / ${emp.designation || "-"}` : "-"}</td>
                            <td>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                emp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-gray-150 text-gray-700"
                              }`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setViewingEmployee(emp);
                                    setShowViewEmployeeModal(true);
                                  }}
                                  className="p-1 hover:bg-gray-150 text-gray-700 rounded transition"
                                  title="View Employee"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => startEditEmployee(emp)}
                                  className="p-1 hover:bg-indigo-50 text-indigo-700 rounded transition"
                                  title="Edit Employee"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleResetPassword(emp._id)}
                                  className="p-1 hover:bg-amber-50 text-amber-600 rounded transition"
                                  title="Reset Password"
                                >
                                  <Lock size={14} />
                                </button>
                                <button
                                  onClick={() => handleToggleEmployeeStatus(emp)}
                                  className={`p-1 rounded transition ${
                                    emp.status === "ACTIVE" ? "hover:bg-rose-50 text-rose-600" : "hover:bg-emerald-50 text-emerald-600"
                                  }`}
                                  title={emp.status === "ACTIVE" ? "Disable Employee" : "Enable Employee"}
                                >
                                  <ShieldAlert size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteEmployee(emp._id)}
                                  className="p-1 hover:bg-red-50 text-red-650 rounded transition"
                                  title="Delete Employee"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm ring-1 ring-black/5 flex flex-col items-center justify-center min-h-[300px]">
              <Building2 size={40} className="text-gray-300" />
              <h4 className="mt-4 text-base font-black text-[var(--primary)]">Select a Corporate Partner</h4>
              <p className="text-xs text-gray-500 font-semibold mt-1">Click a company from the list to manage employees, allowed sports, and discounts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Employee Modal */}
      {showCreateEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in flex flex-col max-h-[90vh]">
            <button
              onClick={() => setShowCreateEmployeeModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-[var(--primary)] mb-4">Add Employee</h3>

            <form onSubmit={handleCreateEmployeeSubmit} className="space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Employee ID</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP100"
                    value={employeeForm.employeeId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
                    className="h-11 border border-gray-250 rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className="h-11 border border-gray-250 rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Mobile</span>
                  <input
                    type="text"
                    required
                    placeholder="10 digits"
                    value={employeeForm.mobile}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                    className="h-11 border border-gray-250 rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Email</span>
                  <input
                    type="email"
                    required
                    placeholder="email@company.com"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="h-11 border border-gray-250 rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Address (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.address}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Date Of Birth (Optional)</span>
                  <input
                    type="date"
                    value={employeeForm.dateOfBirth}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, dateOfBirth: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Department (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Designation (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Gender (Optional)</span>
                  <select
                    value={employeeForm.gender}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, gender: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Joining Date (Optional)</span>
                  <input
                    type="date"
                    value={employeeForm.joiningDate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, joiningDate: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Emergency Contact (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.emergencyContact}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyContact: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Notes (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.notes}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-4 h-12 bg-[var(--primary)] text-white font-black text-xs rounded-xl hover:opacity-90 transition"
              >
                Create Employee account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Details Modal */}
      {showEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setShowEmployeeModal(false);
                setSelectedEmployee(null);
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-[var(--primary)] mb-4">Edit Employee Profile</h3>

            <form onSubmit={handleEmployeeSubmit} className="space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Employee ID</span>
                  <input
                    type="text"
                    required
                    value={employeeForm.employeeId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                  <input
                    type="text"
                    required
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Mobile</span>
                  <input
                    type="text"
                    required
                    value={employeeForm.mobile}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Email</span>
                  <input
                    type="email"
                    required
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Address (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.address}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Date Of Birth (Optional)</span>
                  <input
                    type="date"
                    value={employeeForm.dateOfBirth}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, dateOfBirth: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Department (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Designation (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Gender (Optional)</span>
                  <select
                    value={employeeForm.gender}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, gender: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Joining Date (Optional)</span>
                  <input
                    type="date"
                    value={employeeForm.joiningDate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, joiningDate: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Emergency Contact (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.emergencyContact}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyContact: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Notes (Optional)</span>
                  <input
                    type="text"
                    value={employeeForm.notes}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                    className="h-11 border rounded-xl px-4 text-sm font-bold"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-2 h-11 bg-[var(--primary)] text-white font-black text-xs rounded-xl hover:opacity-90 transition"
              >
                Save Employee Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Details Modal */}
      {showViewEmployeeModal && viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setShowViewEmployeeModal(false);
                setViewingEmployee(null);
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-[var(--primary)] mb-5">Employee Details</h3>

            <div className="space-y-4 overflow-y-auto pr-1 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Employee ID</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.employeeId}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Mobile</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.mobile}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Email</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Department</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.department || "-"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Designation</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.designation || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Gender</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.gender || "-"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Joining Date</span>
                  <p className="font-bold text-gray-800">
                    {viewingEmployee.joiningDate ? new Date(viewingEmployee.joiningDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Date Of Birth</span>
                  <p className="font-bold text-gray-800">
                    {viewingEmployee.dateOfBirth ? new Date(viewingEmployee.dateOfBirth).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Emergency Contact</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.emergencyContact || "-"}</p>
                </div>
              </div>

              <div className="border-b pb-3">
                <span className="text-[10px] font-black uppercase text-gray-400">Address</span>
                <p className="font-bold text-gray-800">{viewingEmployee.address || "-"}</p>
              </div>

              <div className="border-b pb-3">
                <span className="text-[10px] font-black uppercase text-gray-400">Notes</span>
                <p className="font-bold text-gray-800">{viewingEmployee.notes || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Status</span>
                  <p className="mt-1">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      viewingEmployee.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-gray-150 text-gray-700"
                    }`}>
                      {viewingEmployee.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Force Password Change</span>
                  <p className="font-bold text-gray-800">{viewingEmployee.mustChangePassword ? "YES" : "NO"}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowViewEmployeeModal(false);
                setViewingEmployee(null);
              }}
              className="w-full mt-6 h-11 bg-gray-100 text-gray-700 font-black text-xs rounded-xl hover:bg-gray-200 transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in flex flex-col max-h-[90vh]">
            <button
              onClick={() => setShowCompanyModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-black text-[var(--primary)]">
              {editingCompany ? "Modify Company details" : "Create Company Profile"}
            </h3>
            
            <form onSubmit={handleCompanySubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Company Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none text-[var(--primary)]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Contact Person</span>
                  <input
                    type="text"
                    required
                    placeholder="Representative Name"
                    value={companyForm.contactPerson}
                    onChange={(e) => setCompanyForm({ ...companyForm, contactPerson: e.target.value })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Contact Number</span>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit number"
                    value={companyForm.contactNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, contactNumber: e.target.value })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Contact Email</span>
                  <input
                    type="email"
                    required
                    placeholder="e.g. hr@company.com"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">GST Number (Optional)</span>
                  <input
                    type="text"
                    placeholder="GSTIN"
                    value={companyForm.gstNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, gstNumber: e.target.value })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Billing Address</span>
                <input
                  type="text"
                  required
                  placeholder="Address details"
                  value={companyForm.billingAddress}
                  onChange={(e) => setCompanyForm({ ...companyForm, billingAddress: e.target.value })}
                  className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Global Billing Discount (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={companyForm.discountPercentage}
                    onChange={(e) => setCompanyForm({ ...companyForm, discountPercentage: Number(e.target.value) })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Account Status</span>
                  <select
                    value={companyForm.status}
                    onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value as "ACTIVE" | "INACTIVE" })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none bg-white cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
              </div>

              {/* Game Restrictions Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-gray-400">Allowed Sports / Games</span>
                <div className="flex flex-wrap gap-2.5 p-3.5 bg-gray-50 border rounded-2xl">
                  {games.map(game => (
                    <label key={game._id} className="flex items-center gap-2 text-xs font-bold text-[var(--primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companyForm.allowedGameIds.includes(game._id)}
                        onChange={(e) => handleGameCheckbox(game._id, e.target.checked)}
                        className="rounded accent-[var(--primary)]"
                      />
                      {game.name}
                    </label>
                  ))}
                  {games.length === 0 && (
                    <p className="text-[10px] text-gray-400 font-semibold italic">No games configured in system.</p>
                  )}
                </div>
              </div>

              {/* Company Pricing & Game Discounts configuration panel */}
              <div className="space-y-3 border-t pt-4 border-gray-100">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Company Pricing & Game Discounts Override</span>
                
                {/* Add Game Discount Row */}
                <div className="flex gap-2 items-end">
                  <label className="grid gap-1 flex-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Game</span>
                    <select
                      value={newDiscGameId}
                      onChange={(e) => setNewDiscGameId(e.target.value)}
                      className="h-10 border rounded-lg text-xs px-2 bg-white cursor-pointer"
                    >
                      <option value="">Select Game</option>
                      {games.map(g => (
                        <option key={g._id} value={g._id}>{g.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 w-24">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Type</span>
                    <select
                      value={newDiscType}
                      onChange={(e) => setNewDiscType(e.target.value as "PERCENTAGE" | "FLAT")}
                      className="h-10 border rounded-lg text-xs px-2 bg-white cursor-pointer"
                    >
                      <option value="PERCENTAGE">% percentage</option>
                      <option value="FLAT">₹ Flat discount</option>
                    </select>
                  </label>

                  <label className="grid gap-1 w-20">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Value</span>
                    <input
                      type="number"
                      min={0}
                      value={newDiscValue}
                      onChange={(e) => setNewDiscValue(Number(e.target.value))}
                      className="h-10 border rounded-lg text-xs px-2 text-center"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAddGameDiscount}
                    className="h-10 bg-indigo-650 text-white px-3 text-xs font-black rounded-lg hover:bg-indigo-700 active:scale-95"
                  >
                    Add
                  </button>
                </div>

                {/* Render Selected Game Discounts */}
                {companyForm.gameDiscounts.length > 0 && (
                  <div className="border rounded-2xl bg-gray-50/50 p-2 space-y-1 max-h-28 overflow-y-auto">
                    {companyForm.gameDiscounts.map((discount, idx) => {
                      const gameObj = games.find(g => g._id === discount.gameId);
                      return (
                        <div key={idx} className="flex justify-between items-center text-[11px] font-bold text-gray-750 bg-white p-2 rounded-xl border border-black/5">
                          <span>{gameObj ? gameObj.name : "Unknown game"}: {discount.discountType === "PERCENTAGE" ? `${discount.discountValue}%` : `₹${discount.discountValue}`}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGameDiscount(discount.gameId)}
                            className="text-red-500 hover:text-red-700 text-xs font-black"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full mt-4 h-12 bg-[var(--primary)] text-white font-black text-xs rounded-xl hover:opacity-90 transition active:scale-98"
              >
                {editingCompany ? "Save Updates" : "Create Profile"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
