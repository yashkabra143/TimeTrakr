import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { InsertProject, InsertDeduction, InsertCurrencySetting, InsertTimeEntry } from "@shared/schema";

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: InsertProject) => api.createProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertProject> }) => api.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

// Deductions
export function useDeductions() {
  return useQuery({
    queryKey: ["deductions"],
    queryFn: api.getDeductions,
  });
}

export function useUpdateDeductions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertDeduction>) => api.updateDeductions(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deductions"] });
    },
  });
}

// Currency Settings
export function useCurrencySettings() {
  return useQuery({
    queryKey: ["currency"],
    queryFn: api.getCurrencySettings,
  });
}

export function useUpdateCurrencySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertCurrencySetting>) => api.updateCurrencySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency"] });
    },
  });
}

// Time Entries
export function useTimeEntries() {
  return useQuery({
    queryKey: ["entries"],
    queryFn: api.getTimeEntries,
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: InsertTimeEntry) => api.createTimeEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTimeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
