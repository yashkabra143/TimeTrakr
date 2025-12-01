import type { Project, Deduction, CurrencySetting, TimeEntry, Withdrawal, InsertProject, InsertDeduction, InsertCurrencySetting, InsertTimeEntry, InsertWithdrawal } from "@shared/schema";

const API_URL = "/api";

// Projects
export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_URL}/projects`);
  if (!response.ok) throw new Error("Failed to fetch projects");
  return response.json();
}

export async function createProject(project: InsertProject): Promise<Project> {
  const response = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!response.ok) throw new Error("Failed to create project");
  return response.json();
}

export async function updateProject(id: string, data: Partial<InsertProject>): Promise<Project> {
  const response = await fetch(`${API_URL}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update project");
  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete project");
}

// Deductions
export async function getDeductions(): Promise<Deduction> {
  const response = await fetch(`${API_URL}/deductions`);
  if (!response.ok) throw new Error("Failed to fetch deductions");
  return response.json();
}

export async function updateDeductions(data: Partial<InsertDeduction>): Promise<Deduction> {
  const response = await fetch(`${API_URL}/deductions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update deductions");
  return response.json();
}

// Currency Settings
export async function getCurrencySettings(): Promise<CurrencySetting> {
  const response = await fetch(`${API_URL}/currency`);
  if (!response.ok) throw new Error("Failed to fetch currency settings");
  return response.json();
}

export async function updateCurrencySettings(data: Partial<InsertCurrencySetting>): Promise<CurrencySetting> {
  const response = await fetch(`${API_URL}/currency`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update currency settings");
  return response.json();
}

// Time Entries
export async function getTimeEntries(): Promise<TimeEntry[]> {
  const response = await fetch(`${API_URL}/entries`);
  if (!response.ok) throw new Error("Failed to fetch time entries");
  return response.json();
}

export async function createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
  const response = await fetch(`${API_URL}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error("Failed to create time entry");
  return response.json();
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/entries/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete time entry");
}

// Withdrawals
export async function getWithdrawals(): Promise<Withdrawal[]> {
  const response = await fetch(`${API_URL}/withdrawals`);
  if (!response.ok) throw new Error("Failed to fetch withdrawals");
  return response.json();
}

export async function createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
  const response = await fetch(`${API_URL}/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withdrawal),
  });
  if (!response.ok) throw new Error("Failed to create withdrawal");
  return response.json();
}

export async function updateWithdrawalStatus(id: string, status: string): Promise<Withdrawal> {
  const response = await fetch(`${API_URL}/withdrawals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentStatus: status }),
  });
  if (!response.ok) throw new Error("Failed to update withdrawal status");
  return response.json();
}

export async function deleteWithdrawal(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/withdrawals/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete withdrawal");
}
