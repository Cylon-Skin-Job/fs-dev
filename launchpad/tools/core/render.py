"""Embed one captured immutable generation into portable static viewers."""
import html
import json
import re
from pathlib import Path
from .store import digest, registry, routing_destination
from .schema import current
from . import sources, coverage, decisions, discussions, journal, state_check, support, attempts, acceptance, workflow, prompts, integration, dependencies

ASSETS=Path(__file__).resolve().parents[2]/'assets'


def render_registry(rows):
    """Latest header-only navigation, independent of immutable business snapshots."""
    links=''.join('<li><a href="'+html.escape(row['current_home']+'/plan.HTML',quote=True)+'">'+html.escape(row['title'])+'</a></li>' for row in rows)
    return ('<!doctype html><html lang="en"><meta charset="utf-8"><title>Named plans</title>'
            '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="rv-root">'
            '<header class="rv-header"><h1>Latest named plans</h1></header><main class="rv-body">'
            '<p>Registered plan headers. Select a plan to open its current snapshot. Manual refresh updates this list.</p><ul>'+links+
            '</ul></main></div><script>'+(ASSETS/'view.styles.js').read_text()+'</script></html>')


def safe_json(value):
    # Script-data parsing never receives a literal HTML close tag.
    return json.dumps(value,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026').replace('\u2028','\\u2028').replace('\u2029','\\u2029')


def render(root, plan, tickets):
    chooser=routing_destination(root)
    root_record=next(x for x in current(plan) if x['kind']=='plan')
    model=dict(framework_uuid=plan['root_uuid'],plan_uuid=plan['root_uuid'],generation=plan['root_revision_uuid'],
               plan_sha256=digest(plan),commit_seq=plan['commit_seq'],render_version='launchpad-view/1',
               plan=root_record,records=current(plan),tickets=tickets,
               plans=registry(root)+([] if any(x['uuid']==plan['root_uuid'] for x in registry(root)) else
                    [dict(uuid=plan['root_uuid'],title=root_record['body']['title'],current_home=root_record['body']['current_home'])]))
    model['source_disclosures']=sources.projection(root,plan,tickets)
    model['coverage_disclosures']={key:coverage.ledger(root,plan,tickets,current(value)) for key,value in tickets.items()}
    model['approval_disclosures']={key:decisions.projection(current(value),value['revisions']) for key,value in tickets.items()}
    model['gate_disclosures']={key:acceptance.gates_projection(current(value)) for key,value in tickets.items()}
    model['run_disclosures']={key:attempts.projection(root,plan,tickets,current(value)) for key,value in tickets.items()}
    model['workflow_disclosures']={key:workflow.projection(current(value)) for key,value in tickets.items()}
    model['finalization_disclosures']=integration.finalization_projection(root,plan,tickets)
    model['layout_disclosures']=dependencies.layout(plan,tickets)
    model['prompt_disclosures']=prompts.projection(root,plan,tickets)
    model['discussion_disclosures']={}
    for key,value in tickets.items():
        items=current(value);target=next(x for x in items if x['kind']=='ticket')
        landscape=discussions.projection(items,target['body']['current_workflow_node_uuid'])
        landscape['logs']={x['uuid']:{**journal.readout(x,items,current(plan)),
            'state_observations':state_check.projection(root,plan,tickets,x['body']['actor_uuid'],key),
            'support_reports':support.projection(root,plan,tickets,x['body']['actor_uuid'])} for x in items if x['kind']=='discussion'}
        model['discussion_disclosures'][key]=landscape
    model['latest_plans_url']=chooser.absolute().as_uri()
    model['plans']=[{**header,'current_entry_url':(Path(root)/header['current_home']/'plan.HTML').absolute().as_uri()} for header in model['plans']]
    scripts='\n'.join((ASSETS/f).read_text() for f in ['model.js','layout.js','card.js','tree.js','modal.js','view-state.js','view-host.js'])
    styles=(ASSETS/'view.styles.js').read_text()
    template=(ASSETS/'templates/view.html').read_text()
    def page(ticket_id=None):
        data={**model,'view_kind':'ticket' if ticket_id else 'plan','ticket_uuid':ticket_id}
        values={'TITLE':html.escape(root_record['body']['title']),'MODEL':safe_json(data),'SCRIPTS':styles+'\n'+scripts}
        return re.sub(r'\{\{(TITLE|MODEL|SCRIPTS)\}\}',lambda match:values[match[1]],template)
    pages={'plan.HTML':page()}
    pages.update({f'tickets/{key}.html':page(key) for key in tickets})
    return pages
