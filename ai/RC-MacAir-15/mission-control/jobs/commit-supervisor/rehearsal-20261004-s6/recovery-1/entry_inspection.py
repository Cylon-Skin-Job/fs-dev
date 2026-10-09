"""Independently reconcile raw saved unfinished state before public recovery."""
from pathlib import Path
import re, shutil, sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import recovery_evidence as p

def process_identity(process, record):
    fields={key:record[key] for key in ['pid','ppid','uid','start','command']}
    raw=process['raw'][str(record['pid'])]
    field=None
    for line in raw['cwd_executable']['stdout'].splitlines():
        if line.startswith('f'):field=line[1:]
        if line.startswith('n') and field=='cwd':fields['cwd']=line[1:]
        if line.startswith('n') and field=='txt' and 'executable' not in fields:fields['executable']=line[1:]
    env=raw['environment']['stdout']
    fields['machine']=re.search(r'(?:^|\s)FUSION_LOCAL_MACHINE=(\S+)',env).group(1)
    if 'env' in record:fields['env']=record['env']
    else:fields['env']={'FUSION_LOCAL_MACHINE':fields['machine']}
    assert fields['cwd'] and fields['executable'] and fields['uid']==501
    return fields

initial=p.read(p.N/'initial.json');old=p.read(p.I/'after-interruption.json')
before=p.read(p.I/'before-stop.json');afterstop=p.read(p.I/'after-stop.json')
checkpoint=p.read(p.I/'checkpoint.json');guard=p.read(p.I/'fixed-checkpoint/restore-guard.json')
result=p.read(p.I/'interruption-result.json')
assert p.digest(p.ASSIGNMENT.read_bytes())==p.ASSIGNMENT_HASH
assert p.digest((p.I/'checkpoint.json').read_bytes())=='144bb5ef8f195a403cd596bc593f543c7b11a0f7b7c0a216305d49936e972008'
assert initial['candidate']==old['candidate']==guard['expected']==result['full_current_state']
assert before['candidate']==afterstop['candidate']
assert initial['source_leaves']==old['source_leaves']
assert initial['source_build_caches']==old['source_build_caches']
assert all(initial['historical_job'][name]==value for name,value in old['historical_job'].items())
changes=[name for name in old['candidate']['paths'] if old['candidate']['paths'][name]!=afterstop['candidate']['paths'][name]]
assert changes==['rehearsal-inputs/checkpoint.bin','rehearsal-inputs/future-addition.txt']
commands=[]
for file in sorted(p.I.glob('*.command.json')):
    command=p.read(file)
    for key in ['stdout_raw','stderr_raw']:
        assert p.digest(Path(command[key]['path']).read_bytes())==command[key]['sha256']
    commands.append({'path':str(file),'sha256':p.digest(file.read_bytes()),'command':command['command'],
                     'exit_code':command['exit_code'],'stdout_raw':command['stdout_raw'],'stderr_raw':command['stderr_raw']})
stop=p.read(p.I/'owned-stop.json');assert stop['remaining']==[]
process=p.read(p.N/'initial-processes.json');priorprocess=p.read(p.I/'after-interruption-processes.json')
assert process['selected']==[]
currentids=[process_identity(process,r) for r in process['protectedTrees']]
assert currentids==[process_identity(priorprocess,r) for r in priorprocess['protectedTrees']]
ports=set();preproc=p.read(p.I/'before-stop-processes.json')
for line in preproc['raw']['listeners']['stdout'].splitlines():
    if any(re.match(r'^\S+\s+'+str(r['pid'])+r'\s',line) for r in stop['selected']):
        ports.update(int(n) for n in re.findall(r':(\d+)\s+\(LISTEN\)',line))
assert not any(re.search(r':'+str(port)+r'\s+\(LISTEN\)',process['raw']['listeners']['stdout']) for port in ports)
assert not any(re.match(r'^\s*'+str(r['pid'])+r'\s',line) for line in process['raw']['all']['stdout'].splitlines() for r in stop['selected'])
for data in checkpoint['verification'].values():
    assert p.digest(Path(data['path']).read_bytes())==data['sha256']
records=[]
for file in sorted(p.I.rglob('*.json')):
    value=p.read(file)
    records.append({'path':str(file),'sha256':p.digest(file.read_bytes()),'field_count':len(value),'size':file.stat().st_size})
proof={'at':p.now(),'actor':p.ACTOR,
       'actual_predecessor_native_terminal':'Observed exact collaboration.list_agents subtree completed unmet-gate/native END/no descendants',
       'native_current_tree':'Only /root and this actor running among all returned agents; this actor has no children',
       'root_disjoint_scope':'Explicit root assignment; root owns E, no private writers; unique recovery-1 ownership',
       'raw_predecessor_records_full_parsed':records,'raw_commands':commands,'raw_command_count':len(commands),
       'exact_current_guard_full_state':True,'before_stop_full_state_equal_after_stop':True,'actual_interruption_exact_paths':changes,
       'source11977_exact':True,'source_cache193_exact':True,'historical_original_job1224_subset_exact':True,
       'source_physical_index':initial['candidate']['protected'][str(p.R)]['index_file_sha256'],
       'private_original_six_absent':True,'owned_tree_selected':process['selected'],'private_server_CDP_ports':sorted(ports),
       'private_listeners_absent':True,'protected4_and13_current_identifiers_equal':True,'protected_processes':currentids,
       'predecessor_stop_receipt':{'path':str(p.I/'owned-stop.json'),'sha256':p.digest((p.I/'owned-stop.json').read_bytes()),'record':stop},
       'old_guard_preserved':{'path':str(p.I/'fixed-checkpoint/restore-guard.json'),'sha256':p.digest((p.I/'fixed-checkpoint/restore-guard.json').read_bytes())},
       'matching_schedules':p.schedules(),'current_ready':False,'publication_operation_authority':'NONE'}
p.save('independent-entry-inspection.json',proof)
activation={'at':p.now(),'signature':'Codex side chat (ephemeral)','actor':p.ACTOR,'manager':'/root',
            'actual_cwd':str(p.C),'controller_home':str(p.C),'source':str(p.R),'candidate':str(p.P),'J':str(p.J),
            'evidence_owned':str(p.N),'role':'Commit Supervisor SECOND recovery-only',
            'supported_runtime':'default fallback, exact installed SKILL.md and TOML developer instructions explicitly loaded',
            'effective_permissions':{'sandbox':'danger-full-access','approval':'never','basis':'Effective host developer tool instructions'},
            'root_settings':'Inherited without overrides; concrete model/effort and native role loader metadata unexposed',
            'scope':'Only public guarded collision/fixed restoration/supplement reversal/original restoration and unique receipts; no children, runtime effect, publication or central edit',
            'assignment':{'path':str(p.ASSIGNMENT),'sha256':p.ASSIGNMENT_HASH},
            'source_revisions':{name:p.digest(Path(name).read_bytes()) for name in p.read(p.I/'activation.json')['source_revisions']},
            'current_ready':False,'actual_Git_publication_operations':[],'native_lifecycle':proof['actual_predecessor_native_terminal']}
p.save('activation.json',activation)
aliases={}
for label,job in [('fixed',p.I/'fixed-checkpoint'),('fix-xy-wiki',p.J/'recovery-supplements/fix-xy-wiki-1'),
                  ('first-wiki',p.J/'recovery-supplements/first-wiki-1'),('original',p.J)]:
    cp,manifest=p.load(job);alias=p.N/'public-controls'/label;alias.mkdir(parents=True)
    shutil.copytree(cp,alias/'recovery',copy_function=shutil.copy2)
    original=p.tree(cp);copied=p.tree(alias/'recovery')
    assert set(original)==set(copied)
    for name in original:
        assert {k:v for k,v in original[name].items() if k not in ('dev','ino')}=={k:v for k,v in copied[name].items() if k not in ('dev','ino')}
    p.load(alias)
    aliases[label]={'original_job':str(job),'control_job':str(alias),'manifest_sha256':p.digest((cp/'manifest.json').read_bytes()),
                    'owner':manifest['owner'],'owned_count':len(manifest['owned']),'all_archive_bytes_modes_times_equal':True,
                    'copy_records':copied,'original_archive_records':original}
p.save('public-control-copy-equality.json',aliases)
print(p.json.dumps({'entry_exact':True,'old_records_parsed':len(records),'raw_commands':len(commands),
                    'private_ports_absent':sorted(ports),'original_guard_untouched':True,
                    'aliases':{k:{x:v[x] for x in ['manifest_sha256','owned_count']} for k,v in aliases.items()}}))
