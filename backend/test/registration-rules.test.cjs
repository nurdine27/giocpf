const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/registration-rules.cjs');

const provinces = { Sofala: ['Beira', 'Dondo'], Niassa: ['Lichinga'] };
const areas = ['Gestão e Administração', 'Técnica e Industrial'];

test('accepts a district listed under its province', () => {
  assert.doesNotThrow(() => rules.assertLocation('Sofala', 'Beira', provinces));
});
test('rejects an unknown or mismatched province and district', () => {
  assert.throws(
    () => rules.assertLocation('Sofala', 'Lichinga', provinces),
    /província e distrito válidos/,
  );
  assert.throws(
    () => rules.assertLocation('Unknown', 'Beira', provinces),
    /província e distrito válidos/,
  );
});
test('accepts only known training areas', () => {
  assert.doesNotThrow(() => rules.assertArea(areas[0], areas));
  assert.throws(() => rules.assertArea('Área inventada', areas), /área de formação válida/);
});
test('rejects a nonexistent or unpublished course', () => {
  assert.throws(() => rules.assertCourseAvailable(null), /não está disponível/);
  assert.throws(() => rules.assertCourseAvailable({ published: false }), /não está disponível/);
});
test('blocks closed enrollments and accepts open enrollments', () => {
  assert.throws(() => rules.assertEnrollmentOpen({ enrollmentOpen: false }), /encerradas/);
  assert.doesNotThrow(() => rules.assertEnrollmentOpen({ enrollmentOpen: true }));
});
test('creates distinct, non-sequential registration references', () => {
  const first = rules.createReference();
  const second = rules.createReference();
  assert.match(first, /^GIO-[A-F0-9]{10}$/);
  assert.notEqual(first, second);
});
test('permits only the four supported administrative statuses', () => {
  for (const status of ['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'])
    assert.equal(rules.isRegistrationStatus(status), true);
  assert.equal(rules.isRegistrationStatus('ADMIN'), false);
});
