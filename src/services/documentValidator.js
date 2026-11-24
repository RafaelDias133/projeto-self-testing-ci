const { isValidCpf } = require('../domain/cpf');

function createDocumentValidator({ url, fetchFn = fetch }) {
  return {
    async isValid(document) {
      if (!url) {
        return isValidCpf(document);
      }
      const digits = String(document).replace(/\D/g, '');
      const response = await fetchFn(`${url}/documents/${digits}`);
      if (!response.ok) {
        throw new Error(`Servico de validacao cadastral respondeu com status ${response.status}`);
      }
      const body = await response.json();
      return body.valid === true;
    },
  };
}

module.exports = { createDocumentValidator };
