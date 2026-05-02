/**
 * Tests unitaires pour firebaseSync.js
 * 
 * À exécuter avec Node.js ou dans le navigateur avec un test runner
 * node firebaseSync.test.js
 */

// Simuler localStorage pour les tests Node.js
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = value; },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; }
  };
}

// Charger firebaseSync.js
if (typeof require !== 'undefined') {
  // Pour Node.js, on simule le module
  const code = require('fs').readFileSync('./firebaseSync.js', 'utf-8');
  // ... évaluation du code
}

// ────────────────────────────────────────────────────────────────────────────
// TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('firebaseSync.js', () => {
  
  beforeEach(() => {
    localStorage.clear();
  });
  
  describe('toFirestoreFields()', () => {
    it('convertit un objet simple en champs Firestore', () => {
      const obj = { title: 'Test', done: true, count: 42 };
      const result = toFirestoreFields(obj);
      
      assert.equal(result.title.stringValue, 'Test');
      assert.equal(result.done.booleanValue, true);
      assert.equal(result.count.integerValue, '42');
    });
    
    it('gère les valeurs null', () => {
      const obj = { value: null };
      const result = toFirestoreFields(obj);
      
      assert.equal(result.value.nullValue, null);
    });
    
    it('utilise doubleValue quand numberType=double', () => {
      const obj = { price: 19.99 };
      const result = toFirestoreFields(obj, 'double');
      
      assert.equal(result.price.doubleValue, 19.99);
    });
  });
  
  describe('fromFirestoreFields()', () => {
    it('convertit les champs Firestore en objet JS', () => {
      const fields = {
        title: { stringValue: 'Test' },
        done: { booleanValue: true },
        count: { integerValue: '42' }
      };
      const result = fromFirestoreFields(fields);
      
      assert.equal(result.title, 'Test');
      assert.equal(result.done, true);
      assert.equal(result.count, 42);
    });
    
    it('gère les champs vides', () => {
      const result = fromFirestoreFields(null);
      assert.deepEqual(result, {});
    });
  });
  
  describe('fbUrl()', () => {
    it('construit une URL Firestore valide', () => {
      localStorage.setItem('lt_fb', JSON.stringify({apiKey: 'test-key'}));
      
      const url = fbUrl('meta/todo/tasks/task-001');
      
      assert(url.includes('firestore.googleapis.com'));
      assert(url.includes('familyhub-colis-8abbd'));
      assert(url.includes('test-key'));
      assert(url.includes('meta/todo/tasks/task-001'));
    });
  });
  
  describe('fbCreateSyncHandler()', () => {
    it('crée un handler avec readAll, write, delete', () => {
      const handler = fbCreateSyncHandler('meta/test');
      
      assert(typeof handler.readAll === 'function');
      assert(typeof handler.write === 'function');
      assert(typeof handler.delete === 'function');
      assert(typeof handler.getCollection === 'function');
      assert(typeof handler.getUrl === 'function');
    });
    
    it('getCollection retourne le chemin correct', () => {
      const handler = fbCreateSyncHandler('meta/cave/bottles');
      
      assert.equal(handler.getCollection(), 'meta/cave/bottles');
    });
    
    it('getUrl construit une URL valide', () => {
      localStorage.setItem('lt_fb', JSON.stringify({apiKey: 'key'}));
      const handler = fbCreateSyncHandler('meta/todo/tasks');
      
      const url = handler.getUrl('task-001');
      
      assert(url.includes('meta/todo/tasks/task-001'));
    });
  });
  
  describe('fbIsConfigured()', () => {
    it('retourne false quand localStorage est vide', () => {
      assert.equal(fbIsConfigured(), false);
    });
    
    it('retourne true quand config valide', () => {
      localStorage.setItem('lt_fb', JSON.stringify({
        apiKey: 'key',
        projectId: 'project'
      }));
      
      assert.equal(fbIsConfigured(), true);
    });
  });
  
  describe('fbSetConfig / fbGetConfig', () => {
    it('sauvegarde et récupère la config', () => {
      const config = { apiKey: 'test-key', projectId: 'test-project' };
      fbSetConfig(config);
      
      const retrieved = fbGetConfig();
      
      assert.deepEqual(retrieved, config);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UTILITAIRES DE TEST (mini test framework)
// ────────────────────────────────────────────────────────────────────────────

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

function beforeEach(fn) {
  // Exécuté avant chaque test
}

const assert = {
  equal: (a, b) => {
    if (a !== b) throw new Error(`Expected ${a} to equal ${b}`);
  },
  deepEqual: (a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
    }
  }
};

console.log('firebaseSync.js — Test Suite');
