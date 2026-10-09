"""Complete one successful suite invocation after output-format assertion correction."""
import importlib.util,json,re,hashlib
from pathlib import Path
E=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('original_final_runner',E/'SPEC-final-suite-runner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
node=json.loads((m.OUT/'node-command.json').read_text());pre=json.loads((m.OUT/'node-pre.json').read_text())
assert node['exit_code']==0 and node['stderr']==''
for label,value in [('tests',17),('pass',17),('fail',0),('cancelled',0),('skipped',0),('todo',0)]:
 assert re.search(r'^(?:ℹ|#)\s+'+label+r'\s+'+str(value)+r'\s*$',node['stdout'],re.M),(label,value)
assert len(re.findall(r'^✔ ',node['stdout'],re.M))==17
after={p:m.fp(p)for p in pre['dependencies']};assert after==pre['dependencies']
m.save('node-post.json',{'at':m.now(),'dependencies':after,'all_equal':True,'pass':17,'fail':0,'skipped':0,'cancelled':0,'command':m.fp(m.OUT/'node-command.json'),'pre':m.fp(m.OUT/'node-pre.json'),'fixture_receipts':{str(p):m.fp(p)for p in sorted((m.OUT/'node-fixtures').glob('*.json'))},'format':'Actual Node default spec reporter; all17 named passes and summary independently checked','post_interval_limit':'Original runner immediately compared post/pre equal before its TAP-only summary assertion. This saved current comparison is later; unchanged selected source/executables/runner confirm the same dependency state. No historical raw immediate post object reconstructed.'})
m.save('runner-assertion-failure.json',{'observed_native_exit':1,'failed_location':'SPEC-final-suite-runner.py main line112','# pass 17 assumption':'Actual stdout uses ℹ pass 17; actual command exit0/all17passed/fail0/skip0/cancel0','native_trace':'AssertionError at assert # pass 17 in n[stdout] and # fail 0 in n[stdout]','original_runner':m.fp(E/'SPEC-final-suite-runner.py'),'continuation':m.fp(__file__),'correction':'Read and validate saved actual receipt in native format; save current exact post binding and perform only previously unexecuted syntax/dry-run commands; no passing suite replay','no_product_byte_changes':True})
sources=['restart-fusion.sh','scripts/fusion-restart.mjs','scripts/fusion-restart-target.mjs','scripts/fusion-restart-processes.mjs','scripts/fusion-restart-probe.mjs']
m.run('bash-syntax-command.json',['bash','-n',str(m.R/'restart-fusion.sh')])
for i,leaf in enumerate(sources[1:]):m.run(f'node-source-syntax-{i}.json',[node['argv'][0],'--check',str(m.R/leaf)])
for i,p in enumerate(sorted((m.K/'tests').glob('*.mjs'))):m.run(f'node-helper-syntax-{i}.json',[node['argv'][0],'--check',str(p)])
m.run('default-dry-run-command.json',['bash',str(m.R/'restart-fusion.sh'),'--dry-run'],cwd=m.R)
p=json.loads((m.OUT/'python-verification.json').read_text());m.save('result.json',{'at':m.now(),'result':'FINAL_SUITES_PASSED_WITH_RETAINED_REPORT_FORMAT_CORRECTION','python':55,'node':17,'python_dependencies':p['dependency_count'],'executed_js_bound':len(p['executed_js_files']),'original_suites_replayed':False,'original_runner_failure':'runner-assertion-failure.json','continuation':m.fp(__file__)})
print(json.dumps({'result':'FINAL_SUITES_PASSED','python':55,'node':17,'python_dependencies':p['dependency_count'],'executed_js_bound':len(p['executed_js_files']),'passing_suites_replayed':False}))
