import {it,expect} from 'vitest';
import {PURPOSE_RULES} from '@/lib/output-readiness';
import {demoContext} from '@/lib/output-demo-fixtures';
import {generateCatalogue} from '@/lib/catalogue-handlers';
import {generatedOutputSchema} from '@/lib/output-contract';
for(const id of Object.keys(PURPOSE_RULES))it(`${id} representative category fixture preserves traceability and draft restrictions`,()=>{const c=demoContext(id);const r=generateCatalogue(c,[id]);if(id==='OUT-022'){expect(r.outputs).toHaveLength(0);expect(r.readiness[id]?.missing.join(' ')).toContain('original evidence bytes');return;}expect(r.outputs.length).toBeGreaterThan(0);for(const o of r.outputs){expect(generatedOutputSchema.safeParse(o).success).toBe(true);expect(o.contract.release).toBe('not_authorized');expect(o.manifest?.classification).toBe('DEMO');expect(o.manifest?.verifiedCoverage).toBe(false);}});
