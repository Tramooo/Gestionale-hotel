export function sendApiError(res, status, code, message, { fieldErrors, conflicts } = {}) {
  const error = { code, message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  if (Array.isArray(conflicts) && conflicts.length > 0) error.conflicts = conflicts;
  return res.status(status).json({ error });
}

export function sendInternalError(res, context, error) {
  console.error(`[${context}]`, {
    name: error?.name || 'Error',
    code: error?.code || 'UNEXPECTED'
  });
  return sendApiError(res, 500, 'INTERNAL_ERROR', 'Si è verificato un errore. Riprova.');
}

export function sendMethodNotAllowed(res) {
  return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito');
}
