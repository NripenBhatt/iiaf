import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { getNavGroups } from "@/components/iiaf/nav";
import { visibleOutputs } from "@/components/iiaf/output-data";
import { getVisualizations, type AnalyticalPage } from "@/components/iiaf/analytics-data";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it("preserves all eleven original destinations and adds workspace help", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/", "/institutional", "/meetings", "/evidence", "/relationships", "/conversation", "/reports", "/review", "/users", "/audit", "/settings", "/help"]) {
      expect(router.matchRoutes(path).at(-1)?.routeId).toBe("/_authenticated" + path + (path === "/conversation" ? "/" : ""));
    }
  });
  it("does not offer company-only intelligence or chat to the university", () => {
    const destinations = getNavGroups("university").flatMap(g => g.items.map(i => i.url));
    expect(destinations).not.toContain("/conversation");
    expect(destinations).not.toContain("/relationships");
    expect(destinations).not.toContain("/audit");
    expect(destinations).not.toContain("/review");
    expect(destinations).toEqual(expect.arrayContaining(["/", "/institutional", "/meetings", "/evidence", "/reports", "/users", "/help"]));
  });
  it("keeps university samples institution-scoped and excludes internal analysis", () => {
    const records = visibleOutputs(true, "demo-uni");
    expect(records.length).toBe(7);
    expect(records.every(r => r.institution === "demo-uni" && r.universityVisible)).toBe(true);
    expect(records.some(r => r.category === "Internal analysis")).toBe(false);
    expect(new Set(records.map(r => r.state))).toEqual(new Set(["Draft", "In review", "Approved", "Released", "Published"]));
  });
  it("provides at least three analytical visualizations per major data page", () => {
    const pages: AnalyticalPage[] = ["overview", "institutional", "meetings", "evidence", "relationships", "reports", "review", "audit", "help"];
    for (const page of pages) for (const university of [false, true]) {
      expect(getVisualizations(page, university).length).toBeGreaterThanOrEqual(3);
    }
  });
});
