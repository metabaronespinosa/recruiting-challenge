/**
 * Typed application error hierarchy.
 *
 * Routes and services throw these; the global error handler in server.ts
 * pattern-matches on them to produce the correct HTTP status code and body.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found');
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly detail?: string,
  ) {
    super(message, 400, 'validation_error');
  }
}

export class AuthError extends AppError {
  constructor(
    message: string,
    public readonly authCode: string,
  ) {
    super(message, 401, authCode);
  }
}
