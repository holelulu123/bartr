import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // user id
  nickname: string;
  jti?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtAccessExpiry });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.jwtSecret,
    { expiresIn: env.jwtRefreshExpiry },
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
