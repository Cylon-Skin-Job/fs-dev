'use strict';

const RETIRED_VIEW_THEME_PATH = 'ai/<machine>/Views/{view-folder}/styles/themes.css';
const CANONICAL_VIEW_THEME_PATH = 'ai/<machine>/System/Views/{view-folder}/styles/themes.css';

async function replaceCustomizationPath(knex, fromPath, toPath) {
  await knex('system_wiki')
    .where('slug', 'customization')
    .where('context', 'like', `%${fromPath}%`)
    .update({
      context: knex.raw('replace(context, ?, ?)', [fromPath, toPath]),
      updated_at: Date.now(),
    });
}

exports.up = async function up(knex) {
  await replaceCustomizationPath(knex, RETIRED_VIEW_THEME_PATH, CANONICAL_VIEW_THEME_PATH);
};

exports.down = async function down(knex) {
  await replaceCustomizationPath(knex, CANONICAL_VIEW_THEME_PATH, RETIRED_VIEW_THEME_PATH);
};

exports.RETIRED_VIEW_THEME_PATH = RETIRED_VIEW_THEME_PATH;
exports.CANONICAL_VIEW_THEME_PATH = CANONICAL_VIEW_THEME_PATH;
