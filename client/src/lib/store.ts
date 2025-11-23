import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  rate: number; // USD per hour
  color: string;
}

export interface Deductions {
  upworkFee: number; // Percentage
  tds: number; // Percentage
  gst: number; // Percentage
  serviceFee: number; // Percentage
}

export interface CurrencySettings {
  usdToInr: number;
  lastUpdated: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  hours: number;
  date: string; // ISO string
  description?: string;
  
  // Snapshotted values at time of entry
  grossUsd: number;
  deductions: {
    upwork: number;
    service: number;
    gst: number;
    tds: number;
    total: number;
  };
  netUsd: number;
  netInr: number;
  exchangeRate: number;
}

interface AppState {
  projects: Project[];
  deductions: Deductions;
  currency: CurrencySettings;
  entries: TimeEntry[];
  
  // Actions
  addEntry: (entry: Omit<TimeEntry, 'id' | 'grossUsd' | 'deductions' | 'netUsd' | 'netInr' | 'exchangeRate'>) => void;
  deleteEntry: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  updateDeductions: (data: Partial<Deductions>) => void;
  updateCurrency: (rate: number) => void;
  importData: (data: Partial<AppState>) => void;
  resetData: () => void;
}

const DEFAULT_PROJECTS: Project[] = [
  { id: 'p1', name: 'Project Alpha', rate: 25, color: 'hsl(250, 80%, 60%)' },
  { id: 'p2', name: 'Project Beta', rate: 35, color: 'hsl(173, 58%, 39%)' },
  { id: 'p3', name: 'Project Gamma', rate: 45, color: 'hsl(197, 37%, 24%)' },
];

const DEFAULT_DEDUCTIONS: Deductions = {
  upworkFee: 10,
  tds: 1,
  gst: 0,
  serviceFee: 0,
};

const DEFAULT_CURRENCY: CurrencySettings = {
  usdToInr: 84.0, // Default static rate
  lastUpdated: new Date().toISOString(),
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: DEFAULT_PROJECTS,
      deductions: DEFAULT_DEDUCTIONS,
      currency: DEFAULT_CURRENCY,
      entries: [],

      addEntry: (entryData) => {
        const state = get();
        const project = state.projects.find(p => p.id === entryData.projectId);
        
        if (!project) {
          console.error('Project not found');
          return;
        }

        // Calculations
        const grossUsd = entryData.hours * project.rate;
        
        // Deductions (Percent of Gross)
        const upworkAmt = grossUsd * (state.deductions.upworkFee / 100);
        const serviceAmt = grossUsd * (state.deductions.serviceFee / 100);
        
        // Net USD before Tax
        // Taxes (Usually on Net or Gross depending on local laws, assuming on Gross for simplicity or as requested "Deductions")
        
        const gstAmt = grossUsd * (state.deductions.gst / 100);
        const tdsAmt = grossUsd * (state.deductions.tds / 100);
        
        const totalDeductions = upworkAmt + serviceAmt + gstAmt + tdsAmt;
        const netUsd = grossUsd - totalDeductions;
        const netInr = netUsd * state.currency.usdToInr;

        const newEntry: TimeEntry = {
          id: crypto.randomUUID(),
          ...entryData,
          grossUsd,
          deductions: {
            upwork: upworkAmt,
            service: serviceAmt,
            gst: gstAmt,
            tds: tdsAmt,
            total: totalDeductions
          },
          netUsd,
          netInr,
          exchangeRate: state.currency.usdToInr
        };

        set({ entries: [newEntry, ...state.entries] });
      },

      deleteEntry: (id) => {
        set(state => ({ entries: state.entries.filter(e => e.id !== id) }));
      },

      updateProject: (id, data) => {
        set(state => ({
          projects: state.projects.map(p => p.id === id ? { ...p, ...data } : p)
        }));
      },

      updateDeductions: (data) => {
        set(state => ({
          deductions: { ...state.deductions, ...data }
        }));
      },

      updateCurrency: (rate) => {
        set({
          currency: {
            usdToInr: rate,
            lastUpdated: new Date().toISOString()
          }
        });
      },

      importData: (data) => {
        set(state => ({
          ...state,
          ...data
        }));
      },

      resetData: () => {
        set({
          projects: DEFAULT_PROJECTS,
          deductions: DEFAULT_DEDUCTIONS,
          currency: DEFAULT_CURRENCY,
          entries: []
        });
      }
    }),
    {
      name: 'time-flow-storage',
    }
  )
);
