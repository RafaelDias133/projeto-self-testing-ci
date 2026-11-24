class DomainError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

class ValidationError extends DomainError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends DomainError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends DomainError {
  constructor(message) {
    super(message, 409);
  }
}

class InsufficientFundsError extends DomainError {
  constructor(message = 'Saldo insuficiente') {
    super(message, 422);
  }
}

class InvalidDocumentError extends DomainError {
  constructor(message = 'Documento invalido') {
    super(message, 422);
  }
}

module.exports = {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InsufficientFundsError,
  InvalidDocumentError,
};
