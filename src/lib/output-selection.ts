import { OUTPUT_REFERENCE, outputBinding } from "./output-reference";
import type { GeneratedOutput } from "./output-contract";

export function selectedDrafts(outputs: GeneratedOutput[], requested: string[]) {
  return outputs.filter(o => !o.catalogue?.catalogueId || !requested.length || requested.includes(o.catalogue.catalogueId));
}

/** Opaque selection key input, not a canonical JS/SQL payload signature or G3 migration. */
export function selectionKeySuffix(requested: string[]) {
  return requested.length ? `\nselection:${JSON.stringify([...new Set(requested)].sort())}` : "";
}

export function selectionOutcomes(requested: string[], outputs: GeneratedOutput[]) {
  return requested.map(id => {
    const entry = OUTPUT_REFERENCE.outputs.find(o => o.Output_ID === id);
    const saved = outputs.filter(o => o.catalogue?.catalogueId === id);
    if (saved.length) return { catalogueId: id, status: "generated_saved" as const, reason: `${saved.length} source-linked draft(s) saved; human review required.` };
    if (["OUT-005", "OUT-006", "OUT-007"].includes(id)) return { catalogueId: id, status: "needs_source_information" as const, reason: "No explicit source headers support this meeting contract. Missing decisions or proceedings are not inferred." };
    const binding = outputBinding(id === "OUT-008" ? "press_release" : id === "OUT-009" ? "linkedin" : id === "OUT-010" ? "reel_script" : id);
    return { catalogueId: id, status: "not_supported" as const, reason: !entry ? "Unknown catalogue ID." : ["OUT-001", "OUT-008", "OUT-009", "OUT-011", "OUT-015", "OUT-023"].includes(id) ? "Saving this authored type requires separately approved source/payload validation in the protected output contract; local previews are not saved outputs." : id === "OUT-010" ? binding.reason : "Catalogue definition exists, but no implemented and validated output-specific generation/persistence contract exists for it." };
  });
}