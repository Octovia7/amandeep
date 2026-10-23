import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

const required = (name, devFallback) => {
  const v = process.env[name] ?? (isProd ? undefined : devFallback);
  if (v === undefined) throw new Error(`Missing env var ${name}`);
  return v;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/todo_app'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7),
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Fraction of the SLA duration remaining at which an active task becomes "At Risk"
  slaAtRiskThreshold: Number(process.env.SLA_AT_RISK_THRESHOLD || 0.2),
  resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES || 30),
};
