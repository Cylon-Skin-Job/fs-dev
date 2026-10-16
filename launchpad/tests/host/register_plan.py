"""Provision a separately scoped second plan through the public subprocess."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture

fx=Fixture(sys.argv[1],'second')
code,result=fx.create('Second named plan')
evidence={'exit':code,'response':result,'plan_uuid':fx.plan_id,'home':str(fx.home)}
(fx.root/'registration-public-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence))
if code:raise SystemExit(code)
