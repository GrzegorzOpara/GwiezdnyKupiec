import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

export async function verifyGoogleToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacyjnego (Bearer token)' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Ułatwienie dla testów lokalnych/deweloperskich
    if (token.startsWith('test-token-')) {
      req.user = {
        uid: token.replace('test-token-', ''),
        email: `${token}@example.com`,
        name: `Tester ${token.replace('test-token-', '')}`,
      };
      return next();
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Nieprawidłowy token Google ID (brak payload)' });
    }

    req.user = {
      uid: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    next();
  } catch (error: any) {
    console.error('Błąd weryfikacji tokenu Google:', error.message);
    res.status(401).json({ error: 'Niepoprawny token Google ID' });
  }
}
export default verifyGoogleToken;
