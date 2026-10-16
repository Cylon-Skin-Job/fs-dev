"""Validate the finite, versioned authored Launchpad shapes."""
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from functools import lru_cache

SCHEMAS = Path(__file__).resolve().parents[2] / 'assets' / 'schema'


class ContractError(Exception):
    def __init__(self, code, message, actual=None, commit_state='nonmutation'):
        self.code, self.message, self.actual = code, message, actual or {}
        self.commit_state=commit_state
        self.changed_fields=[]
        self.affected_uuids=list(self.actual)
        self.event_refs=[]
        super().__init__(message)


def fail(message, code='INVALID_SCHEMA'):
    raise ContractError(code, message)


@lru_cache(maxsize=None)
def schema(name):
    return json.loads((SCHEMAS / name).read_text())


def validate(value, shape, document=None, path='$'):
    document = document or shape
    if '$ref' in shape:
        name, _, pointer = shape['$ref'].partition('#')
        target = schema(name) if name else document
        owner = target
        for key in pointer.strip('/').split('/') if pointer else []:
            target = target[key]
        return validate(value, target, owner, path)
    types = {'object': dict, 'array': list, 'string': str, 'integer': int,
             'number': (int, float), 'boolean': bool, 'null': type(None)}
    expected = shape.get('type')
    if expected:
        expected = [expected] if isinstance(expected, str) else expected
        if not any(isinstance(value, types[t]) and not
                   (t in ('integer', 'number') and isinstance(value, bool)) for t in expected):
            fail(path + ': wrong type')
    if 'const' in shape and (value != shape['const'] or type(value) != type(shape['const'])):
        fail(path + ': wrong constant')
    if 'enum' in shape and value not in shape['enum']:
        fail(path + ': invalid enum')
    for key in ('anyOf', 'oneOf'):
        if key in shape:
            count = 0
            for option in shape[key]:
                try:
                    validate(value, option, document, path)
                    count += 1
                except ContractError:
                    pass
            if not count or key == 'oneOf' and count != 1:
                fail(path + ': invalid union')
    for option in shape.get('allOf', []):
        validate(value, option, document, path)
    if 'if' in shape:
        try:
            validate(value, shape['if'], document, path)
            branch = 'then'
        except ContractError:
            branch = 'else'
        validate(value, shape.get(branch, {}), document, path)
    if isinstance(value, dict):
        if set(shape.get('required', [])) - value.keys():
            fail(path + ': missing required fields')
        props = shape.get('properties', {})
        for key, item in value.items():
            if 'propertyNames' in shape:
                validate(key, shape['propertyNames'], document, path)
            if key in props:
                validate(item, props[key], document, path + '.' + key)
            elif shape.get('additionalProperties') is False:
                fail(path + ': unknown field ' + key)
            elif isinstance(shape.get('additionalProperties'), dict):
                validate(item, shape['additionalProperties'], document, path + '.' + key)
    if isinstance(value, list):
        if len(value) < shape.get('minItems', 0) or len(value) > shape.get('maxItems', float('inf')):
            fail(path + ': array length')
        if shape.get('uniqueItems') and len({json.dumps(x, sort_keys=True) for x in value}) != len(value):
            fail(path + ': duplicate items')
        for index, item in enumerate(value):
            validate(item, shape.get('items', {}), document, path + '[' + str(index) + ']')
    if isinstance(value, str):
        if len(value) < shape.get('minLength', 0):
            fail(path + ': empty text')
        if 'pattern' in shape and not re.search(shape['pattern'], value):
            fail(path + ': invalid pattern')
        try:
            if shape.get('format') == 'uuid' and str(uuid.UUID(value)) != value:
                fail(path + ': noncanonical UUID')
            if shape.get('format') == 'date-time':
                stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    fail(path + ': timezone required')
        except ValueError:
            fail(path + ': invalid format')
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < shape.get('minimum', -float('inf')) or value > shape.get('maximum', float('inf')):
            fail(path + ': outside bounds')


def named(value, name):
    validate(value, schema(name))


def record(value):
    named(value, 'record.schema.json')
    namespaces=schema('extensions.json')['namespaces']
    if set(value['extensions'])-set(namespaces):fail('Unknown extension namespace; retain original failed-preview input')
    for key,extension in value['extensions'].items():validate(extension,namespaces[key]['schema'])
    evidence=value['lifecycle_evidence']
    if value['lifecycle']!='live' or any(evidence.values()):
        if value['kind']!='content' or not all(evidence.values()):fail('Lifecycle requires content and complete evidence')


def snapshot(value, check_lifecycle=True):
    named(value, 'snapshot.schema.json')
    revisions = {}
    for item in value['revisions']:
        record(item)
        if item['revision_uuid'] in revisions:
            fail('Duplicate revision identity')
        revisions[item['revision_uuid']] = item
    for item in value['revisions'] if check_lifecycle else []:
        proof=item['lifecycle_evidence']
        if not proof['previous_live_revision_uuid']:continue
        prior=revisions.get(proof['previous_live_revision_uuid'])
        if not prior:fail('Retained lifecycle predecessor missing','MISSING_EVIDENCE')
        if prior['uuid']!=item['uuid'] or prior['kind']!=item['kind'] or prior['lifecycle']!='live' or prior['revision_uuid']==item['revision_uuid'] or any(prior[k]!=item[k] for k in ('body','extensions','created_at')) or any(x not in item['source_refs'] for x in prior['source_refs']):
            fail('Invalid retained lifecycle predecessor')
    seen = set()
    for binding in value['current']:
        entry = binding['entry_uuid']
        item = revisions.get(binding['revision_uuid'])
        if entry in seen or not item or item['uuid'] != entry:
            fail('Duplicate or dangling current identity')
        seen.add(entry)
    roots = [x for x in current(value) if x['uuid'] == value['root_uuid']]
    if len(roots) != 1 or roots[0]['kind'] != value['entity_kind']:
        fail('Invalid snapshot root owner')


def current(value):
    revisions = {x['revision_uuid']: x for x in value['revisions']}
    return [revisions[x['revision_uuid']] for x in value['current']]
