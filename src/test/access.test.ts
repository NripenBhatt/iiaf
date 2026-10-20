import { describe,it,expect } from "vitest";
import { mayOpen,mayManage,type AppRole } from "@/lib/access";
describe("Phase 1 role rules",()=>{
 it("denies unassigned accounts",()=>expect(mayOpen("/","university",[])).toBe(false));
 it("denies every university role company-only routes",()=>{for(const r of ["university_administrator","registrar","iqac_manager","department_head_dean","faculty_staff_uploader","read_only_decision_maker"] as AppRole[])for(const p of ["/relationships","/conversation","/audit","/review"])expect(mayOpen(p,"university",[r])).toBe(false);});
 it("allows operators intelligence but not audit",()=>{expect(mayOpen("/relationships","internal",["authorized_operator"])).toBe(true);expect(mayOpen("/audit","internal",["authorized_operator"])).toBe(false);});
 it("allows reviewers review and audit but not chat",()=>{expect(mayOpen("/review","internal",["internal_reviewer"])).toBe(true);expect(mayOpen("/audit","internal",["internal_reviewer"])).toBe(true);expect(mayOpen("/conversation","internal",["internal_reviewer"])).toBe(false);});
 it("limits administration to two administrator roles",()=>{expect(mayManage(["super_admin"])).toBe(true);expect(mayManage(["university_administrator"])).toBe(true);expect(mayManage(["authorized_operator"])).toBe(false);expect(mayManage(["read_only_decision_maker"])).toBe(false);});
 it("denies unknown destinations",()=>expect(mayOpen("/unregistered","internal",["super_admin"])).toBe(false));
 it("restricts master inspection to assigned company roles",()=>{
  for(const r of ["super_admin","authorized_operator","internal_reviewer"] as AppRole[])expect(mayOpen("/master-import","internal",[r])).toBe(true);
  for(const r of Object.keys({super_admin:1,authorized_operator:1,internal_reviewer:1,university_administrator:1,registrar:1,iqac_manager:1,department_head_dean:1,faculty_staff_uploader:1,read_only_decision_maker:1}) as AppRole[])expect(mayOpen("/master-import","university",[r])).toBe(false);
 });
});