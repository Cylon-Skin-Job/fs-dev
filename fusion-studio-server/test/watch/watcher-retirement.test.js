'use strict';

const fs = require('fs');
const path = require('path');

const serverRoot = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');

describe('watcher retirement boundary', () => {
  test('production startup has no filesystem watcher or watcher shutdown lifecycle', () => {
    const startup = read('lib/startup.js');
    const shutdown = read('lib/shutdown.js');

    for (const retiredPath of [
      'lib/watch/core.js',
      'lib/watch/workspace-watcher.js',
    ]) {
      expect(fs.existsSync(path.join(serverRoot, retiredPath))).toBe(false);
    }
    expect(startup).not.toMatch(/watch\/workspace-watcher|watch\/core|loadFilters|closeWatchers|abandonAll/);
    expect(startup).not.toContain('workspace-watcher-trigger-pipeline');
    expect(fs.existsSync(path.join(serverRoot, 'lib/watcher/filters'))).toBe(false);
    expect(startup).toContain("defineStartupEffect('workspace-automation-pipeline'");
    expect(startup).toContain("require('./triggers/trigger-loader')");
    expect(startup).toContain("require('./triggers/cron-scheduler')");
    expect(startup).toContain("require('./runner')");
    expect(startup).toContain('loadComponents(componentsDir)');
    expect(shutdown).not.toMatch(/closeWatchers|abandonAll/);
    expect(shutdown).toContain('const owners = [...phaseAOwners]');
    const filterLoader = read('lib/watcher/filter-loader.js');
    expect(filterLoader).not.toMatch(/loadFilters|buildFilter|matchesPattern/);
    expect(filterLoader).toContain('module.exports = { applyTemplate, evaluateCondition }');
  });

  test('package metadata has no direct Chokidar dependency or production import', () => {
    const packageJson = JSON.parse(read('package.json'));
    const packageLock = JSON.parse(read('package-lock.json'));
    expect(packageJson.dependencies).not.toHaveProperty('chokidar');
    expect(packageLock.packages[''].dependencies).not.toHaveProperty('chokidar');
    expect(packageLock.packages).not.toHaveProperty('node_modules/chokidar');

    const productionFiles = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(path.join(serverRoot, directory), { withFileTypes: true })) {
        const relative = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(relative);
        else if (entry.name.endsWith('.js')) productionFiles.push(relative);
      }
    };
    visit('lib');
    for (const file of productionFiles) {
      expect(read(file)).not.toMatch(/require\(['"]chokidar['"]\)|from ['"]chokidar['"]|watch\/core|watch\/workspace-watcher|hotkey-screenshot-watcher|watch\/calendar-watcher|abandonAll/);
    }
  });
});
