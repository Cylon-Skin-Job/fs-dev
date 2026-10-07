#!/usr/bin/env python3
"""PP-WIKI-01 documentation checks. Never writes the live Wiki."""
from __future__ import annotations
import argparse
import collections
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

CAP = Path(__file__).resolve().parent
ROOT = CAP.parents[3]
WIKI = ROOT / 'ai/RC-MacAir-15/Wiki'
MAP = json.loads((CAP / 'PAGE-MAP.json').read_text())
ENTRIES = MAP['entries']
ALLOWED = {e['path']: e for e in ENTRIES if e['action'] != 'retain_reference'}
RETAINED = {e['path'] for e in ENTRIES if e['action'] == 'retain_reference'}
BASE = CAP / 'BASELINE.json'
REPORTS = CAP / 'runs'
LEGACY = {'incoming-edges', 'outgoing-edges', 'connected-skills', 'related-trigger-files'}
CODE_SUFFIXES = {'.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.sh', '.sql'}
BOUNDED_HEADINGS = {}  # Prose purposes are independently reviewed, not guessed from headings.

STAMP = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
LINK = re.compile(r'(?<!!)\[([^\]]+)\]\(([^)]+)\)|\[([^\]]+)\]\[([^\]]*)\]')
REFDEF = re.compile(r'^\s{0,3}\[([^\]]+)\]:\s*(\S+)', re.M)
SHORTREF = re.compile(r'(?<![!\]\[])\[([^\]\n]+)\](?![\[(:])')
HEADING = re.compile(r'^#{1,6}\s+(.+?)\s*#*\s*$', re.M)
NODE = ROOT / 'fusion-studio-client/node_modules/gray-matter'

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def digest(path: Path):
    return sha(path.read_bytes()) if path.is_file() else None

def now():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def rel(path: Path):
    return path.relative_to(ROOT).as_posix()

def load_baseline():
    if not BASE.exists():
        raise ValueError('BASELINE.json missing; run baseline first')
    return json.loads(BASE.read_text())

def parse_matter(items: dict[str, str]) -> dict:
    # The same installed parser used by the client; one invocation for the batch.
    js = r'''const fs=require('fs'); const matter=require(process.argv[1]); const input=JSON.parse(fs.readFileSync(0,'utf8')); let out={}; for(const [p,s] of Object.entries(input)){try {const r=matter(s); out[p]={data:r.data,content:r.content,lastType:typeof (r.data.metadata||{})['last-modified']};}catch(e){out[p]={error:String(e)}}}process.stdout.write(JSON.stringify(out));'''
    p = subprocess.run(['node', '-e', js, str(NODE)], input=json.dumps(items), text=True, capture_output=True)
    if p.returncode:
        raise ValueError('gray-matter unavailable: ' + p.stderr[:500])
    return json.loads(p.stdout)

def fencefree(body: str):
    lines=[]; fence=None
    for line in body.splitlines():
        m=re.match(r'^\s{0,3}(`{3,}|~{3,})',line)
        if m:
            marker=m.group(1)
            if fence is None: fence=marker[0]
            elif marker[0]==fence: fence=None
            lines.append(''); continue
        lines.append('' if fence else line)
    return '\n'.join(lines)

def slugs(body: str):
    seen=collections.Counter(); out=set()
    for m in HEADING.finditer(fencefree(body)):
        s=re.sub(r'<[^>]*>','',m.group(1))
        s=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',s)
        s=re.sub(r'[^\w\- ]','',s.lower()).replace(' ','-')
        n=seen[s]; seen[s]+=1
        out.add(f'{s}-{n}' if n else s)
    return out

def links(body: str):
    clean=fencefree(body)
    refs={m.group(1).lower().strip():m.group(2) for m in REFDEF.finditer(clean)}
    for m in LINK.finditer(clean):
        target=m.group(2) or refs.get((m.group(4) or m.group(3) or '').lower().strip())
        if target: yield target.strip().strip('<>')
    for m in SHORTREF.finditer(clean):
        target=refs.get(m.group(1).lower().strip())
        if target:yield target.strip().strip('<>')

def check_links(path: Path, body: str, pending: set[str]):
    errors=[]; waiting=[]
    for target in links(body):
        target=target.split(' ',1)[0]
        parsed=urllib.parse.urlsplit(target)
        if parsed.scheme or target.startswith('//') or target.startswith('#') and not parsed.path:
            if target.startswith('#') and urllib.parse.unquote(parsed.fragment) not in slugs(body): errors.append(f'{rel(path)}: missing local fragment {target}')
            continue
        q=urllib.parse.unquote(parsed.path)
        resolved=(path.parent/q).resolve()
        try: rp=rel(resolved)
        except ValueError:
            errors.append(f'{rel(path)}: link escapes repository {target}');continue
        if not resolved.is_file():
            if rp in pending: waiting.append(rp)
            else: errors.append(f'{rel(path)}: missing link {target}')
        elif parsed.fragment:
            text=resolved.read_text(errors='replace')
            if urllib.parse.unquote(parsed.fragment) not in slugs(text):
                errors.append(f'{rel(path)}: missing fragment {target}')
    return errors, waiting

def metadata_errors(path: Path, raw: str, parsed: dict):
    errors=[]; p=rel(path)
    if 'error' in parsed: return [f'{p}: invalid frontmatter: {parsed["error"]}']
    data=parsed['data']; meta=data.get('metadata')
    if not isinstance(data.get('name'),str) or not data['name'].strip(): errors.append(f'{p}: empty name')
    if not isinstance(data.get('description'),str) or not data['description'].strip(): errors.append(f'{p}: empty description')
    if not isinstance(meta,dict): return errors+[f'{p}: missing metadata map']
    for key in LEGACY & meta.keys(): errors.append(f'{p}: legacy metadata {key}')
    sources=meta.get('source-files')
    if not isinstance(sources,list) or any(not isinstance(x,str) for x in sources): errors.append(f'{p}: source-files must be strings')
    else:
        if len(sources)!=len(set(sources)): errors.append(f'{p}: duplicate source')
        for source in sources:
            if source.startswith('/') or '..' in Path(source).parts or '\\' in source or any(x in source for x in '*?<>'):
                errors.append(f'{p}: invalid source {source}'); continue
            f=ROOT/source
            if not f.is_file() or f.is_symlink() or f.suffix not in CODE_SUFFIXES: errors.append(f'{p}: missing/non-code source {source}')
        # [] is valid for approved intent. Current-claim source coverage is checked separately.
    stamp=meta.get('last-modified')
    if parsed['lastType']!='string' or not isinstance(stamp,str): errors.append(f'{p}: timestamp must parse as quoted string')
    else:
        if not STAMP.fullmatch(stamp): errors.append(f'{p}: timestamp shape')
        else:
            try: dt.datetime.strptime(stamp,'%Y-%m-%dT%H:%M:%SZ')
            except ValueError: errors.append(f'{p}: invalid date')
        if not re.search(r'^\s{2}last-modified:\s*[\'\"]'+re.escape(stamp)+r'[\'\"]\s*$',raw,re.M): errors.append(f'{p}: timestamp not quoted in metadata')
    return errors

def snapshot_state():
    allpages=sorted(WIKI.rglob('PAGE.md'))
    versions=sorted(WIKI.rglob('.versions/*.md'))
    entry=[]
    for e in ENTRIES:
        p=ROOT/e['path']
        entry.append({**e,'exists':p.is_file(),'sha256':digest(p)})
    return entry,{rel(p):digest(p) for p in allpages},{rel(p):digest(p) for p in versions}

def source_inventory():
    sourced=json.loads((CAP/'SOURCES.json').read_text())
    sources={s['path'] for s in sourced['sources']}

    out=[]
    for r in sorted(sources):
        p=ROOT/r
        out.append({'path':r,'exists':p.is_file(),'sha256':digest(p)})
    return out

def agnets():
    return [rel(p) for p in (WIKI.parent).rglob('AGENTS.md') if 'Wiki' in p.parts or CAP.name in p.parts]

def baseline():
    if BASE.exists(): raise ValueError('BASELINE.json exists; refusing to replace')
    entries,pages,versions=snapshot_state()
    source=source_inventory()
    data={'schema_version':1,'captured_at':now(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'entries':entries,'wiki_pages':pages,'versions':versions,'sources':source,
          'nested_agents':agnets(),
          'limits':['Source inspection only; no product runtime/build/Alpha checks.','Preparation hashes are not the execution baseline.']}
    with BASE.open('x') as f: json.dump(data,f,indent=2);f.write('\n')
    return {'baseline':rel(BASE),'counts':{'entries':len(entries),'present':sum(x['exists'] for x in entries),'absent':sum(not x['exists'] for x in entries),'wiki_pages':len(pages),'versions':len(versions),'source_files':len(source)},'nested_agents':data['nested_agents']}

def planned(slice_name):
    idx=int(slice_name[1:]); return {e['path'] for e in ENTRIES if e['action']!='retain_reference' and e['slice'] and int(e['slice'][1:])<=idx}

def original_snapshot(path: Path, old_hash: str):
    return next((v for v in path.parent.glob('.versions/*.md') if digest(v)==old_hash), None)

def bounded_metadata_errors(rp, before, after):
    parsed=parse_matter({'before':before,'after':after})
    if any('error' in x for x in parsed.values()): return [rp+': invalid frontmatter']
    for p in parsed.values():
        meta=p['data'].get('metadata',{})
        for k in LEGACY|{'source-files','last-modified'}: meta.pop(k,None)
    return [] if parsed['before']['data']==parsed['after']['data'] else [rp+': unrelated metadata changed']


def coverage_errors(mode, slice_name):
    errors=[]
    try:
        data=json.loads((CAP/'COVERAGE.json').read_text())
        required={f'D{i:02}' for i in range(1,13)}|{f'C{i:02}' for i in range(1,11)}|{f'AC{i:02}' for i in range(1,9)}
        rows=data['entries']; found={r['id'] for r in rows}
        if found!=required or len(rows)!=len(found): errors.append('coverage IDs missing/extra/duplicate')
        for row in rows:
            if not row.get('outputs') or any(p not in ALLOWED for p in row['outputs']):errors.append(row['id']+': invalid planned output')
            if mode=='final' and (row.get('status')!='verified' or not row.get('evidence')):errors.append(row['id']+': coverage not verified')
        claims=json.loads((CAP/'CLAIMS.json').read_text())['claims']
        for row in claims:
            if not row.get('output') or row['output'] not in ALLOWED:errors.append(row.get('id','?')+': claim output missing')
            if row.get('classification') not in {'current','approved','open','gap'}:errors.append(row.get('id','?')+': invalid claim class')
            if row.get('classification')=='current' and (not row.get('symbol') or not row.get('limits')):errors.append(row['id']+': current claim scope missing')
            if row.get('classification') in {'approved','open'} and not row.get('authority'):errors.append(row['id']+': authority missing')
            if mode=='final' and (not row.get('anchor') or row.get('reviewer_conclusion') not in {'verified','CLEAN'}):errors.append(row['id']+': final claim not reviewed/anchored')
            if mode=='final' and row.get('anchor') and (ROOT/row['output']).is_file() and row['anchor'] not in slugs((ROOT/row['output']).read_text()):errors.append(row['id']+': claim output anchor missing')
    except Exception as exc:errors.append('coverage/claim data invalid: '+str(exc))
    return errors

def claim_source_errors(claims: list, root: Path):
    errors=[]
    for row in claims:
        if row.get('classification')!='current':continue
        rp=row.get('path'); expected=row.get('source_sha256')
        if not isinstance(rp,str) or not isinstance(expected,str) or not re.fullmatch('[0-9a-f]{64}',expected):
            errors.append(f'{row.get("id")}: current claim missing exact source/hash');continue
        p=(root/rp).resolve()
        if not p.is_relative_to(root) or digest(p)!=expected:
            errors.append(f'{row.get("id")}: claimed source drift or missing: {rp}')
    for row in claims:
        for source in row.get('sources',[]):
            if digest(root/source['path'])!=source.get('sha256'):errors.append(row['id']+': dependent source drift: '+source['path'])
    return errors

def external_drift(rp: str, old: str|None, current: str|None, attributions: dict):
    row=attributions.get(rp)
    if not isinstance(row,dict) or row.get('from_sha256')!=old or row.get('to_sha256')!=current or not row.get('attributed_to') or not row.get('reason'):
        return f'{rp}: unexplained outside-scope wiki drift'
    return None

MARKER_NAMES=('section-toc','children')

def generated_blocks(text: str):
    """Read every generated region maintained by toc-sync.js on owned pages."""
    return {name:re.findall(r'<!-- '+name+r':start -->(.*?)<!-- '+name+r':end -->',text,re.S)
            for name in MARKER_NAMES}

def marker_errors(rp: str, blocks: dict):
    required={'ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md',
              'ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/PAGE.md',
              'ai/RC-MacAir-15/Wiki/011-Platform_And_Plugins/000-Platform_And_Plugins/PAGE.md'}
    return [f'{rp}: required section-toc marker block missing or duplicated'] if rp in required and len(blocks['section-toc'])!=1 else []

def generated_comparison_errors(rp: str, live: dict, first: dict, second: dict):
    errors=marker_errors(rp,live)
    for name in MARKER_NAMES:
        if first[name]!=second[name]:errors.append(f'{rp}: {name} generated blocks not idempotent')
        if live[name]!=first[name]:errors.append(f'{rp}: live {name} block differs from staged audit')
    return errors

def timestamp_only(before: str, after: str):
    parsed=parse_matter({'before':before,'after':after})
    if any('error' in x for x in parsed.values()): return False
    a,b=parsed['before'],parsed['after']
    if a['content']!=b['content']: return False
    da,db=a['data'],b['data']
    if not isinstance(da.get('metadata'),dict) or not isinstance(db.get('metadata'),dict): return False
    da['metadata'].pop('last-modified',None);db['metadata'].pop('last-modified',None)
    return da==db

def timestamp_receipt_errors(changed: list[Path]):
    receipt=CAP/'TIMESTAMP-RECEIPT.json'
    if not receipt.is_file(): return ['final timestamp receipt missing']
    try: data=json.loads(receipt.read_text())
    except Exception as exc: return [f'timestamp receipt invalid: {exc}']
    stamp=data.get('stamped_at')
    if not isinstance(stamp,str) or not STAMP.fullmatch(stamp): return ['timestamp receipt UTC stamp invalid']
    rows=data.get('entries')
    if not isinstance(rows,list): return ['timestamp receipt entries missing']
    bypath={x.get('path'):x for x in rows if isinstance(x,dict)}
    wanted={rel(p) for p in changed if p.is_file()}
    if set(bypath)!=wanted:return [f'timestamp receipt paths differ: missing={sorted(wanted-set(bypath))}, extra={sorted(set(bypath)-wanted)}']
    errors=[]
    for rp,row in bypath.items():
        p=ROOT/rp; snapshot=ROOT/row.get('snapshot','')
        if not snapshot.is_file():errors.append(f'{rp}: timestamp predecessor missing');continue
        before=snapshot.read_text();after=p.read_text()
        if sha(before.encode())!=row.get('before_sha256') or digest(p)!=row.get('after_sha256'):
            errors.append(f'{rp}: timestamp receipt hash mismatch')
        if not timestamp_only(before,after):errors.append(f'{rp}: stamp changed other content or metadata')
        parsed=parse_matter({'after':after})['after']
        if parsed.get('data',{}).get('metadata',{}).get('last-modified')!=stamp:
            errors.append(f'{rp}: timestamp differs from receipt')
    return errors

def edit_ledger_errors(baseline_hashes: dict, current_hashes: dict, rows: list, authority: set, root: Path):
    errors=[]; last=dict(baseline_hashes); touched=set()
    for i,row in enumerate(rows):
        rp=row.get('path'); touched.add(rp)
        if rp not in authority:
            errors.append(f'edit {i}: unauthorized path {rp}');continue
        before=row.get('before_sha256');after=row.get('after_sha256')
        if row.get('status')!='complete': errors.append(f'edit {i}: incomplete receipt')
        if last.get(rp)!=before: errors.append(f'edit {i}: predecessor chain mismatch {rp}')
        snap=row.get('snapshot')
        if before is not None:
            if not isinstance(snap,str) or not snap.startswith(rp.rsplit('/',1)[0]+'/.versions/'):
                errors.append(f'edit {i}: exact predecessor snapshot missing {rp}')
            elif digest(root/snap)!=before:
                errors.append(f'edit {i}: predecessor snapshot overwritten or wrong {rp}')
        elif snap is not None:errors.append(f'edit {i}: absent predecessor has snapshot {rp}')
        last[rp]=after
    for rp,current in current_hashes.items():
        if current!=baseline_hashes.get(rp) and rp not in touched:
            errors.append(f'{rp}: changed without edit receipt')
        if rp in touched and last.get(rp)!=current:
            errors.append(f'{rp}: edit receipt does not reach current bytes')
    return errors

def generation_errors(changed: list[Path]):
    errors=[]; evidence={}
    if not changed: return errors,evidence
    symlinks=[rel(p) for p in WIKI.rglob('*') if p.is_symlink()]
    if symlinks: return ['staging rejected symlink(s): '+', '.join(symlinks[:10])],evidence
    with tempfile.TemporaryDirectory(prefix='ppw01-audit-',dir=CAP) as td:
        staged=Path(td)/'Wiki';shutil.copytree(WIKI,staged)
        command=['node',str(ROOT/'fusion-studio-server/scripts/wiki.js'),'audit',str(staged)]
        p1=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
        if p1.returncode: return ['staged audit first run failed: '+p1.stderr[-500:]],evidence
        first={rel(p):generated_blocks((staged/p.relative_to(WIKI)).read_text()) for p in changed if p.is_file()}
        p2=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
        if p2.returncode: return ['staged audit second run failed: '+p2.stderr[-500:]],evidence
        second={rel(p):generated_blocks((staged/p.relative_to(WIKI)).read_text()) for p in changed if p.is_file()}
        for p in changed:
            if not p.is_file():continue
            rp=rel(p);live=generated_blocks(p.read_text())
            errors+=generated_comparison_errors(rp,live,first[rp],second[rp])
        evidence={'command':' '.join(command),'first_exit':p1.returncode,'second_exit':p2.returncode,
                  'changed_pages_with_markers':sum(any(v[name] for name in MARKER_NAMES) for v in first.values()),
                  'first_stdout_tail':p1.stdout[-1000:],'second_stdout_tail':p2.stdout[-1000:]}
    return errors,evidence

def verify(mode: str, slice_name='S05'):
    b=load_baseline(); errors=[]; warnings=[]; pending=[]; inputs={}; prose_hits=[]; counts=collections.Counter()
    attribution_path=CAP/'EXTERNAL-DRIFT.json'
    try:
        attribution_rows=json.loads(attribution_path.read_text()).get('entries',[]) if attribution_path.exists() else []
        attributions={x['path']:x for x in attribution_rows}
    except Exception as exc:
        errors.append(f'external drift attribution invalid: {exc}');attributions={}
    allowed_now=planned(slice_name) if mode=='slice' else set(ALLOWED)
    pending_future={e['path'] for e in ENTRIES if e['action']=='create' and e['path'] not in allowed_now} if mode=='slice' else set()
    actual=[]; changed=[]
    baseline_pages=set(b['wiki_pages'])
    current_pages={rel(p) for p in WIKI.rglob('PAGE.md')}
    for rp in sorted(current_pages-baseline_pages):
        if rp not in ALLOWED:
            e=external_drift(rp,None,digest(ROOT/rp),attributions)
            (errors if e else warnings).append(e or f'{rp}: attributed external new wiki page')
    for rp in sorted(baseline_pages-current_pages):
        if rp not in ALLOWED or ALLOWED[rp]['action']!='retire':
            e=external_drift(rp,b['wiki_pages'][rp],None,attributions)
            (errors if e else warnings).append(e or f'{rp}: attributed external wiki deletion')
    for e in b['entries']:
        p=ROOT/e['path']; d=digest(p); old=e['sha256']; action=e['action']; rp=e['path']
        inputs[rp]=d
        if d!=old:
            if action=='retain_reference':
                e=external_drift(rp,old,d,attributions)
                (errors if e else warnings).append(e or f'{rp}: attributed external retained-reference change')
            elif rp not in allowed_now: errors.append(f'{rp}: edited before owning slice')
            else: changed.append(rp)
        if action=='create' and rp in allowed_now and d is None: errors.append(f'{rp}: required create absent')
        if action=='retire' and rp in allowed_now and d is not None: errors.append(f'{rp}: root not retired')
        if action=='rewrite' and rp in allowed_now and d is None: errors.append(f'{rp}: required rewrite absent')
        if action=='rewrite' and rp in allowed_now and d==old: errors.append(f'{rp}: required rewrite unchanged')
        if action=='bounded_update' and rp in allowed_now and d is None: errors.append(f'{rp}: support page absent')
        if action=='bounded_update' and rp in allowed_now and d==old: errors.append(f'{rp}: required bounded update unchanged')
        if d!=old and old is not None and rp in allowed_now:
            predecessor=original_snapshot(p,old)
            if predecessor is None: errors.append(f'{rp}: exact baseline predecessor snapshot missing')
            elif action=='bounded_update' and p.is_file(): errors+=bounded_metadata_errors(rp,predecessor.read_text(),p.read_text())
        if d!=old and rp in allowed_now: actual.append(p)
    for rp,old in b['versions'].items():
        if digest(ROOT/rp)!=old: errors.append(f'{rp}: historical snapshot changed or removed')
    for rp,old in b['wiki_pages'].items():
        if rp not in {e['path'] for e in b['entries']} and digest(ROOT/rp)!=old:
            if rp in baseline_pages-current_pages:continue
            e=external_drift(rp,old,digest(ROOT/rp),attributions)
            (errors if e else warnings).append(e or f'{rp}: attributed external outside-scope change')
    receipt_path=CAP/'EDIT-RECEIPTS.json'
    try: edits=json.loads(receipt_path.read_text()).get('edits',[]) if receipt_path.exists() else []
    except Exception as exc: errors.append(f'edit ledger invalid: {exc}');edits=[]
    baseline_hashes={e['path']:e['sha256'] for e in b['entries'] if e['action']!='retain_reference'}
    current_hashes={rp:digest(ROOT/rp) for rp in baseline_hashes}
    errors+=edit_ledger_errors(baseline_hashes,current_hashes,edits,set(ALLOWED),ROOT)
    for source in b['sources']:
        if digest(ROOT/source['path'])!=source['sha256']:
            warnings.append(f'{source["path"]}: source drift; re-inspect affected claims')
    for source in json.loads((CAP/'ADDITIONAL-SOURCES.json').read_text())['sources']:
        if digest(ROOT/source['path'])!=source['sha256']:warnings.append(source['path']+': additional source drift; reassess claims')
    try:
        claims=json.loads((CAP/'CLAIMS.json').read_text())['claims']
        errors+=claim_source_errors(claims,ROOT)
    except Exception as exc:errors.append(f'CLAIMS.json invalid: {exc}')
    errors += coverage_errors(mode, slice_name)
    raw={rel(p):p.read_text() for p in actual if p.is_file()}
    parsed=parse_matter(raw) if raw else {}
    for rp,body in raw.items():
        p=ROOT/rp
        errors+=metadata_errors(p,body,parsed[rp])
        if 'error' not in parsed[rp]:
            ee,ww=check_links(p,parsed[rp]['content'],pending_future)
            errors+=ee; pending+=ww
            errors+=marker_errors(rp,generated_blocks(body))
            for line_number,line in enumerate(parsed[rp]['content'].splitlines(),1):
                if re.search(r'\bSPEC\b|Captures/|doc-viewer|System/Views',line,re.I):
                    prose_hits.append({'path':rp,'body_line':line_number,'text':line[:240]})
        counts['changed_live_pages']+=1
    incoming_errors,incoming_warnings,incoming_count=incoming_navigation_errors()
    errors+=incoming_errors;warnings+=incoming_warnings;counts['incoming_pages_checked']=incoming_count
    if mode=='final' and pending: errors.append('final has pending future links')
    if mode=='final':
        errors+=reachability_errors()
        ge,stage=generation_errors(actual); errors+=ge
        errors+=timestamp_receipt_errors(actual)
    else: stage=None
    counts['changed_total']=len(changed);counts['mapped']=len(ENTRIES); counts['existing_snapshots']=len(b['versions']);counts['pending_links']=len(pending)
    return {'inputs':inputs,'changed_paths':changed,'counts':dict(counts),'failures':errors,'warnings':warnings,'pending':pending,'prose_review_hits':prose_hits,'staged_generation':stage,'exclusions':['No product runtime/build/Alpha checks','Read-only specialist/Chat/UEB pages not recertified','Semantic content and source routes require independent review']}

def local_targets(path, text):
    for target in links(text):
        parsed=urllib.parse.urlsplit(target)
        if parsed.scheme or target.startswith('//'):continue
        resolved=(path.parent/urllib.parse.unquote(parsed.path)).resolve()
        if resolved.is_relative_to(ROOT):yield rel(resolved)


def incoming_navigation_errors():
    baseline=json.loads((CAP/'NAVIGATION-BASELINE.json').read_text())
    errors=[];warnings=[];count=0
    for p in WIKI.rglob('PAGE.md'):
        rp=rel(p)
        if rp in ALLOWED or not set(local_targets(p,p.read_text())) & set(ALLOWED):continue
        count+=1
        failures,_=check_links(p,p.read_text(),set())
        for failure in failures:
            if failure in baseline.get(rp,[]):warnings.append('preexisting incoming-page link outside scope: '+failure)
            else:errors.append(failure)
    return errors,warnings,count


def reachability_errors():
    overview=next(e['path'] for e in ENTRIES if e['slice']=='S01' and '/000-Platform_And_Plugins/PAGE.md' in e['path'])
    errors=[]
    for route in ('ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/PAGE.md','ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md'):
        if overview not in set(local_targets(ROOT/route,(ROOT/route).read_text())):errors.append(route+': missing route to new overview')
    visited=set();queue=[overview]
    while queue:
        rp=queue.pop()
        if rp in visited or rp not in ALLOWED or not (ROOT/rp).is_file():continue
        visited.add(rp);queue.extend(local_targets(ROOT/rp,(ROOT/rp).read_text()))
    for e in ENTRIES:
        if e['action']=='create' and e['path'] not in visited:errors.append(e['path']+': new article unreachable from overview')
    root=WIKI/'011-Platform_And_Plugins/PAGE.md'
    if root.exists():errors.append('duplicate new section root PAGE.md exists')
    return errors


def self_test():
    # Test the actual validation helpers in a disposable, repo-local-ish fixture path.
    good='---\nname: Example\ndescription: A test.\nmetadata:\n  source-files:\n    - fusion-studio-server/lib/views/index.js\n  last-modified: "2026-09-21T12:00:00Z"\n---\n# Intro\n\n## Repeat\n## Repeat\n\n[heading](#repeat-1)\n'
    cases=[]
    def check(label,condition): cases.append({'case':label,'passed':bool(condition)})
    with tempfile.TemporaryDirectory(prefix='ppw01-fixture-', dir=CAP) as td:
        p=Path(td)/'PAGE.md';p.write_text(good)
        variants={'good':good,'bad_yaml':good.replace('name: Example','name: [broken'),'native_date':good.replace('"2026-09-21T12:00:00Z"','2026-09-21T12:00:00Z'),
                  'bad_date':good.replace('2026-09-21T12:00:00Z','2026-02-30T12:00:00Z'),
                  'duplicate':good.replace('    - fusion-studio-server/lib/views/index.js','    - fusion-studio-server/lib/views/index.js\n    - fusion-studio-server/lib/views/index.js'),
                  'directory':good.replace('fusion-studio-server/lib/views/index.js','fusion-studio-server/lib/views/'),
                  'declarative_json_source':good.replace('fusion-studio-server/lib/views/index.js','System_Manager/ai-template/templates/workspace-templates/new/profile.json'),
                  'missing_link':good+'\n[missing](absent.md)\n','missing_fragment':good+'\n[missing](#absent)\n',
                  'reference_link':good+'\n[ok][ref]\n\n[ref]: #intro\n',
                  'collapsed_reference_broken':good+'\n[Missing][]\n\n[Missing]: absent.md\n',
                  'shortcut_reference_broken':good+'\n[Missing]\n\n[Missing]: absent.md\n',
                  'shortcut_reference_valid':good+'\n[Intro]\n\n[Intro]: #intro\n'}
        parsed=parse_matter(variants)
        for name,v in variants.items():
            if name.startswith('missing') or name in {'reference_link','collapsed_reference_broken','shortcut_reference_broken','shortcut_reference_valid'}:
                ee,_=check_links(p,parsed[name]['content'],set())
                check(name, bool(ee) if name.startswith('missing') or name in {'collapsed_reference_broken','shortcut_reference_broken'} else not ee)
            else:
                ee=metadata_errors(ROOT/'ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/fixture/PAGE.md',v,parsed[name])
                check(name, not ee if name=='good' else bool(ee))
        check('duplicate_heading_slug','repeat-1' in slugs(good))
        future=ROOT/'ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/fiction/PAGE.md'
        e,w=check_links(p,'[future]('+str(future)+')',{rel(future)})
        check('intermediate_future',not e and bool(w))
        e,w=check_links(p,'[future]('+str(future)+')',set())
        check('final_future_rejected',bool(e))
        fake='fixture/PAGE.md';original=b'original';updated=b'updated'
        snap=Path(td)/'fixture/.versions/2026-09-21-120000.md';snap.parent.mkdir(parents=True)
        snap.write_bytes(original)
        row={'path':fake,'before_sha256':sha(original),'after_sha256':sha(updated),
             'snapshot':'fixture/.versions/2026-09-21-120000.md','status':'complete'}
        check('valid_edit_chain',not edit_ledger_errors({fake:sha(original)},{fake:sha(updated)},[row],{fake},Path(td)))
        check('unauthorized_edit',bool(edit_ledger_errors({fake:sha(original)},{fake:sha(updated)},[row],set(),Path(td))))
        snap.write_bytes(b'overwritten')
        check('overwritten_snapshot',bool(edit_ledger_errors({fake:sha(original)},{fake:sha(updated)},[row],{fake},Path(td))))
        snap.write_bytes(original)
        second_snap=Path(td)/'fixture/.versions/2026-09-21-120001.md';second_snap.write_bytes(original)
        second={**row,'before_sha256':sha(updated),'after_sha256':sha(b'final'),
                'snapshot':'fixture/.versions/2026-09-21-120001.md'}
        check('intermediate_predecessor_missing',bool(edit_ledger_errors({fake:sha(original)},{fake:sha(b'final')},[row,second],{fake},Path(td))))
        overview='ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md'
        check('missing_overview_marker',bool(marker_errors(overview,generated_blocks('# overview\n'))))
        child=Path(td)/'child.md';child.write_text('# Child\n')
        valid='[Child](child.md)'
        ee,_=check_links(p,valid,set())
        live=generated_blocks('<!-- children:start -->\n'+valid+' - stale description\n<!-- children:end -->')
        fresh=generated_blocks('<!-- children:start -->\n'+valid+' - current description\n<!-- children:end -->')
        check('stale_children_block_with_valid_link',not ee and bool(generated_comparison_errors('fixture/PAGE.md',live,fresh,fresh)))
        check('stamp_body_alteration',not timestamp_only(good,good+'extra'))
        check('stamp_only_valid',timestamp_only(good,good.replace('2026-09-21T12:00:00Z','2026-09-21T12:00:01Z')))
        with_display='---\nname: Test\ndescription: Test\nmetadata:\n  source-files: []\n  display: cards\n  last-modified: "2026-09-21T12:00:00Z"\n---\n## Current Docs\nBody\n'
        check('bounded_preserves_domain_metadata',bool(bounded_metadata_errors('fixture',with_display,with_display.replace('  display: cards\n',''))))
        code=Path(td)/'source.js';code.write_bytes(b'current')
        claim={'id':'fixture','classification':'current','path':'source.js','source_sha256':digest(code)}
        check('claimed_source_valid',not claim_source_errors([claim],Path(td)))
        code.write_bytes(b'drifted')
        check('claimed_source_drift',bool(claim_source_errors([claim],Path(td))))
        check('unexplained_external_drift',bool(external_drift('Wiki/other/PAGE.md','a','b',{})))
        attribution={'Wiki/other/PAGE.md':{'from_sha256':'a','to_sha256':'b','attributed_to':'other session','reason':'owner edit'}}
        check('attributed_external_drift',not external_drift('Wiki/other/PAGE.md','a','b',attribution))
    return {'cases':cases,'counts':{'passed':sum(x['passed'] for x in cases),'total':len(cases)},'failures':[x['case'] for x in cases if not x['passed']],'exclusions':['Disposable fixture only; no live wiki mutation']}

def report(command, result):
    REPORTS.mkdir(exist_ok=True)
    data={'command':command,'checked_at':now(),'tool_sha256':digest(Path(__file__)), 'packet_sha256':{p:digest(CAP/p) for p in ('PAGE-MAP.json','SOURCES.json','CLAIMS.json','COVERAGE.json')},'parser':str(NODE),**result}
    name=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-'+command.replace(' ','-')+'.json'
    (REPORTS/name).write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'report':rel(REPORTS/name),'counts':data.get('counts'),'failures':data.get('failures'),'warnings':len(data.get('warnings',[]))},indent=2))
    return 1 if data.get('failures') else 0

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('command',choices=['baseline','self-test','slice','final']);ap.add_argument('slice',nargs='?',choices=[f'S{i:02d}' for i in range(6)])
    a=ap.parse_args(); command=a.command+(' '+a.slice if a.slice else '')
    try:
        if a.command=='baseline': result=baseline()
        elif a.command=='self-test': result=self_test()
        elif a.command=='slice':
            if not a.slice: ap.error('slice requires S00–S05')
            result=verify('slice',a.slice)
        else: result=verify('final')
    except Exception as exc: result={'failures':[str(exc)],'counts':{}}
    return report(command,result)
if __name__=='__main__':sys.exit(main())
