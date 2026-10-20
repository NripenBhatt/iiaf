import { describe, it, expect } from "vitest";
import inspection from "@/data/master-inspection.json";
describe("Actual Phase 2 workbook inspection", () => {
 it("accounts for every proposed, held and excluded row", () => {
  expect(inspection.summary.sheets).toBe(23);
  expect(inspection.summary.sourceRows).toBe(32170);
  expect(inspection.summary.proposedRows + inspection.summary.heldRows + inspection.summary.excludedRows).toBe(32170);
 });
 it("does not invent the missing NIRF innovation agency reference", () => {
  expect(inspection.summary.missingRequired).toBe(1);
  expect(inspection.issues).toContainEqual(expect.objectContaining({sheet:"AGENCY_REQUIREMENT_MASTER",row:95,identifier:"NIRF-INNOV-REQ-001",field:"Agency_ID",kind:"Required value missing"}));
 });
 it("holds repeated relationship candidates instead of approving or dropping them", () => {
  expect(inspection.summary.repeatedMappingExcess).toBe(30);
  expect(inspection.summary.repeatedMappingRows).toBeGreaterThan(30);
  expect(inspection.worksheets.find(s=>s.name==="EVIDENCE_REQUIREMENT_MAPPING")?.held).toBeGreaterThanOrEqual(182);
 });
 it("preserves status values and excludes future extraction/submission data", () => {
  expect(inspection.worksheets.find(s=>s.name==="EVIDENCE_MASTER")?.statuses.Collection_Status).toEqual({Missing:1881});
  for(const n of ["EXTRACTION_SCHEMA","PARAMETER_DOCUMENT_BUNDLE","AGENCY_SUBMISSION_MASTER"])expect(inspection.worksheets.find(s=>s.name===n)?.proposed).toBe(0);
 });
});