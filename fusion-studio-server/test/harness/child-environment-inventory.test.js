'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const EXPECTED = Object.freeze({
  'lib/harness/opencode/index.js': Object.freeze(['opencode', 'probe', 'probe']),
  'lib/harness/clis/base-cli-harness.js': Object.freeze(['probe', 'probe', 'probe', 'probe', 'this.id']),
  'lib/harness/clis/qwen/index.js': Object.freeze(['qwen']),
  'lib/harness/clis/codex/index.js': Object.freeze(['codex']),
  'lib/harness/clis/claude-code/index.js': Object.freeze(['claude-code']),
  'lib/harness/clis/gemini/index.js': Object.freeze(['gemini']),
  'lib/harness/kimi/index.js': Object.freeze(['kimi']),
  'lib/harness/bin-locator.js': Object.freeze(['locator', 'locator']),
  'lib/runner/wire-session.js': Object.freeze(['runner']),
});
const MOCK_ONLY = 'lib/harness/clis/codex/simulate-exchange.js';
const CHILD_SOURCES = new Set(['child_process', 'node:child_process']);
const MODULE_LOADER_SOURCES = new Set(['module', 'node:module']);
const DYNAMIC_CODE_SOURCES = new Set(['vm', 'node:vm']);
const LAUNCH_NAMES = new Set([
  'spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork',
]);

function walkFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walkFiles(absolute);
    return entry.isFile() && /\.(?:c?js|mjs)$/u.test(entry.name) ? [absolute] : [];
  });
}

function visit(node, parent, key, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node, parent, key);
  for (const [childKey, value] of Object.entries(node)) {
    if (childKey === 'loc' || childKey === 'start' || childKey === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, node, childKey, visitor);
    } else if (value && typeof value.type === 'string') {
      visit(value, node, childKey, visitor);
    }
  }
}

function isChildSource(node) {
  return node?.type === 'StringLiteral' && CHILD_SOURCES.has(node.value);
}

function isRequireCall(node, childOnly = false) {
  if (node?.type !== 'CallExpression'
    || node.callee?.type !== 'Identifier'
    || node.callee.name !== 'require'
    || node.arguments.length !== 1
    || node.arguments[0]?.type !== 'StringLiteral') return false;
  return !childOnly || CHILD_SOURCES.has(node.arguments[0].value);
}

function isDynamicImport(node) {
  if (node?.type === 'ImportExpression') return true;
  return node?.type === 'CallExpression'
    && node.callee?.type === 'Import'
    && node.arguments.length === 1;
}

function propertyName(node) {
  if (!node || node.computed) return null;
  if (node.key?.type === 'Identifier') return node.key.name;
  if (node.key?.type === 'StringLiteral') return node.key.value;
  return null;
}

function memberPropertyName(node) {
  if (node?.type !== 'MemberExpression' && node?.type !== 'OptionalMemberExpression') return null;
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  if (node.computed && node.property?.type === 'StringLiteral') return node.property.value;
  return null;
}

function staticString(node) {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw ?? null;
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return typeof left === 'string' && typeof right === 'string' ? left + right : null;
  }
  return null;
}

function forEachBindingIdentifier(pattern, callback) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    callback(pattern);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    forEachBindingIdentifier(pattern.left, callback);
    return;
  }
  if (pattern.type === 'RestElement') {
    forEachBindingIdentifier(pattern.argument, callback);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        forEachBindingIdentifier(property.argument, callback);
      } else if (property.type === 'ObjectProperty') {
        forEachBindingIdentifier(property.value, callback);
      }
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) forEachBindingIdentifier(element, callback);
    return;
  }
  if (pattern.type === 'TSParameterProperty') {
    forEachBindingIdentifier(pattern.parameter, callback);
  }
}

function builderFamily(call, builderBindings) {
  if (call?.type !== 'CallExpression'
    || call.callee?.type !== 'Identifier'
    || !builderBindings.has(call.callee.name)) return null;
  const family = call.arguments[0];
  if (family?.type === 'StringLiteral') return family.value;
  if (family?.type === 'MemberExpression'
    && !family.computed
    && family.object?.type === 'ThisExpression'
    && family.property?.type === 'Identifier'
    && family.property.name === 'id') return 'this.id';
  throw new Error('child environment family must be a literal or this.id');
}

function environmentFamily(call, builderBindings) {
  const optionObjects = call.arguments.filter((argument) => argument?.type === 'ObjectExpression');
  if (optionObjects.length !== 1) {
    throw new Error('child launch requires one unambiguous inline options object');
  }
  const [options] = optionObjects;
  if (options.properties.some((property) => (
    property.type !== 'ObjectProperty' || property.computed
  ))) {
    throw new Error('child launch options cannot spread, compute, or accessor-override env');
  }
  const envProperties = options.properties.filter((property) => (
    property.type === 'ObjectProperty' && propertyName(property) === 'env'
  ));
  if (envProperties.length !== 1) throw new Error('child launch requires exactly one env owner');

  const value = envProperties[0].value;
  const directFamily = builderFamily(value, builderBindings);
  if (directFamily) return directFamily;
  throw new Error('child env must be built directly by the central owner');
}

function inspectProductionSource(relative, source) {
  const ast = parse(source, { sourceType: 'unambiguous' });
  const declarations = new Map();
  const childRequireCalls = new Set();
  const approvedChildRequires = new Set();
  const launchBindings = new Map();
  const launchDeclarationIdentifiers = new Set();
  const builderBindings = new Map();
  const builderDeclarationIdentifiers = new Set();
  const childModuleBindings = new Set();
  const launchCalls = [];

  visit(ast.program, null, null, (node, parent) => {
    if (node.type === 'Identifier'
      && (node.name === 'Function' || node.name === 'eval' || node.name === 'Reflect'
        || node.name === 'getOwnPropertyDescriptor' || node.name === 'getPrototypeOf')) {
      throw new Error('dynamic code generation is forbidden in child launch inventory');
    }
    if (['constructor', 'getBuiltinModule'].includes(staticString(node))) {
      throw new Error('dynamic capability name is forbidden in child launch inventory');
    }
    if (node.type === 'Identifier'
      && (node.name === 'globalThis' || node.name === 'global')) {
      throw new Error('global capability access is forbidden in child launch inventory');
    }
    if (node.type === 'Identifier' && node.name === 'process'
      && !((parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression')
        && parent.object === node)
      && !((parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression')
        && parent.property === node && !parent.computed)
      && !(parent?.type === 'ObjectProperty' && parent.key === node && !parent.computed)) {
      throw new Error('process capability cannot be detached or passed through');
    }
    if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')
      && node.object?.type === 'Identifier'
      && node.object.name === 'require'
      && memberPropertyName(node) === 'main') {
      const exactEntrypointCheck = parent?.type === 'BinaryExpression'
        && (parent.operator === '===' || parent.operator === '!==')
        && ((parent.left === node && parent.right?.type === 'Identifier' && parent.right.name === 'module')
          || (parent.right === node && parent.left?.type === 'Identifier' && parent.left.name === 'module'));
      if (!exactEntrypointCheck) {
        throw new Error('require.main capability is restricted to an exact module identity check');
      }
    }
    if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')
      && memberPropertyName(node) === 'constructor') {
      const exactSubclassNameRead = node.object?.type === 'ThisExpression'
        && (parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression')
        && parent.object === node
        && memberPropertyName(parent) === 'name';
      if (!exactSubclassNameRead) {
        throw new Error('constructor capability access is forbidden in child launch inventory');
      }
    }
    if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')
      && node.object?.type === 'Identifier'
      && (node.object.name === 'globalThis' || node.object.name === 'global')
      && ((node.computed && node.property?.type === 'StringLiteral' && node.property.value === 'require')
        || (!node.computed && node.property?.type === 'Identifier' && node.property.name === 'require'))) {
      throw new Error('global require capability is forbidden in child launch inventory');
    }
    if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')
      && node.object?.type === 'Identifier'
      && node.object.name === 'module'
      && (node.computed
        || node.property?.type !== 'Identifier'
        || node.property.name !== 'exports')) {
      throw new Error('module loader capability is forbidden in child launch inventory');
    }
    if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')
      && node.object?.type === 'Identifier'
      && node.object.name === 'process'
      && (node.computed
        || ['mainModule', 'getBuiltinModule', 'binding', '_linkedBinding', 'dlopen', 'constructor']
          .includes(memberPropertyName(node)))) {
      throw new Error('dynamic process capability is forbidden in child launch inventory');
    }
    if (node.type === 'Identifier' && node.name === 'getBuiltinModule') {
      throw new Error('process.getBuiltinModule is forbidden in child launch inventory');
    }
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (declarator.id?.type === 'Identifier' && !declarations.has(declarator.id.name)) {
          declarations.set(declarator.id.name, { kind: node.kind, node: declarator });
        }
      }
    }
    if (node.type === 'CallExpression'
      && node.callee?.type === 'Identifier'
      && node.callee.name === 'require'
      && !isRequireCall(node)) {
      throw new Error('dynamic require calls are forbidden in child launch inventory');
    }
    if (isRequireCall(node)
      && (MODULE_LOADER_SOURCES.has(node.arguments[0].value)
        || DYNAMIC_CODE_SOURCES.has(node.arguments[0].value))) {
      throw new Error('Node module or dynamic-code loader imports are forbidden in child launch inventory');
    }
    if (node.type === 'CallExpression'
      && node.callee?.type === 'MemberExpression'
      && !node.callee.computed
      && node.callee.object?.type === 'Identifier'
      && node.callee.object.name === 'process'
      && node.callee.property?.type === 'Identifier'
      && node.callee.property.name === 'getBuiltinModule') {
      throw new Error('process.getBuiltinModule is forbidden in child launch inventory');
    }
    if (node.type === 'CallExpression' && isRequireCall(node, true)) childRequireCalls.add(node);
    if (isDynamicImport(node)) {
      throw new Error('dynamic imports are forbidden in child launch inventory');
    }
    if (node.type === 'ImportDeclaration' && isChildSource(node.source)) {
      throw new Error('ESM child-process imports must be inventoried explicitly before use');
    }
    if (node.type === 'ImportDeclaration'
      && node.source?.type === 'StringLiteral'
      && (MODULE_LOADER_SOURCES.has(node.source.value)
        || DYNAMIC_CODE_SOURCES.has(node.source.value))) {
      throw new Error('ESM module or dynamic-code loader imports are forbidden');
    }
  });

  visit(ast.program, null, null, (node, parent) => {
    if (node.type !== 'VariableDeclarator' || !isRequireCall(node.init)) return;
    const sourceValue = node.init.arguments[0].value;
    if (CHILD_SOURCES.has(sourceValue)) {
      if (node.id.type === 'Identifier') {
        childModuleBindings.add(node.id.name);
        approvedChildRequires.add(node.init);
        return;
      }
      if (node.id.type !== 'ObjectPattern' || node.id.properties.length !== 1) {
        throw new Error('child-process import must bind one exact launch method');
      }
      const property = node.id.properties[0];
      const name = propertyName(property);
      if (property.type !== 'ObjectProperty'
        || !LAUNCH_NAMES.has(name)
        || property.value?.type !== 'Identifier'
        || property.value.name !== name) {
        throw new Error('aliased child-process methods are forbidden');
      }
      if (launchBindings.has(name)) {
        throw new Error('child-process launch binding cannot be redeclared');
      }
      launchBindings.set(name, node);
      launchDeclarationIdentifiers.add(property.key);
      launchDeclarationIdentifiers.add(property.value);
      approvedChildRequires.add(node.init);
      return;
    }

    if (node.id.type === 'ObjectPattern'
      && /(?:^|\/)child-environment$/u.test(sourceValue)) {
      for (const property of node.id.properties) {
        if (propertyName(property) === 'buildHarnessChildEnvironment'
          && property.value?.type === 'Identifier') {
          if (parent?.type !== 'VariableDeclaration' || parent.kind !== 'const') {
            throw new Error('child environment builder binding must be immutable');
          }
          if (builderBindings.has(property.value.name)) {
            throw new Error('child environment builder binding cannot be redeclared');
          }
          builderBindings.set(property.value.name, property.value);
          builderDeclarationIdentifiers.add(property.key);
          builderDeclarationIdentifiers.add(property.value);
        }
      }
    }
  });

  if (relative === MOCK_ONLY) {
    if (childRequireCalls.size !== 1 || childModuleBindings.size !== 1) {
      throw new Error('mock-only spawn replacement changed shape');
    }
    let memberUses = 0;
    visit(ast.program, null, null, (node, parent, key) => {
      if (node.type === 'Identifier' && node.name === 'originalSpawn') {
        if (parent?.type === 'VariableDeclarator' && key === 'id') return;
        throw new Error('mock-only source cannot invoke or escape original spawn');
      }
      if (node.type !== 'MemberExpression'
        || node.object?.type !== 'Identifier'
        || !childModuleBindings.has(node.object.name)
        || !LAUNCH_NAMES.has(node.property?.name)) return;
      memberUses += 1;
      const captured = parent?.type === 'VariableDeclarator'
        && key === 'init'
        && parent.id?.type === 'Identifier'
        && parent.id.name === 'originalSpawn';
      const replaced = parent?.type === 'AssignmentExpression'
        && key === 'left'
        && parent.right?.type === 'Identifier'
        && parent.right.name === 'mockSpawn';
      if (!captured && !replaced) throw new Error('mock-only child-process use changed shape');
    });
    if (memberUses !== 2) throw new Error('mock-only spawn replacement changed inventory');
    return [];
  }

  if (childModuleBindings.size) throw new Error('child-process module references are forbidden');
  if (childRequireCalls.size !== approvedChildRequires.size) {
    throw new Error('detached child-process property access is forbidden');
  }

  const protectedBindingNames = new Set([
    ...launchBindings.keys(),
    ...builderBindings.keys(),
  ]);
  const approvedBindingIdentifiers = new Set([
    ...launchDeclarationIdentifiers,
    ...builderDeclarationIdentifiers,
  ]);
  const assertBindingPattern = (pattern) => {
    forEachBindingIdentifier(pattern, (identifier) => {
      if (protectedBindingNames.has(identifier.name)
        && !approvedBindingIdentifiers.has(identifier)) {
        throw new Error('child launch capability binding cannot be lexically shadowed');
      }
    });
  };
  visit(ast.program, null, null, (node) => {
    if (node.type === 'VariableDeclarator') assertBindingPattern(node.id);
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
      assertBindingPattern(node.id);
      for (const parameter of node.params) assertBindingPattern(parameter);
    }
    if (node.type === 'ArrowFunctionExpression') {
      for (const parameter of node.params) assertBindingPattern(parameter);
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      assertBindingPattern(node.id);
    }
    if (node.type === 'CatchClause') assertBindingPattern(node.param);
    if (node.type === 'ImportSpecifier'
      || node.type === 'ImportDefaultSpecifier'
      || node.type === 'ImportNamespaceSpecifier') {
      assertBindingPattern(node.local);
    }
  });

  visit(ast.program, null, null, (node, parent, key) => {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
      if (target?.type === 'Identifier' && declarations.has(target.name)) {
        const declaration = declarations.get(target.name);
        if (builderFamily(declaration.node.init, builderBindings)) {
          throw new Error('prebuilt child environment cannot be reassigned');
        }
      }
    }
    if (node.type === 'Identifier' && node.name === 'require') {
      const directCall = parent?.type === 'CallExpression' && parent.callee === node;
      const requireMain = parent?.type === 'MemberExpression'
        && parent.object === node
        && !parent.computed
        && parent.property?.type === 'Identifier'
        && parent.property.name === 'main';
      if (!directCall && !requireMain) {
        throw new Error('require capability cannot be detached or wrapped');
      }
    }
    if (node.type === 'CallExpression'
      && node.callee?.type === 'MemberExpression'
      && node.callee.object?.type === 'Identifier'
      && node.callee.object.name === 'module'
      && node.callee.property?.type === 'Identifier'
      && node.callee.property.name === 'require') {
      throw new Error('module.require is forbidden in child launch inventory');
    }
    if (node.type === 'Identifier' && builderBindings.has(node.name)) {
      if (builderDeclarationIdentifiers.has(node)) return;
      if (parent?.type === 'CallExpression' && parent.callee === node) return;
      throw new Error('child environment builder capability escaped its immutable binding');
    }
    if (node.type !== 'Identifier' || !launchBindings.has(node.name)) return;
    if (launchDeclarationIdentifiers.has(node)) return;
    if (parent?.type === 'CallExpression' && parent.callee === node) {
      launchCalls.push(parent);
      return;
    }
    throw new Error('child-process launch capability escaped its direct binding');
  });

  return launchCalls.map((call) => environmentFamily(call, builderBindings));
}

test('every production harness/CLI launch has an AST-verified central environment owner', () => {
  const roots = [path.join(SERVER_ROOT, 'lib/harness'), path.join(SERVER_ROOT, 'lib/runner')];
  const discovered = {};
  for (const absolute of roots.flatMap(walkFiles)) {
    const relative = path.relative(SERVER_ROOT, absolute);
    const families = inspectProductionSource(relative, fs.readFileSync(absolute, 'utf8'));
    if (families.length) discovered[relative] = families;
  }
  expect(discovered).toEqual(EXPECTED);
});

test.each([
  "const {spawn}=require('child_process'); const run=spawn; run('x',[],{env:process.env});",
  "const cp=require('node:child_process'); const run=cp.spawn; run('x',[],{env:process.env});",
  "const run=require('child_process').spawn; run('x',[],{env:process.env});",
  "const {spawn:run}=require('child_process'); run('x',[],{env:process.env});",
  "import {spawn as run} from 'node:child_process'; run('x',[],{env:process.env});",
  "const {spawn}=require('child_process'); const wrap=(fn)=>fn; const run=wrap(spawn); run('x');",
  "const {spawn}=require('child_process'); const run=(...args)=>spawn(...args); run('x',[],{env:process.env});",
  "const {spawn}=require('child_process'); const box={spawn}; box.spawn('x',[],{env:process.env});",
  "const {spawn}=require('child_process'); spawn('x',[],{env:process.env}); buildHarnessChildEnvironment('probe');",
  "const {spawn}=require('child_process'); spawn('x',[],{env:buildHarnessChildEnvironment('probe'),...{env:process.env}});",
  "const {spawn}=require('child_process'); spawn('x',[],{env:buildHarnessChildEnvironment('probe'),['env']:process.env});",
  "const cp=await import('node:child_process'); cp.spawn('x',[],{env:process.env});",
  "const moduleName='node:child_process'; const cp=await import(moduleName); cp.spawn('x',[],{env:process.env});",
  "const moduleName='child_process'; const {spawn}=require(moduleName); spawn('x',[],{env:process.env});",
  "const load=require; const {spawn}=load('child_process'); spawn('x',[],{env:process.env});",
  "let {buildHarnessChildEnvironment}=require('./child-environment'); buildHarnessChildEnvironment=()=>process.env; const {spawn}=require('child_process'); spawn('x',[],{env:buildHarnessChildEnvironment('probe')});",
  "const {buildHarnessChildEnvironment}=require('./child-environment'); const childEnv=buildHarnessChildEnvironment('probe'); const {spawn}=require('child_process'); function run(childEnv){spawn('x',[],{env:childEnv});} run(process.env);",
  "const {buildHarnessChildEnvironment}=require('./child-environment'); const {spawn}=require('child_process'); function run(buildHarnessChildEnvironment){spawn('x',[],{env:buildHarnessChildEnvironment('probe')});} run(()=>process.env);",
  "const {buildHarnessChildEnvironment}=require('./child-environment'); const {spawn}=require('child_process'); function run(spawn){spawn('x',[],{env:buildHarnessChildEnvironment('probe')});} run(()=>{});",
  "process.getBuiltinModule('node:child_process').spawn('x',[],{env:process.env});",
  "process['getBuiltinModule']('child_process').spawn('x',[],{env:process.env});",
  "process[`getBuiltinModule`]('node:child_process').spawn('x',[],{env:process.env});",
  "process['get' + 'BuiltinModule']('node:child_process').spawn('x',[],{env:process.env});",
  "const {getBuiltinModule}=process; const cp=getBuiltinModule('node:child_process'); cp.spawn('x',[],{env:process.env});",
  "globalThis['require']('child_process')['spawn']('x',[],{env:process.env});",
  "global.require('node:child_process').exec('x',{env:process.env});",
  "const load=globalThis[`require`]; load('child_process').spawn('x',[],{env:process.env});",
  "const host=globalThis; host.require('child_process').spawn('x',[],{env:process.env});",
  "Reflect.get(globalThis,'require')('child_process').spawn('x',[],{env:process.env});",
  "Function('return this')()['require']('child_process').spawn('x',[],{env:process.env});",
  "Reflect['get'](Function('return this')(), 'require')('child_process').spawn('x',[],{env:process.env});",
  "Reflect.get(()=>{}, 'constructor')('return this')().require('child_process').spawn('x',[],{env:process.env});",
  "Object.getOwnPropertyDescriptor(()=>{}, 'constructor').value('return this')().require('child_process').spawn('x',[],{env:process.env});",
  "require('node:vm').runInThisContext('require(\\'child_process\\').spawn(\\'x\\')');",
  "import vm from 'node:vm'; vm.runInThisContext('process.getBuiltinModule(\\'child_process\\').spawn(\\'x\\')');",
  "module['require']('child_process').spawn('x',[],{env:process.env});",
  "process.mainModule.require('child_process').spawn('x',[],{env:process.env});",
  "require.main.require('child_process').spawn('x',[],{env:process.env});",
  "require['main']['require']('child_process').spawn('x',[],{env:process.env});",
  "process.binding('spawn_sync').spawn({envPairs:['FORBIDDEN=value']});",
  "process._linkedBinding('spawn_sync').spawn({envPairs:['FORBIDDEN=value']});",
  "const host=process; host.getBuiltinModule('child_process').spawn('x',[],{env:process.env});",
  "Reflect.get(process,'getBuiltinModule')('child_process').spawn('x',[],{env:process.env});",
  "Object.getOwnPropertyDescriptor(process,'getBuiltinModule').value('child_process').spawn('x',[],{env:process.env});",
  "const host={process}; host.process.getBuiltinModule('child_process').spawn('x',[],{env:process.env});",
  "[].filter.constructor('return this')().require('child_process').spawn('x',[],{env:process.env});",
  "require('node:module').createRequire(__filename)('child_process').spawn('x',[],{env:process.env});",
])('inventory fails closed for alias, wrapper, ESM, or environment bypass: %s', (source) => {
  expect(() => inspectProductionSource('lib/harness/adversarial.js', source)).toThrow();
});
