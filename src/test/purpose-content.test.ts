import { describe, it, expect } from 'vitest';
import { demoContext } from '@/lib/output-demo-fixtures';
import { generateCatalogue } from '@/lib/catalogue-handlers';
import { sourceRates, derivedRate, labelledRecords } from '@/lib/purpose-content';
import { assessOutput } from '@/lib/output-quality';

describe('targeted source-backed calculations and editorial records', () => {
  it('20 placed out of 40 eligible yields 50.00% with cohort provenance', () => {
    const c = demoContext('OUT-004');
    expect(sourceRates('OUT-004', c.lines, '2026')[0]).toMatchObject({ numerator:20, denominator:40, value:'50.00%' });
  });
  it('zero denominator withholds a rate', () => expect(derivedRate('CTR','20','0','DEMO')).toBeNull());
  it('a numerator above denominator is not silently clamped', () => expect(derivedRate('Conversion','30','20','DEMO')).toBeNull());
  it('five conversions from twenty clicks yields 25.00%, not reach-based conversion', () => {
    const c = demoContext('OUT-030');
    expect(sourceRates('OUT-030',c.lines,'2026').find(r=>r.label.startsWith('Conversion'))?.value).toBe('25.00%');
    expect(sourceRates('OUT-030',c.lines,'2026').find(r=>r.label.startsWith('Click-through'))).toBeUndefined();
  });
  it('mismatched reporting window withholds every calculation', () => {
    const c=demoContext('OUT-030');expect(sourceRates('OUT-030',c.lines,'2025')).toEqual([]);
  });
  it('conflicting denominator is retained and blocks calculation', () => {
    const c=demoContext('OUT-030');c.lines.push({...c.lines[0],seq:99,content:'Clicks: 21',locator_key:'demo:extra',locator:{},method_version:'demo-native-1'});
    expect(labelledRecords(c.lines,'Channel')[0]?.['clicks']).toContain('[CONFLICT]');
    expect(sourceRates('OUT-030',c.lines,'2026')).toEqual([]);
  });
  it('reproducible derived rates pass bounded factual checks; tampered rates fail', () => {
    const c=demoContext('OUT-030');const o=generateCatalogue(c,['OUT-030']).outputs[0];if(!o)throw new Error('Missing analytics draft');
    expect(assessOutput('OUT-030',o,c).checks.find(q=>q.name==='Unsupported factual claims')?.passed).toBe(true);
    expect(assessOutput('OUT-030',{...o,body:o.body.replace('25.00%','99.00%')},c).status).toBe('BLOCKED');
  });
  it('multi-item composition retains per-item reader value and date association', () => {
    const c=demoContext('OUT-014');
    // Explicit records, never a zipped set of independent lists.
    c.lines=['News Item: DEMO curriculum update','Editorial Category: Academic','Reader Value: DEMO course selection','News Date: 2026-10-20','News Item: DEMO workshop','Editorial Category: Research','Reader Value: DEMO methods learning','News Date: 2026-10-21','Audience: DEMO students and staff'].map((content,seq)=>({content,seq,locator_key:`demo:news:${seq}`,locator:{},method_version:'demo-native-1'}));
    c.segmentIds=c.lines.map((_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
    const o=generateCatalogue(c,['OUT-014']).outputs[0];if(!o)throw new Error('Missing composed newsletter');
    const records=labelledRecords(c.lines,'News Item');expect(records).toHaveLength(2);expect(records[1]?.['reader value']).toBe('DEMO methods learning');
    expect(o.title).not.toBe('Single-item Bulletin');expect(o.draft?.citations.every(q=>c.segmentIds.includes(q.segmentId))).toBe(true);
  });
});