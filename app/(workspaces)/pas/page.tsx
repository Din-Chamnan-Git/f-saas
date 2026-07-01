"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import WorkspaceContainer from "@/components/layouts/workspace-container";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type ProjectDto
} from "@/services/projectService";

interface Project {
  id: string;
  projectName: string;
  client: string;
  deployDate: string;
  duration: string;
  contractEnd: string;
  status: string;
  environment: string;
  owner: string;
  notes: string;
}

const adminNavItems = ["Dashboard", "Tenants", "Servers", "PAS Projects", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "PAS Projects", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
  "PAS Projects": "/pas",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
  "PAS Projects": "/pas",
};

export default function PasProjectsPage() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenantName, setTenantName] = useState("Current Tenant");
  const [tenantId, setTenantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Drawer / Sidebar form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    projectName: "",
    client: "",
    deployDate: "",
    duration: "",
    contractEnd: "",
    status: "Prod",
    environment: "Hetzner (Helsinki)",
    owner: "DevOps-",
    notes: ""
  });

  const fetchProjects = async (tId: string) => {
    try {
      const backendProjects = await listProjects("", tId);
      setProjects(backendProjects);
    } catch (err) {
      console.error("Failed to fetch projects from backend database:", err);
      setError("Unable to load projects from the server.");
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      let tId = "";
      try {
        const currentUser = await getCurrentUser();
        setUserRole(currentUser.role.toLowerCase() as UserRole);
        setTenantName(currentUser.tenantId ? `Tenant ${currentUser.tenantId.slice(0, 8)}` : "Current Tenant");
        tId = currentUser.tenantId || "";
        setTenantId(tId);
      } catch {
        setUserRole("admin");
        setTenantName("Default Tenant");
      }

      if (tId) {
        await fetchProjects(tId);
      } else {
        setError("No active tenant available.");
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.environment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.owner.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === "All" || p.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const openCreateDrawer = () => {
    setFormData({
      projectName: "",
      client: "",
      deployDate: "",
      duration: "",
      contractEnd: "",
      status: "Prod",
      environment: "Hetzner (Helsinki)",
      owner: "DevOps-",
      notes: ""
    });
    setEditingProject(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (project: Project) => {
    setFormData({
      projectName: project.projectName,
      client: project.client,
      deployDate: project.deployDate || "",
      duration: project.duration || "",
      contractEnd: project.contractEnd || "",
      status: project.status || "Prod",
      environment: project.environment || "Hetzner (Helsinki)",
      owner: project.owner || "DevOps-",
      notes: project.notes || ""
    });
    setEditingProject(project);
    setIsDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.client) {
      alert("Project Name and Client are required.");
      return;
    }

    if (!tenantId) {
      alert("No active tenant to save to.");
      return;
    }

    try {
      if (editingProject) {
        await updateProject("", tenantId, editingProject.id, {
          projectName: formData.projectName,
          client: formData.client,
          deployDate: formData.deployDate,
          duration: formData.duration,
          contractEnd: formData.contractEnd,
          status: formData.status,
          environment: formData.environment,
          owner: formData.owner,
          notes: formData.notes
        });
      } else {
        await createProject("", tenantId, {
          projectName: formData.projectName,
          client: formData.client,
          deployDate: formData.deployDate,
          duration: formData.duration,
          contractEnd: formData.contractEnd,
          status: formData.status,
          environment: formData.environment,
          owner: formData.owner,
          notes: formData.notes
        });
      }
      await fetchProjects(tenantId);
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to save project to backend database:", err);
      alert("Error saving project: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    if (!tenantId) {
      alert("No active tenant to delete from.");
      return;
    }

    try {
      await deleteProject("", tenantId, id);
      await fetchProjects(tenantId);
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to delete project from backend database:", err);
      alert("Error deleting project: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const hrefByItem = userRole === "admin" ? adminHrefByItem : tenantHrefByItem;

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading projects database...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)] relative overflow-hidden">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="PAS Projects"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={hrefByItem}
          tenant={{
            label: userRole === "admin" ? "Platform Scope" : "Active Tenant",
            name: tenantName,
            serversCount: projects.length,
            onboardingRunning: 0,
            badgeText: userRole === "admin" ? "Command view" : undefined,
          }}
        />

        <WorkspaceContainer
          title="PAS Projects"
          subtitle="Manage client project deployments, contract details, environments, and activity logs."
          actions={
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <input
                type="text"
                placeholder="Search projects, client, note..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 flex-1 rounded-xl border border-[#262e3d] bg-[#1a212e] px-4 text-sm text-[#8c9eba] outline-none placeholder:text-[#6f819c] focus:border-[#9ec4ff] sm:min-w-[260px]"
              />
              <button
                onClick={openCreateDrawer}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#c98a00] px-6 text-sm text-[#f2f5fa] hover:brightness-110 font-semibold shadow-[0_10px_24px_rgba(201,138,0,0.22)]"
              >
                Add Project
              </button>
            </div>
          }
        >
          {/* Status Tabs / Filters */}
          <div className="app-toolbar mt-6 flex flex-wrap items-center gap-3 rounded-2xl p-4">
            {["All", "Prod", "Dev", "Maintenance"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`h-10 rounded-xl px-5 text-sm transition font-medium ${
                  statusFilter === status
                    ? "bg-[#c98a00]/20 border border-[#c98a00] text-[#ffb96d]"
                    : "app-button-secondary border border-[#252f3d] bg-[#151b24]"
                }`}
              >
                {status}
              </button>
            ))}
            
            <div className="ml-auto text-xs text-[#8ea0bb]">
              Showing {filteredProjects.length} of {projects.length} Projects
            </div>
          </div>

          {/* Project List/Table */}
          <div className="app-panel mt-6 rounded-3xl overflow-hidden border border-[#252f3d]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#252f3d] text-xs font-semibold uppercase tracking-wider text-[#8ea0bb] bg-[#151b24]/60">
                    <th className="py-4 pl-6">Project Name</th>
                    <th className="py-4 px-4">Client</th>
                    <th className="py-4 px-4">Deploy Info</th>
                    <th className="py-4 px-4">Contract End</th>
                    <th className="py-4 px-4">Environment</th>
                    <th className="py-4 px-4">Owner</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 pr-6">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252f3d]/60 text-sm">
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      onClick={() => openEditDrawer(project)}
                      className="hover:bg-[#151d29]/40 cursor-pointer transition-colors duration-200 group"
                    >
                      <td className="py-4.5 pl-6 font-semibold text-[#f2f5fa] group-hover:text-[#ffb96d]">
                        {project.projectName}
                      </td>
                      <td className="py-4.5 px-4 text-[#8ea0bb]">{project.client}</td>
                      <td className="py-4.5 px-4 text-[#8ea0bb]">
                        {project.deployDate ? (
                          <div>
                            <div>{project.deployDate}</div>
                            {project.duration && (
                              <div className="text-xs text-[#687991] mt-0.5">{project.duration} months</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#687991]">-</span>
                        )}
                      </td>
                      <td className="py-4.5 px-4 text-[#8ea0bb]">
                        {project.contractEnd ? project.contractEnd : <span className="text-[#687991]">-</span>}
                      </td>
                      <td className="py-4.5 px-4 text-[#8ea0bb]">{project.environment}</td>
                      <td className="py-4.5 px-4 text-[#8ea0bb]">{project.owner}</td>
                      <td className="py-4.5 px-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            project.status === "Prod"
                              ? "bg-[#1b4332] border-[#2d6a4f] text-[#bff2c7]"
                              : project.status === "Dev"
                              ? "bg-[#1c2e4a] border-[#2a4d7c] text-[#a5caff]"
                              : "bg-[#2f2f2f] border-[#444444] text-[#d4deed]"
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="py-4.5 px-4 pr-6 max-w-xs truncate text-[#8ea0bb] font-normal">
                        {project.notes ? (
                          <span className="text-[#9ec4ff] underline decoration-dotted underline-offset-4 decoration-[#5cb7ff]/50">
                            {project.notes}
                          </span>
                        ) : (
                          <span className="text-[#687991] italic text-xs">Click to add notes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#8ea0bb] bg-[#11161d]/30">
                        No projects match the search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </WorkspaceContainer>
      </main>

      {/* Slide-over Form Sidebar Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Sliding drawer content */}
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-lg">
              <div className="h-full flex flex-col bg-[#11161d] border-l border-[#252f3d] shadow-[0_0_80px_rgba(2,6,14,0.65)] overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-6 border-b border-[#252f3d] bg-[#141b24] flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#f2f5fa] tracking-tight">
                      {editingProject ? "Project Settings" : "New Project Setup"}
                    </h2>
                    <p className="text-xs text-[#8ea0bb] mt-1">
                      {editingProject
                        ? "Configure project information and insert/update notes."
                        : "Deploy a new workspace track in the projects database."}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-[#8ea0bb] hover:text-[#f2f5fa] p-2 rounded-xl border border-[#252f3d] bg-[#151b24] hover:bg-[#1a2330] transition"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Row 1: Name and Client */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Project Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.projectName}
                        onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-4 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="e.g. reply-bot-server"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Client *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-4 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="e.g. Reply Bot"
                      />
                    </div>
                  </div>

                  {/* Row 2: Dates and Duration */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Deploy Date
                      </label>
                      <input
                        type="text"
                        value={formData.deployDate}
                        onChange={(e) => setFormData({ ...formData, deployDate: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Duration (Mo.)
                      </label>
                      <input
                        type="text"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="e.g. 3"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Contract End
                      </label>
                      <input
                        type="text"
                        value={formData.contractEnd}
                        onChange={(e) => setFormData({ ...formData, contractEnd: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>
                  </div>

                  {/* Row 3: Status, Environment, Owner */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] focus:border-[#c98a00] outline-none transition"
                      >
                        <option value="Prod">Prod</option>
                        <option value="Dev">Dev</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Environment
                      </label>
                      <input
                        type="text"
                        value={formData.environment}
                        onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="e.g. AWS"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                        Owner
                      </label>
                      <input
                        type="text"
                        value={formData.owner}
                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                        className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-3 py-2.5 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                        placeholder="e.g. DevOps-"
                      />
                    </div>
                  </div>

                  {/* Section: Notes */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-[#8ea0bb] uppercase tracking-wider mb-2">
                      Project Notes (IP, CI/CD, Comments)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-[#151b24] border border-[#252f3d] rounded-xl px-4 py-3 text-sm text-[#f2f5fa] placeholder-[#687991] focus:border-[#c98a00] outline-none transition"
                      rows={9}
                      placeholder="Insert notes for this project... e.g. IP: 89.167.83.54 | SSH port: 22"
                    />
                  </div>

                  {/* Save/Cancel Footer */}
                  <div className="pt-6 border-t border-[#252f3d] flex items-center justify-between gap-3">
                    {editingProject ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(editingProject.id)}
                        className="bg-[#4a2525] border border-[#7f3636] text-[#ffb7b7] rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#5a2c2c] transition"
                      >
                        Delete Project
                      </button>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(false)}
                        className="app-button-secondary rounded-xl px-5 py-2.5 text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="app-button-primary rounded-xl px-6 py-2.5 text-sm font-semibold hover:brightness-110 transition"
                      >
                        Save Project
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
