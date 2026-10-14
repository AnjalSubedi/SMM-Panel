const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

// Production QA has no email sender. Seed verified identities only in the disposable QA database.
exports.seedQaUser = async function seedQaUser(name, email, password) {
  const url = new URL(process.env.QA_DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.username, 'dmnp_test'); assert.equal(url.pathname, '/dmnp_qa');
  const db = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    const { hashPassword } = await import('better-auth/crypto');
    const id = randomUUID(); const now = new Date();
    await db.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,$4,$4)', [id,name,email,now]);
    await db.query('INSERT INTO "account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,$3,$2,$4,$5,$5)', [randomUUID(),id,'credential',await hashPassword(password),now]);
  } finally { await db.end(); }
};
