import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  INVALID_TABLE_PRESENTATION,
  buildLegacyEmailDocumentPayload,
  buildLegacyExportDocumentPayload,
  buildLegacyPrintDocumentPayload,
  buildOfficeEmailAttachmentPayload,
  buildOfficeExportDocumentPayload,
  buildOfficePrintDocumentPayload,
} from '../src/lib/documentOutputPayloads';
import {
  projectOfficeTableOutputDescriptor,
  serializeOfficeOutputSnapshot,
  type OfficeTableOutputDescriptor,
} from '../src/components/office/officeTableOutputDescriptor';
import { DEFAULT_SETTINGS, parseDocumentSettings } from '../src/lib/front-matter';
import { PRESENTATION_OUTPUT_CANONICAL } from './office/fixture-scenarios.mjs';

const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const sha256Hex = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function emptyDescriptor(): OfficeTableOutputDescriptor {
  return { markdownSha256: EMPTY_SHA, tables: [] };
}

test('[slice 11.1] legacy and dormant Office payload builders emit closed own-key snapshots', () => {
  const legacyExport = buildLegacyExportDocumentPayload({
    sourceType: 'document', sourceFormat: 'markdown', format: 'pdf', content: 'body', filename: 'name',
  });
  const legacyPrint = buildLegacyPrintDocumentPayload({ content: 'body', filename: 'name' });
  const legacyEmail = buildLegacyEmailDocumentPayload({ format: 'markdown', content: 'full', filename: 'name' });
  expect(legacyExport).toEqual({
    sourceType: 'document', sourceFormat: 'markdown', format: 'pdf', content: 'body', filename: 'name',
  });
  expect(legacyPrint).toEqual({ content: 'body', filename: 'name' });
  expect(legacyEmail).toEqual({ format: 'markdown', content: 'full', filename: 'name' });
  for (const format of ['docx', 'pdf'] as const) {
    expect(buildLegacyExportDocumentPayload({
      sourceType: 'document', sourceFormat: 'markdown', format, content: 'body', filename: 'name',
    })).toEqual({
      sourceType: 'document', sourceFormat: 'markdown', format, content: 'body', filename: 'name',
    });
    expect(buildLegacyEmailDocumentPayload({ format, content: 'body', filename: 'name' })).toEqual({
      format, content: 'body', filename: 'name',
    });
  }
  expect(buildLegacyExportDocumentPayload({
    sourceType: 'html-artifact', sourceFormat: 'html', format: 'pdf', content: '<p>x</p>', filename: 'html',
  })).toEqual({
    sourceType: 'html-artifact', sourceFormat: 'html', format: 'pdf', content: '<p>x</p>', filename: 'html',
  });
  expect(buildLegacyExportDocumentPayload({
    sourceType: 'spreadsheet', sourceFormat: 'csv', format: 'pdf', content: 'a,b', filename: 'sheet',
  })).toEqual({
    sourceType: 'spreadsheet', sourceFormat: 'csv', format: 'pdf', content: 'a,b', filename: 'sheet',
  });

  const pair = { presentationMode: 'office-tables' as const, tablePresentation: emptyDescriptor() };
  for (const format of ['docx', 'pdf'] as const) {
    expect(buildOfficeExportDocumentPayload({
      sourceType: 'document', sourceFormat: 'markdown', format, content: '', filename: 'name', ...pair,
    })).toEqual({
      sourceType: 'document', sourceFormat: 'markdown', format, content: '', filename: 'name', ...pair,
    });
  }
  expect(buildOfficePrintDocumentPayload({ content: '', filename: 'name', ...pair })).toEqual({
    content: '', filename: 'name', ...pair,
  });
  expect(buildOfficeEmailAttachmentPayload({ format: 'pdf', content: '', filename: 'name', ...pair })).toEqual({
    format: 'pdf', content: '', filename: 'name', ...pair,
  });
  expect(buildOfficeEmailAttachmentPayload({ format: 'docx', content: '', filename: 'name', ...pair })).toEqual({
    format: 'docx', content: '', filename: 'name', ...pair,
  });
});

test('[slice 11.1] renderer source validation rejects provenance and JSON-shape violations without coercion', () => {
  const makePayload = () => ({
    sourceType: 'document' as const,
    sourceFormat: 'markdown' as const,
    format: 'pdf' as const,
    content: '',
    filename: 'name',
    presentationMode: 'office-tables' as const,
    tablePresentation: emptyDescriptor(),
  });
  let getterCalls = 0;
  const accessor = makePayload();
  Object.defineProperty(accessor, 'filename', {
    enumerable: true,
    get() { getterCalls += 1; return 'name'; },
  });
  const inherited = Object.assign(Object.create({ inherited: true }), makePayload());
  class Descriptor { markdownSha256 = EMPTY_SHA; tables: unknown[] = []; }
  const classValue = { ...makePayload(), tablePresentation: new Descriptor() as OfficeTableOutputDescriptor };
  const symbolKey = makePayload() as ReturnType<typeof makePayload> & { [key: symbol]: boolean };
  symbolKey[Symbol('hidden')] = true;
  const symbolValue = { ...makePayload(), filename: Symbol('bad') as unknown as string };
  const functionValue = { ...makePayload(), filename: (() => 'bad') as unknown as string };
  const sparse = makePayload();
  sparse.tablePresentation.tables = new Array(1) as OfficeTableOutputDescriptor['tables'];
  const nonfinite = makePayload();
  nonfinite.tablePresentation.tables = [{
    tableIndex: 0,
    sourceSha256: EMPTY_SHA,
    logicalWidth: Number.POSITIVE_INFINITY,
    columns: null,
    overflow: 'overflow',
    titleRow: false,
    borderWidth: 1,
    borderColor: 'default',
  }];
  const coercedRootHash = makePayload();
  coercedRootHash.tablePresentation.markdownSha256 = [EMPTY_SHA] as unknown as string;
  const coercedSourceHash = makePayload();
  coercedSourceHash.tablePresentation.tables = [{
    tableIndex: 0,
    sourceSha256: [EMPTY_SHA] as unknown as string,
    logicalWidth: 1,
    columns: [1],
    overflow: 'overflow',
    titleRow: false,
    borderWidth: 1,
    borderColor: 'default',
  }];
  const coercedColor = makePayload();
  coercedColor.tablePresentation.tables = [{
    tableIndex: 0,
    sourceSha256: EMPTY_SHA,
    logicalWidth: 1,
    columns: [1],
    overflow: 'overflow',
    titleRow: false,
    borderWidth: 1,
    borderColor: ['#abcdef'] as unknown as `#${string}`,
  }];
  for (const value of [
    accessor,
    inherited,
    classValue,
    symbolKey,
    symbolValue,
    functionValue,
    sparse,
    nonfinite,
    coercedRootHash,
    coercedSourceHash,
    coercedColor,
  ]) {
    expect(() => buildOfficeExportDocumentPayload(value)).toThrow('INVALID_TABLE_PRESENTATION');
  }
  expect(getterCalls).toBe(0);
});

test('[slice 11.1] renderer Office construction maps Proxy and clone failures before exposed API calls', () => {
  const makePayload = () => ({
    sourceType: 'document' as const,
    sourceFormat: 'markdown' as const,
    format: 'pdf' as const,
    content: '',
    filename: 'name',
    presentationMode: 'office-tables' as const,
    tablePresentation: emptyDescriptor(),
  });
  const cases = [
    {
      name: 'transparent Proxy rejected by structuredClone',
      value: new Proxy(makePayload(), {}),
    },
    {
      name: 'throwing ownKeys trap',
      value: new Proxy(makePayload(), {
        ownKeys() { throw new Error('attacker-controlled ownKeys'); },
      }),
    },
    {
      name: 'throwing getOwnPropertyDescriptor trap',
      value: new Proxy(makePayload(), {
        getOwnPropertyDescriptor() { throw new Error('attacker-controlled descriptor'); },
      }),
    },
    {
      name: 'throwing getPrototypeOf trap',
      value: new Proxy(makePayload(), {
        getPrototypeOf() { throw new Error('attacker-controlled prototype'); },
      }),
    },
    {
      name: 'throwing get trap',
      value: new Proxy(makePayload(), {
        get(target, property, receiver) {
          if (property === 'presentationMode') throw new Error('attacker-controlled get');
          return Reflect.get(target, property, receiver);
        },
      }),
    },
  ];
  const failures = new Set<Error>();
  let exposedCalls = 0;
  for (const { name, value } of cases) {
    let failure: unknown;
    try {
      const payload = buildOfficeExportDocumentPayload(value);
      exposedCalls += 1;
      void payload;
    } catch (error) {
      failure = error;
    }
    expect(failure, name).toBeInstanceOf(Error);
    expect((failure as Error).name, name).toBe('Error');
    expect((failure as Error).message, name).toBe(INVALID_TABLE_PRESENTATION);
    expect(Object.hasOwn(failure as object, 'code'), name).toBe(false);
    failures.add(failure as Error);
    expect(exposedCalls, name).toBe(0);
  }
  expect(failures.size).toBe(cases.length);
});

test('[slice 11.1] invalid fractional, partial, zero, nonfinite, and unsafe layouts project null', async () => {
  const body = '| A | B |\n| --- | --- |\n| one | two |';
  for (const columns of [
    [80.5, 99.25],
    [80],
    [0, 99],
    [Number.POSITIVE_INFINITY, 99],
    [Number.MAX_SAFE_INTEGER + 1, 99],
  ]) {
    const descriptor = await projectOfficeTableOutputDescriptor(body, {
      metadata: { tables: [{ tableIndex: 0, columns }] },
    }, sha256Hex);
    expect(descriptor.tables[0].columns).toBeNull();
  }
});

test('[slice 11.1] a marked two-row title surrogate projects stale and fail-closed', async () => {
  const body = [
    '| Two Row Marked Title |  |  |',
    '| --- | --- | --- |',
    '| only-r1c0 | only-r1c1 | only-r1c2 |',
  ].join('\n');
  const descriptor = await projectOfficeTableOutputDescriptor(body, {
    metadata: { tableStyles: [{ tableIndex: 0, titleRow: true }] },
  }, sha256Hex);
  expect(descriptor.tables[0]).toMatchObject({ logicalWidth: 3, titleRow: false });
});

test('[slice 11.1] immutable snapshot binds one captured body and normalized presentation state', async () => {
  const bodyMarkdown = [
    '| Quarterly Results |  |  |',
    '| :--- | :---: | ---: |',
    '| Name | Q1 | Q2 |',
    '| Alpha | 10 | 20 |',
  ].join('\n');
  const state = {
    bodyMarkdown,
    settings: structuredClone(DEFAULT_SETTINGS),
    frontmatter: {
      name: 'Snapshot',
      metadata: {
        tables: [{ tableIndex: 0, fingerprint: 'fixture-snapshot', columns: [96, 120, 144] }],
        tableStyles: [{
          tableIndex: 0,
          fingerprint: 'fixture-snapshot',
          titleRow: true,
          tableOverflow: 'newline',
          borderWidth: 4,
          borderColor: '#004E89',
        }],
      },
    },
  };
  let captures = 0;
  const pending = serializeOfficeOutputSnapshot(() => {
    captures += 1;
    return state;
  }, sha256Hex);
  state.bodyMarkdown = 'later body';
  state.frontmatter.metadata.tables[0].columns[0] = 999;
  const snapshot = await pending;
  expect(captures).toBe(1);
  expect(snapshot.bodyMarkdown).toBe(bodyMarkdown);
  expect(snapshot.tablePresentation.tables).toEqual([{
    tableIndex: 0,
    sourceSha256: createHash('sha256').update(bodyMarkdown).digest('hex'),
    logicalWidth: 3,
    columns: [96, 120, 144],
    overflow: 'newline',
    titleRow: true,
    borderWidth: 4,
    borderColor: '#004e89',
  }]);
  expect(snapshot.fullMarkdown).toContain('titleRow: true');
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.tablePresentation.tables)).toBe(true);
});

test('[slice 11.1] presentation fixture projects the closed 50-entry non-hash descriptor matrix', async () => {
  const parsed = parseDocumentSettings(PRESENTATION_OUTPUT_CANONICAL);
  const descriptor = await projectOfficeTableOutputDescriptor(parsed.body, parsed.frontmatter, sha256Hex);
  expect(descriptor.tables).toHaveLength(50);
  const colors: Record<number, `#${string}`> = {
    1: '#e11d48', 2: '#16a34a', 3: '#2563eb', 4: '#9333ea',
  };
  let index = 0;
  for (const titleKind of ['ordinary', 'title'] as const) {
    for (const borderKind of ['real', 'none'] as const) {
      for (const width of [1, 2, 3, 4] as const) {
        for (const mode of ['overflow', 'truncate', 'newline'] as const) {
          expect(descriptor.tables[index]).toMatchObject({
            tableIndex: index,
            logicalWidth: 3,
            columns: [96, 96, 96],
            overflow: mode,
            titleRow: titleKind === 'title',
            borderWidth: width,
            borderColor: borderKind === 'real' ? colors[width] : null,
          });
          index += 1;
        }
      }
    }
  }
  expect(descriptor.tables[48]).toMatchObject({
    tableIndex: 48,
    logicalWidth: 3,
    columns: null,
    overflow: 'overflow',
    titleRow: false,
    borderWidth: 1,
    borderColor: 'default',
  });
  expect(descriptor.tables[49]).toMatchObject({
    tableIndex: 49,
    logicalWidth: 3,
    columns: [96, 96, 96],
    overflow: 'truncate',
    titleRow: false,
    borderWidth: 4,
    borderColor: '#004e89',
  });
});

test('[slice 11.4] active Office requires the mode pair while Email editor remains legacy-only', () => {
  const clientRoot = path.resolve(process.cwd());
  const officeSource = fs.readFileSync(
    path.join(clientRoot, 'src/components/office/useDocumentActions.ts'), 'utf8',
  );
  expect(officeSource).toContain('serializeOfficeOutputSnapshot');
  expect(officeSource).toContain('buildOfficeExportDocumentPayload');
  expect(officeSource).toContain('buildOfficePrintDocumentPayload');
  expect(officeSource).toContain('buildOfficeEmailAttachmentPayload');
  expect(officeSource).toContain("presentationMode: 'office-tables'");
  expect(officeSource).toContain('content: snapshot.fullMarkdown');
  expect(officeSource).not.toContain('buildLegacyExportDocumentPayload');
  expect(officeSource).not.toContain('buildLegacyPrintDocumentPayload');

  const emailSource = fs.readFileSync(
    path.join(clientRoot, 'src/components/email/useDocumentActions.ts'), 'utf8',
  );
  expect(emailSource).toContain('buildLegacyExportDocumentPayload');
  expect(emailSource).toContain('buildLegacyPrintDocumentPayload');
  expect(emailSource).toContain('buildLegacyEmailDocumentPayload');
  expect(emailSource).not.toContain('buildOfficeExportDocumentPayload');
  expect(emailSource).not.toContain("presentationMode: 'office-tables'");
});
