// Bootstraps an INBYTE administrator (the only way to create the first one).
//   ADMIN_PASSWORD='…' node server/src/cli/createAdmin.ts --email ops@inbyte.app --name "Ops" [--role INBYTE_OPERATOR]
// The password is read from ADMIN_PASSWORD so it never appears in shell history or `ps`.

import { parseArgs } from 'node:util';
import { createAdminUser } from '../modules/auth/authService.ts';
import { migrate } from '../db/migrate.ts';
import { createPool } from '../db/pool.ts';
import { passwordPolicyIssue } from '../security/passwords.ts';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'INBYTE_SUPER_ADMIN' } }
});
const url = process.env.DATABASE_URL;
const password = process.env.ADMIN_PASSWORD ?? '';
if (!url) throw new Error('DATABASE_URL is required');
if (!values.email) throw new Error('--email is required');
if (values.role !== 'INBYTE_SUPER_ADMIN' && values.role !== 'INBYTE_OPERATOR') throw new Error('--role must be INBYTE_SUPER_ADMIN or INBYTE_OPERATOR');
const issue = passwordPolicyIssue(password);
if (issue) throw new Error(`ADMIN_PASSWORD must have ${issue}`);

const db = createPool(url, { max: 1 });
await migrate(db);
const user = await createAdminUser(db, { email: values.email, displayName: values.name ?? values.email, role: values.role, password });
console.log(`created ${user.role} ${user.email}`);
await db.end();
