import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/http.js';
import { env } from '../config/env.js';

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  next(new ApiError(422, 'Validation failed', result.array().map((e) => ({ field: e.path, message: e.msg }))));
}

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Resource already exists';
  }
  if (status >= 500 && !env.isTest) console.error(err);
  res.status(status).json({
    success: false,
    error: { message: status >= 500 && env.isProd ? 'Internal server error' : message, details },
  });
}
