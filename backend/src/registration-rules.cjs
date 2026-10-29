const { randomBytes } = require('node:crypto');

function assertLocation(province, district, provinces) {
  if (!provinces[province] || !provinces[province].includes(district))
    throw new Error('Seleccione uma província e distrito válidos.');
}
function assertArea(area, areas) {
  if (!areas.includes(area)) throw new Error('Seleccione uma área de formação válida.');
}
function assertCourseAvailable(course) {
  if (!course || !course.published)
    throw new Error('Este curso não está disponível para inscrição.');
}
function assertEnrollmentOpen(course) {
  if (!course.enrollmentOpen) throw new Error('As inscrições para este curso estão encerradas.');
}
function createReference() {
  return `GIO-${randomBytes(5).toString('hex').toUpperCase()}`;
}
function isRegistrationStatus(status) {
  return ['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].includes(status);
}
module.exports = {
  assertLocation,
  assertArea,
  assertCourseAvailable,
  assertEnrollmentOpen,
  createReference,
  isRegistrationStatus,
};
