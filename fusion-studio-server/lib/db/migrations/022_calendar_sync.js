exports.up = async (knex) => {
  await knex.schema.createTable('calendar_sources', (t) => {
    t.string('uuid').primary();    // source-prefixed: "apple:UUID" | "google:id"
    t.string('source').notNullable();
    t.string('title').notNullable();
    t.string('color');
    t.string('type');
    t.bigInteger('updated_at');
  });

  await knex.schema.createTable('calendar_events', (t) => {
    t.string('uuid').primary();    // source-prefixed
    t.string('source').notNullable();
    t.string('title');
    t.bigInteger('startDate');     // Unix timestamp seconds
    t.bigInteger('endDate');       // Unix timestamp seconds
    t.string('timezone');
    t.boolean('allDay').defaultTo(false);
    t.text('description');
    t.string('conferenceUrl');
    t.string('calendarUuid');      // FK to calendar_sources.uuid
    t.string('calendarTitle');
    t.string('calendarColor');
    t.bigInteger('updated_at');
    t.index(['startDate', 'endDate']);
    t.index('calendarUuid');
    t.index('source');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('calendar_events');
  await knex.schema.dropTableIfExists('calendar_sources');
};
