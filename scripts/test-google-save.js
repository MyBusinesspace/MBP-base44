import { pool } from '../server/db.js';
import { saveGoogleUser, getUserByEmail } from '../server/userPersistence.js';
import { countUsersInDb } from '../server/syncLegacyUsers.js';

const profile = {
  sub: 'test-google-sub-12345',
  email: 'my.google.account@gmail.com',
  name: 'My Google Name',
  picture: 'https://example.com/pic.jpg',
};

const user = await saveGoogleUser(profile, 'local-branch-1');
console.log('saved', user.id, user.email, user.full_name);
console.log('counts', await countUsersInDb());
console.log('lookup', await getUserByEmail('my.google.account@gmail.com'));
await pool.end();
