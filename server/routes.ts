import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertProjectSchema,
  insertDeductionSchema,
  insertCurrencySettingsSchema,
  insertTimeEntrySchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const project = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(project);
      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Failed to create project", details: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const updatedProject = await storage.updateProject(req.params.id, req.body);
      if (!updatedProject) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Deductions
  app.get("/api/deductions", async (_req, res) => {
    try {
      const deductions = await storage.getDeductions();
      res.json(deductions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deductions" });
    }
  });

  app.patch("/api/deductions", async (req, res) => {
    try {
      const updatedDeductions = await storage.updateDeductions(req.body);
      res.json(updatedDeductions);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deductions" });
    }
  });

  // Currency Settings
  app.get("/api/currency", async (_req, res) => {
    try {
      const settings = await storage.getCurrencySettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch currency settings" });
    }
  });

  app.patch("/api/currency", async (req, res) => {
    try {
      const updatedSettings = await storage.updateCurrencySettings(req.body);
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update currency settings" });
    }
  });

  // Time Entries
  app.get("/api/entries", async (_req, res) => {
    try {
      const entries = await storage.getTimeEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ error: "Failed to fetch time entries", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/entries", async (req, res) => {
    try {
      const entryData = insertTimeEntrySchema.parse(req.body);

      // Fetch current project to calculate
      const project = await storage.getProject(entryData.projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Fetch current deductions and currency
      const deductions = await storage.getDeductions();
      const currency = await storage.getCurrencySettings();

      if (!deductions || !currency) {
        res.status(500).json({ error: "Configuration not found" });
        return;
      }

      // Calculate earnings using the formula
      const hours = Number(entryData.hours) || 0;
      const rate = Number(project.rate) || 0;
      const grossUsd = hours * rate;

      const serviceFeePercent = Number(deductions.serviceFee) || 0;
      const serviceAmt = grossUsd * (serviceFeePercent / 100);

      const tdsPercent = Number(deductions.tds) || 0;
      const tdsAmt = grossUsd * (tdsPercent / 100);

      const gstPercent = Number(deductions.gst) || 0;
      const gstAmt = serviceAmt * (gstPercent / 100);

      const transferAmt = Number(deductions.transferFee) || 0;

      const netBeforeTransfer = grossUsd - serviceAmt - tdsAmt - gstAmt;
      const netUsd = Math.max(0, netBeforeTransfer - transferAmt);
      const totalDeductions = serviceAmt + tdsAmt + gstAmt + transferAmt;

      const exchangeRate = Number(currency.usdToInr) || 0;
      const netInr = netUsd * exchangeRate;

      const newEntry = await storage.createTimeEntry({
        ...entryData,
        grossUsd,
        deductionService: serviceAmt,
        deductionGst: gstAmt,
        deductionTds: tdsAmt,
        deductionTransfer: transferAmt,
        deductionTotal: totalDeductions,
        netUsd,
        netInr,
        exchangeRate,
      });

      res.status(201).json(newEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create time entry" });
      }
    }
  });

  app.delete("/api/entries/:id", async (req, res) => {
    try {
      await storage.deleteTimeEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
