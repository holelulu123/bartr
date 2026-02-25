import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // user id
  nickname: string;
  jti?: string;
}

const secret = new TextEncoder().encode(env.jwtSecret);

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ nickname: payload.nickname })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.jwtAccessExpiry)
    .sign(secret);
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ nickname: payload.nickname })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(env.jwtRefreshExpiry)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    nickname: payload.nickname as string,
    jti: payload.jti,
  };
}
