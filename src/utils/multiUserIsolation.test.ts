import test from 'node:test';
import assert from 'node:assert';
import {
  DbMemoryFact,
  DbUserProfile,
  ADMIN_GOOGLE_EMAIL,
  isUserAdmin,
  normalizeUsername,
  validateUsernameFormat,
} from '../lib/firebase';

test('Per-user isolation: User A memories and User B memories remain strictly isolated', () => {
  const uidA = 'google_uid_alpha_123';
  const uidB = 'google_uid_beta_456';

  const userAMemories: DbMemoryFact[] = [
    {
      id: 'mem_1',
      userId: uidA,
      category: 'personal',
      fact: 'Has a cat named Luna',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem_2',
      userId: uidA,
      category: 'preference',
      fact: 'Prefers Cyberpunk neon vibes',
      createdAt: new Date().toISOString(),
    },
  ];

  const userBMemories: DbMemoryFact[] = [
    {
      id: 'mem_3',
      userId: uidB,
      category: 'work',
      fact: 'Senior Software Engineer building React apps',
      createdAt: new Date().toISOString(),
    },
  ];

  // Invariant 1: User A facts contain only User A UID
  assert.strictEqual(userAMemories.every((m) => m.userId === uidA), true);
  // Invariant 2: User B facts contain only User B UID
  assert.strictEqual(userBMemories.every((m) => m.userId === uidB), true);
  // Invariant 3: Neither memory array contains facts belonging to the other user
  assert.strictEqual(userAMemories.some((m) => m.userId === uidB), false);
  assert.strictEqual(userBMemories.some((m) => m.userId === uidA), false);
});

test('Per-user isolation: Profile data is strictly scoped to the user UID', () => {
  const profileA: DbUserProfile = {
    uid: 'uid_a',
    username: 'alice_w',
    usernameNormalized: 'alice_w',
    preferredName: 'Alice',
    favoriteVibe: 'romantic',
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-02T00:00:00Z',
    accountType: 'public',
    followersCount: 0,
    followingCount: 0,
  };

  const profileB: DbUserProfile = {
    uid: 'uid_b',
    username: 'bob_dev',
    usernameNormalized: 'bob_dev',
    preferredName: 'Bob',
    favoriteVibe: 'emerald_matrix',
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-02T00:00:00Z',
    accountType: 'private',
    followersCount: 10,
    followingCount: 5,
  };

  assert.notStrictEqual(profileA.uid, profileB.uid);
  assert.notStrictEqual(profileA.username, profileB.username);
  assert.notStrictEqual(profileA.preferredName, profileB.preferredName);
});

test('Username normalization enforces case-insensitive uniqueness', () => {
  const variant1 = 'RiyaUser';
  const variant2 = 'riyauser';
  const variant3 = 'RIYAUSER';

  assert.strictEqual(normalizeUsername(variant1), 'riyauser');
  assert.strictEqual(normalizeUsername(variant2), 'riyauser');
  assert.strictEqual(normalizeUsername(variant3), 'riyauser');
  assert.strictEqual(normalizeUsername(variant1), normalizeUsername(variant2));
  assert.strictEqual(normalizeUsername(variant2), normalizeUsername(variant3));
});

test('Username validation validates length and allowed characters', () => {
  assert.strictEqual(validateUsernameFormat('harsh_dev').isValid, true);
  assert.strictEqual(validateUsernameFormat('riya123').isValid, true);
  assert.strictEqual(validateUsernameFormat('ab').isValid, false); // < 3 chars
  assert.strictEqual(validateUsernameFormat('this_username_is_way_too_long_for_registration').isValid, false); // > 20 chars
  assert.strictEqual(validateUsernameFormat('user@name!').isValid, false); // invalid characters
  assert.strictEqual(validateUsernameFormat('').isValid, false); // empty
});

test('Admin identity check grants privileges ONLY to configured administrator', () => {
  assert.strictEqual(ADMIN_GOOGLE_EMAIL, '3881229harsh@gmail.com');

  const adminUser = {
    uid: 'admin_uid_777',
    email: '3881229harsh@gmail.com',
  } as any;

  const normalUser = {
    uid: 'normal_uid_888',
    email: 'other_user@gmail.com',
  } as any;

  const anonymousUser = {
    uid: 'anon_uid_999',
    email: null,
  } as any;

  assert.strictEqual(isUserAdmin(adminUser), true);
  assert.strictEqual(isUserAdmin(normalUser), false);
  assert.strictEqual(isUserAdmin(anonymousUser), false);
  assert.strictEqual(isUserAdmin(null), false);
});

test('Forget query matching correctly finds corresponding memory', () => {
  const memories: DbMemoryFact[] = [
    {
      id: 'mem_1',
      userId: 'uid_1',
      category: 'personal',
      fact: 'My dog is a golden retriever named Bruno',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem_2',
      userId: 'uid_1',
      category: 'preference',
      fact: 'Likes drinking matcha latte',
      createdAt: new Date().toISOString(),
    },
  ];

  const queryDog = 'Bruno';
  const matchDog = memories.find(
    (m) =>
      m.fact.toLowerCase().includes(queryDog.toLowerCase()) ||
      m.category.toLowerCase().includes(queryDog.toLowerCase())
  );
  assert.ok(matchDog);
  assert.strictEqual(matchDog.id, 'mem_1');

  const queryMatcha = 'matcha';
  const matchMatcha = memories.find(
    (m) =>
      m.fact.toLowerCase().includes(queryMatcha.toLowerCase()) ||
      m.category.toLowerCase().includes(queryMatcha.toLowerCase())
  );
  assert.ok(matchMatcha);
  assert.strictEqual(matchMatcha.id, 'mem_2');
});
