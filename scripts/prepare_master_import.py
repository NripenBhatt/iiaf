import json,sys,hashlib
from pathlib import Path
from openpyxl import load_workbook
source=Path(sys.argv[1]);report=json.loads(Path('src/data/master-inspection.json').read_text());w=load_workbook(source,read_only=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==report['sha256']
issues={(i['sheet'],i['row']):i for i in report['issues']};specs={s['name']:s for s in report['worksheets']};allrows=[]
order=['AGENCY_MASTER','EVIDENCE_MASTER','AGENCY_REQUIREMENT_MASTER','AGENCY_FIELD_MASTER','EVIDENCE_REQUIREMENT_MAPPING']+[s.title for s in w if s.title not in ['AGENCY_MASTER','EVIDENCE_MASTER','AGENCY_REQUIREMENT_MASTER','AGENCY_FIELD_MASTER','EVIDENCE_REQUIREMENT_MAPPING']]
for n in order:
 values=w[n].values;h=list(next(values));rows=list(enumerate(values,2))
 if n=='README_ARCHITECTURE':rows=[(1,tuple(h))]+rows
 for number,row in rows:
  if not any(v is not None for v in row):continue
  fields=dict(zip(h,row));s=specs[n];issue=issues.get((n,number));disp='excluded' if not s['required'] else 'held' if issue else 'ready'
  allrows.append({'sheet':n,'row':number,'identifier':fields.get(s['identifier']), 'fields':fields,'disposition':disp,'reason':issue['kind']+': '+issue['reason'] if issue else 'Supporting/projection/future-phase sheet excluded' if disp=='excluded' else 'Validated original source'})
selected=set()
def add(n,r):
 k=(n,r['row'])
 if k in selected:return
 selected.add(k)
 for ref in specs[n]['references']:
  target,col=ref['target'].split('.');value=r['fields'].get(ref['field'])
  if value is not None:
   match=next((a for a in allrows if a['sheet']==target and a['fields'].get(col)==value),None)
   if match:add(target,match)
for n in order[:5]:
 for r in [r for r in allrows if r['sheet']==n and r['disposition']=='ready'][:2]:add(n,r)
for r in [r for r in allrows if r['sheet']=='EVIDENCE_REQUIREMENT_MAPPING' and 'Repeated' in r['reason']][:2]:add(r['sheet'],r)
for r in allrows:
 if r['sheet']=='AGENCY_REQUIREMENT_MASTER' and r['row']==95:add(r['sheet'],r)
 if r['sheet']=='AGENCY_FIELD_MASTER' and r['fields'].get('Field_Level_Status')=='EXACT_ATOMIC_OFFICIAL_FIELD':add(r['sheet'],r);break
sample=[r for r in allrows if (r['sheet'],r['row']) in selected]
Path('src/data/master-import-payload.json').write_text(json.dumps({'source':report['source'],'sha256':report['sha256'],'rows':allrows,'sample':sample},ensure_ascii=False,default=str,separators=(',',':')))
print('full',len(allrows),'sample',len(sample),'held',sum(r['disposition']=='held' for r in sample),'size',Path('src/data/master-import-payload.json').stat().st_size)
