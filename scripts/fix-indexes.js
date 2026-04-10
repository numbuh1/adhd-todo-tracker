/**
 * One-time migration: drop the old single-field unique index on weeks.weekStart
 * that was created before multi-user support was added.
 *
 * Run once with:  node scripts/fix-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adhd-tracker';
  console.log('Connecting to', uri);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const col = db.collection('weeks');

  // List existing indexes so we can see what needs dropping
  const indexes = await col.indexes();
  console.log('\nCurrent indexes on "weeks" collection:');
  indexes.forEach(ix => console.log(' -', JSON.stringify(ix.key), ix.unique ? '(unique)' : ''));

  // Drop the old single-field index if it still exists
  const oldIndex = indexes.find(ix =>
    Object.keys(ix.key).length === 1 && ix.key.weekStart !== undefined
  );

  if (oldIndex) {
    console.log('\nDropping old index:', oldIndex.name);
    await col.dropIndex(oldIndex.name);
    console.log('✅  Done! Old index dropped.');
  } else {
    console.log('\n✅  Old index not found — nothing to do.');
  }

  // Show final state
  const after = await col.indexes();
  console.log('\nIndexes after migration:');
  after.forEach(ix => console.log(' -', JSON.stringify(ix.key), ix.unique ? '(unique)' : ''));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
