"""Read-only Phase 2 inspection. Never writes to the workbook or database."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from openpyxl import load_workbook

source = Path(sys.argv[1])
output = Path(sys.argv[2])
workbook = load_workbook(source, data_only=False)
specs = {
    'AGENCY_MASTER': ('Agency_ID', ['Agency_ID', 'Agency_Name'], {}),
    'EVIDENCE_MASTER': ('Evidence_ID', ['Evidence_ID', 'Evidence_Record', 'Collection_Status'], {}),
    'AGENCY_REQUIREMENT_MASTER': ('Requirement_ID', ['Requirement_ID', 'Agency_ID', 'Requirement_Status'], {'Agency_ID': ('AGENCY_MASTER', 'Agency_ID'), 'Parent_Requirement_ID': ('AGENCY_REQUIREMENT_MASTER', 'Requirement_ID')}),
    'AGENCY_FIELD_MASTER': ('Agency_Field_ID', ['Agency_Field_ID', 'Agency_ID', 'Requirement_ID', 'Field_Level_Status'], {'Agency_ID': ('AGENCY_MASTER', 'Agency_ID'), 'Requirement_ID': ('AGENCY_REQUIREMENT_MASTER', 'Requirement_ID')}),
    'EVIDENCE_REQUIREMENT_MAPPING': ('Mapping_ID', ['Mapping_ID', 'Evidence_ID', 'Agency_ID', 'Requirement_ID', 'Agency_Field_ID', 'Mapping_Status'], {'Evidence_ID': ('EVIDENCE_MASTER', 'Evidence_ID'), 'Agency_ID': ('AGENCY_MASTER', 'Agency_ID'), 'Requirement_ID': ('AGENCY_REQUIREMENT_MASTER', 'Requirement_ID'), 'Agency_Field_ID': ('AGENCY_FIELD_MASTER', 'Agency_Field_ID')}),
}
purposes = {
    'README_ARCHITECTURE': 'Architecture and control notes; title/value layout, not a record table.',
    'HOW_MAPPING_WORKS': 'Explanatory flow and sheet responsibilities.',
    'AGENCY_MASTER': 'Agency-wide reference catalog; not university-owned.',
    'EVIDENCE_MASTER': 'Evidence requirement templates, not uploaded university evidence.',
    'AGENCY_REQUIREMENT_MASTER': 'Operational requirement families; exact official bindings remain pending.',
    'AGENCY_FIELD_MASTER': 'Operational field families and 13 source-labelled exact NIRF atomic fields; no independent official verification.',
    'EVIDENCE_REQUIREMENT_MAPPING': 'Canonical source junction candidates; imported status would not constitute approval.',
    'PARAMETER_EVIDENCE_MAPPING': 'Human-readable projection of source junction candidates.',
    'PARAMETER_DOCUMENT_BUNDLE': 'Identical parameter projection with missing upload status; not actual uploads.',
    'EXTRACTION_SCHEMA': 'Future extraction instructions; archive/inspect only, no execution.',
    'EXTRACTED_DATA_MASTER': 'Empty future extracted-value template.',
    'DATA_PROVENANCE': 'Empty future extracted-value provenance template.',
    'DATA_RECONCILIATION': 'Empty future reconciliation template.',
    'AGENCY_SUBMISSION_MASTER': 'Empty future agency-submission template.',
    'SOURCE_FORMAT_RULES': 'Supporting source-format handling definitions; no processing enabled.',
    'CONTROLLED_VOCABULARIES': 'Supporting status and classification vocabulary.',
    'FIELD_DICTIONARY': 'Supporting definitions of seven fields.',
    'RELATIONSHIP_MODEL': 'Architecture relationship descriptions; not engine rules.',
    'CONTROL_RULES': 'Supporting integrity and verification instructions.',
    'CHANGE_LOG': 'Source version history; approval names blank.',
    'AGENCY_CATALOG_LEGACY': 'Legacy catalog; not a second canonical agency catalog.',
    '_LISTS': 'Independent column-wise validation lists; rows are not entities.',
    'AGENCY_COVERAGE_SUMMARY': 'Source-authored aggregate counts; not verified accreditation scores.',
}
data = {}
for sheet in workbook:
    values = list(sheet.values)
    headers = list(values[0])
    rows = [dict(zip(headers, row), **{'_source_row': number}) for number, row in enumerate(values[1:], 2) if any(v is not None for v in row)]
    data[sheet.title] = rows

issues = []
blocked = {name: set() for name in specs}
duplicates = {name: 0 for name in specs}
for name, (key, required, refs) in specs.items():
    counts = Counter(str(row[key]) for row in data[name] if row[key] is not None)
    duplicates[name] = sum(n - 1 for n in counts.values() if n > 1)
    for row in data[name]:
        for field in required:
            if row[field] is None or row[field] == '':
                blocked[name].add(row['_source_row'])
                issues.append({'sheet': name, 'row': row['_source_row'], 'identifier': row[key], 'kind': 'Required value missing', 'field': field, 'reason': 'Hold; do not infer or fill the source value.'})
        for field, (target, target_key) in refs.items():
            if row[field] is not None and row[field] not in {r[target_key] for r in data[target]}:
                blocked[name].add(row['_source_row'])
                issues.append({'sheet': name, 'row': row['_source_row'], 'identifier': row[key], 'kind': 'Missing reference', 'field': field, 'reason': f'No matching {target}.{target_key}.'})
        if row[key] is not None and counts[str(row[key])] > 1:
            blocked[name].add(row['_source_row'])
            issues.append({'sheet': name, 'row': row['_source_row'], 'identifier': row[key], 'kind': 'Duplicate identifier', 'field': key, 'reason': 'Hold all conflicting identifiers; no overwrite.'})

groups = Counter((r['Evidence_ID'], r['Requirement_ID'], r['Agency_Field_ID']) for r in data['EVIDENCE_REQUIREMENT_MAPPING'])
duplicate_candidates = []
for row in data['EVIDENCE_REQUIREMENT_MAPPING']:
    if groups[(row['Evidence_ID'], row['Requirement_ID'], row['Agency_Field_ID'])] > 1:
        blocked['EVIDENCE_REQUIREMENT_MAPPING'].add(row['_source_row'])
        item = {'sheet': 'EVIDENCE_REQUIREMENT_MAPPING', 'row': row['_source_row'], 'identifier': row['Mapping_ID'], 'kind': 'Repeated relationship candidate', 'field': 'Evidence_ID + Requirement_ID + Agency_Field_ID', 'reason': 'Distinct Mapping_ID values retained; hold all members for human review, not silent deduplication.'}
        issues.append(item)
        duplicate_candidates.append(row)

while True:
    before = sum(len(v) for v in blocked.values())
    for name, (key, _, refs) in specs.items():
        for row in data[name]:
            if row['_source_row'] in blocked[name]:
                continue
            for field, (target, target_key) in refs.items():
                if any(r[target_key] == row[field] and r['_source_row'] in blocked[target] for r in data[target]):
                    blocked[name].add(row['_source_row'])
                    issues.append({'sheet': name, 'row': row['_source_row'], 'identifier': row[key], 'kind': 'Dependency held', 'field': field, 'reason': f'Referenced {target} record is held for resolution.'})
                    break
    if before == sum(len(v) for v in blocked.values()):
        break

inventory = []
for sheet in workbook:
    name = sheet.title
    headers = list(next(sheet.values))
    key, required, refs = specs.get(name, ('Source worksheet + physical row', [], {}))
    blank_fields = {str(h): sum(r[h] is None for r in data[name]) for h in headers if h is not None}
    count = len(data[name]) + (1 if name == 'README_ARCHITECTURE' else 0)
    eligible = len(data[name]) - len(blocked.get(name, set())) if name in specs else 0
    inventory.append({'name': name, 'purpose': purposes[name], 'headerRow': None if name == 'README_ARCHITECTURE' else 1, 'headers': headers, 'rows': count, 'proposed': eligible, 'held': len(blocked.get(name, set())), 'excluded': 0 if name in specs else count, 'identifier': key, 'target': 'master_reference_records · ' + name if name in specs else 'Source archive / inspection only', 'required': required, 'references': [{'field': k, 'target': f'{v[0]}.{v[1]}'} for k, v in refs.items()], 'duplicateIdentifiers': duplicates.get(name, 0), 'blankFields': blank_fields, 'statuses': {str(h): dict(Counter(str(r[h]) for r in data[name] if r[h] is not None)) for h in headers if h and ('Status' in str(h) or 'Version' in str(h))}, 'merged': list(map(str, sheet.merged_cells.ranges)), 'formulas': sum(c.data_type == 'f' for cells in sheet for c in cells), 'visibility': sheet.sheet_state, 'samples': data[name][:3]})

evidence_groups = Counter((r['Package_Name'], r['Document / Evidence Name']) for r in data['EVIDENCE_MASTER'])
report = {'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'inspectionDate': '2026-10-20', 'worksheets': inventory, 'issues': issues, 'duplicateSamples': duplicate_candidates[:6], 'summary': {'sheets': len(inventory), 'sourceRows': sum(s['rows'] for s in inventory), 'canonicalRows': sum(len(data[n]) for n in specs), 'proposedRows': sum(s['proposed'] for s in inventory), 'heldRows': sum(s['held'] for s in inventory), 'excludedRows': sum(s['excluded'] for s in inventory), 'missingRequired': sum(i['kind'] == 'Required value missing' for i in issues), 'missingReferences': sum(i['kind'] == 'Missing reference' for i in issues), 'duplicateIdentifiers': sum(duplicates.values()), 'repeatedMappingExcess': sum(n-1 for n in groups.values()), 'repeatedMappingRows': len(duplicate_candidates), 'evidenceNameCandidateGroups': sum(n > 1 for n in evidence_groups.values()), 'evidenceNameCandidateExcess': sum(n-1 for n in evidence_groups.values()), 'formulaCells': sum(s['formulas'] for s in inventory)}, 'notes': ['No database records imported. Proposed target tables do not yet exist.', 'README has 21 populated note rows including its title; all other counts exclude header row 1.', 'PARAMETER_EVIDENCE_MAPPING and PARAMETER_DOCUMENT_BUNDLE are identical cell-for-cell projections; neither is imported as a second junction.', 'Evidence records describe required templates. Missing does not establish an actual university evidence gap.', 'EVIDENCE_MASTER has 1,881 blank Domain_ID and Version_Validity values. These are optional in this import proposal and remain null.', 'AGENCY_MASTER has 20 blank Framework_Version, Official_Source and Last_Verified values; no official verification is inferred.', 'AGENCY_REQUIREMENT_MASTER row 95 NIRF-INNOV-REQ-001 lacks Agency_ID. One field and 182 mapping rows depend on it.', 'Source Document_Count is 140 for that requirement but the junction contains 182 rows; source aggregate is not silently corrected.', '30 excess composite candidates are held with all group members. Distinct source Mapping_ID values are preserved.', '158 repeated package/evidence-name groups (165 excess rows) are retained under distinct Evidence_ID values; name equality alone does not establish duplication.', 'The source marks 13 NIRF fields EXACT_ATOMIC_OFFICIAL_FIELD. Those labels are preserved but have not been independently checked against an official instrument.', 'No source ownership rule identifies a university. All proposed records are agency-wide/reference templates, company-restricted during Phase 2.', 'All original columns map unchanged into source_fields JSON; the original ID maps to source_identifier and physical worksheet row to source_row.', 'Field_ID in AGENCY_REQUIREMENT_MASTER is a requirement-family label, not the Agency_Field_ID key. The explicit Agency_Field_ID in junction rows is used instead.']}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, default=str, indent=2))
print(json.dumps(report['summary']))