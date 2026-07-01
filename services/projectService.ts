import { apiDelete, apiGet, apiPost, apiPut } from "@/services/apiClient";

export interface ProjectDto {
  id: string;
  tenantId: string;
  projectName: string;
  client: string;
  deployDate: string;
  duration: string;
  contractEnd: string;
  status: string;
  environment: string;
  owner: string;
  notes: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  projectName: string;
  client: string;
  deployDate?: string;
  duration?: string;
  contractEnd?: string;
  status: string;
  environment?: string;
  owner?: string;
  notes?: string;
}

export interface UpdateProjectInput {
  tenantId?: string;
  projectName: string;
  client: string;
  deployDate?: string;
  duration?: string;
  contractEnd?: string;
  status: string;
  environment?: string;
  owner?: string;
  notes?: string;
}

function buildAuthHeaders(accessToken?: string): Record<string, string> {
  if (!accessToken) return {};
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function listProjects(
  accessToken: string,
  tenantId: string,
): Promise<ProjectDto[]> {
  return apiGet<ProjectDto[]>(`/api/v1/tenants/${tenantId}/projects`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function createProject(
  accessToken: string,
  tenantId: string,
  payload: CreateProjectInput,
): Promise<ProjectDto> {
  return apiPost<ProjectDto, CreateProjectInput>(
    `/api/v1/tenants/${tenantId}/projects`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function updateProject(
  accessToken: string,
  tenantId: string,
  projectId: string,
  payload: UpdateProjectInput,
): Promise<ProjectDto> {
  return apiPut<ProjectDto, UpdateProjectInput>(
    `/api/v1/tenants/${tenantId}/projects/${projectId}`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function deleteProject(
  accessToken: string,
  tenantId: string,
  projectId: string,
): Promise<void> {
  await apiDelete<void>(
    `/api/v1/tenants/${tenantId}/projects/${projectId}`,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}
