from pathlib import Path
import json,csv,hashlib,io,zipfile,openpyxl
root=Path('/tmp/user-uploads'); project=Path('/dev-server'); rows=[]; inventory=[]
cols=['discrepancy_id','scope','source_artefact','source_sha256','source_sheet','source_row','source_field_id','source_category','source_type','source_field_name','runtime_file','runtime_field_id','match_status','transformation_or_validation_rule','evidence','proposed_resolution']
def digest(b): return hashlib.sha256(b).hexdigest()
def add(**r): rows.append({k:r.get(k,'') for k in cols})
for name,prefix in [('IIAF_Institutional_Upload_Developer_Spec_v2.xlsx','INST'),('IIAF_Meeting_Upload_Developer_Spec_v2.xlsx','MEET')]:
 b=(root/name).read_bytes(); w=openpyxl.load_workbook(io.BytesIO(b),read_only=True,data_only=True); s=w['DEVELOPER_FIELD_SPEC']; it=s.iter_rows(values_only=True); headers=next(it); n=0
 for rn,row in enumerate(it,2):
  d=dict(zip(headers,row)); fid=d['Field_Spec_ID']; n+=1
  add(discrepancy_id=f'G6-BIND-{fid}',scope='developer-field binding',source_artefact=name,source_sha256=digest(b),source_sheet=s.title,source_row=rn,source_field_id=fid,source_category=d['Category_Code'],source_type=d['Document_Type_Name'],source_field_name=d['Field_Name'],runtime_file='src/data/fact-fields.json; src/lib/extraction.ts',match_status='unresolved',transformation_or_validation_rule=' | '.join(str(d[x] or '') for x in ['Extraction_Rule','Normalization_Rule','Validation_Rule','Human_Review_Trigger','Agency_Mapping_Status']),evidence=f'{name}!{s.title} row {rn}; no explicit stable Field_Spec_ID binding in runtime',proposed_resolution='Review an explicit versioned binding or deliberate unsupported disposition; do not infer from similar labels.')
 inventory.append({'artefact':name,'sha256':digest(b),'field_rows':n})
b=(root/'IIAF_Relationship_Engine_Rule_Model_v2_1.xlsx').read_bytes(); w=openpyxl.load_workbook(io.BytesIO(b),read_only=True,data_only=True)
f=json.load(open(project/'src/data/fact-fields.json'))['fields']
for i,d in enumerate(f,1):
 sn=d['spec']; s=w[sn]; vals=list(s.iter_rows(values_only=True)); head=vals[0]; match=[]
 if 'Field_Name' in head:
  ix=head.index('Field_Name'); match=[(rn,dict(zip(head,v))) for rn,v in enumerate(vals[1:],2) if v[ix]==d['field']]
 elif d['field'] in head: match=[(1,{'Validation_or_Notes':'Stable header only; per-record values are not approval.'})]
 exact=len(match)==1; rn,v=match[0] if exact else ('',{})
 add(discrepancy_id=f'G6-META-{d["field"]}',scope='metadata identifier only',source_artefact='IIAF_Relationship_Engine_Rule_Model_v2_1.xlsx',source_sha256=digest(b),source_sheet=sn,source_row=rn,source_field_id=d['field'] if exact else '',source_category=d['applies'],source_field_name=d['label'],runtime_file='src/data/fact-fields.json',runtime_field_id=d['field'],match_status='exact' if exact else 'unresolved',transformation_or_validation_rule=v.get('Validation_or_Notes',''),evidence=f'{sn} row {rn}; identifier equality only, not execution or developer-field parity',proposed_resolution='Retain reference identity; validate behavior separately; do not assign developer field IDs implicitly.')
# Verbatim catalogue and contract requirements; these are reference parity, not generation.
ref=json.load(open(project/'src/data/output-reference-catalogue.json'))
with zipfile.ZipFile(root/'IIAF_Lovable_Final_Handoff_Bundle_v2.zip') as z:
 name=next(n for n in z.namelist() if n.endswith('IIAF_Qualification_and_Relationship_Engine_Blueprint_v1_FIXED.xlsx')); bb=z.read(name); bw=openpyxl.load_workbook(io.BytesIO(bb),read_only=True,data_only=True)
 for sn,idcol,runtimekey in [('Output_Contracts','Output_ID','contracts')]:
  vals=list(bw[sn].iter_rows(values_only=True)); head=vals[0]; runtime=ref[runtimekey]
  for rn,row in enumerate(vals[1:],2):
   d=dict(zip(head,row)); fid=d[idcol]; candidates=[r for r in runtime if r.get(idcol)==fid]; rr=candidates[0] if len(candidates)==1 else {}
   for field,value in d.items():
    same=rr.get(field)==value
    add(discrepancy_id=f'G6-REF-{fid}-{field}',scope='contract reference only',source_artefact=f'IIAF_Lovable_Final_Handoff_Bundle_v2.zip::{name}',source_sha256=digest(bb),source_sheet=sn,source_row=rn,source_field_id=f'{fid}.{field}',source_type=d.get('Output type',''),source_field_name=field,runtime_file='src/data/output-reference-catalogue.json',runtime_field_id=f'contracts[{fid}].{field}',match_status='exact' if same else 'conflicting' if field in rr else 'missing',transformation_or_validation_rule=str(value or ''),evidence='Literal source-cell versus JSON value comparison; not generated-deliverable acceptance',proposed_resolution='Keep contract generation/format acceptance separate from reference equality.')
 inventory.append({'artefact':name,'sha256':digest(bb),'sheets':bw.sheetnames})
 for sn,idcol in [('Qualification_Rules','Rule_ID')]:
  vals=list(bw[sn].iter_rows(values_only=True)); head=vals[0]
  for rn,row in enumerate(vals[1:],2):
   d=dict(zip(head,row)); fid=d[idcol]
   for field,value in d.items():
    add(discrepancy_id=f'G6-QUAL-{fid}-{field}',scope='qualification-rule behavior',source_artefact=f'IIAF_Lovable_Final_Handoff_Bundle_v2.zip::{name}',source_sha256=digest(bb),source_sheet=sn,source_row=rn,source_field_id=f'{fid}.{field}',source_type=d.get('Qualification class',''),source_field_name=field,runtime_file='src/lib/output-contract.ts:qualify',match_status='unresolved',transformation_or_validation_rule=str(value or ''),evidence='Runtime uses source/table Candidate qualification; no explicit Q-rule binding',proposed_resolution='Approve explicit rule binding and behavior tests before claiming parity; not implemented here.')
# Catalogue source rows: all source columns compared exactly.
s=w['OUTPUT_CATALOGUE']; vals=list(s.iter_rows(values_only=True)); head=vals[0]
for rn,row in enumerate(vals[1:],2):
 d=dict(zip(head,row)); fid=d['Output_ID']; rr=next((r for r in ref['outputs'] if r['Output_ID']==fid),{})
 for field,value in d.items():
  add(discrepancy_id=f'G6-REF-{fid}-{field}',scope='output catalogue reference only',source_artefact='IIAF_Relationship_Engine_Rule_Model_v2_1.xlsx',source_sha256=digest(b),source_sheet=s.title,source_row=rn,source_field_id=f'{fid}.{field}',source_type=d.get('Output_Name',''),source_field_name=field,runtime_file='src/data/output-reference-catalogue.json',runtime_field_id=f'outputs[{fid}].{field}',match_status='exact' if rr.get(field)==value else 'conflicting' if field in rr else 'missing',transformation_or_validation_rule=str(value or ''),evidence='Literal cell equality only; catalogue references confer no approval or access',proposed_resolution='Validate actual output contract separately; preserve source wording.')
# Exact v4 paragraph provenance for mandatory contract attributes.
from xml.etree import ElementTree as ET
v4=root/'IIAF_Detailed_Concept_Note_v4.docx'; vb=v4.read_bytes()
with zipfile.ZipFile(v4) as z: tree=ET.fromstring(z.read('word/document.xml'))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paras=[''.join(p.itertext()) for p in []] # paragraph text is restricted to w:t below
paras=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in tree.findall('.//w:p',ns)]
relevant=[(i,p) for i,p in enumerate(paras,1) if p.startswith('Each output stores type, title, audience')]
print('V4 CONTRACT PARAGRAPHS',relevant)
fields=[('audience','qualification.audience','partial'),('channel','qualification.channel','partial'),('tenant','document_outputs.organization_id','partial'),('facts','qualification.factualSupport','partial'),('IDs','manifest.documentId/jobId; source references','partial'),('qualification','qualification','partial'),('privacy','qualification.sensitivity/consent','partial'),('template','','unresolved'),('version','manifest.contractVersion','partial'),('MIME','','unresolved'),('dimensions','','unresolved'),('DEMO','manifest.classification','partial'),('review','manifest.approval; qualification.verification','partial'),('approver','','unresolved'),('release','','unresolved'),('errors','qualification.blockers','partial')]
for field,target,status in fields:
 add(discrepancy_id=f'G6-V4-{field}',scope='v4 mandatory output behavior',source_artefact=v4.name,source_sha256=digest(vb),source_sheet='word/document.xml',source_row=';'.join(str(i) for i,p in relevant),source_field_id=f'Output contract/{field}',source_field_name=field,runtime_file='src/lib/output-contract.ts; drizzle/migrations/0009_document_outputs.sql',runtime_field_id=target,match_status=status,transformation_or_validation_rule='Source requirements do not establish a completed release/approval workflow.',evidence='; '.join(p for i,p in relevant),proposed_resolution='Validate authoritative requirement scope and execution independently; no new workflow authorized here.')
out=Path('/mnt/documents/IIAF_Controlled_Closure_Field_Crosswalk_2026_10_22.csv')
with out.open('w',newline='') as file:
 writer=csv.DictWriter(file,fieldnames=cols);writer.writeheader();writer.writerows(rows)
from collections import Counter
summary={'rows':len(rows),'statuses':dict(Counter(r['match_status'] for r in rows)),'scopes':{scope:dict(Counter(r['match_status'] for r in rows if r['scope']==scope)) for scope in sorted({r['scope'] for r in rows})},'inventory':inventory,'csv_sha256':digest(out.read_bytes())}
Path('/tmp/controlled-closure/summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
