import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface TokenPayload {
    userId: any;
    email: string;
    name: string;
}

// Generate a JWT token
// rememberMe = true -> long-lived session (30 days)
// rememberMe = false/undefined -> short-lived session (falls back to
// JWT_EXPIRES_IN env value, or 1h if that isn't set)
export const generateToken = (
    userId: any,
    email: string,
    name: string,
    role: string,
    orgId: any,
    rememberMe?: boolean
): string => {
    const secret = process.env.JWT_SECRET as string;
    const expiresIn = rememberMe
        ? "30d"
        : process.env.JWT_EXPIRES_IN || "1h";

    if (!secret) {
        throw new Error("JWT_SECRET is not defined in environment variables.");
    }

    return jwt.sign({ userId, email, name, role, orgId }, secret, { expiresIn });
};

// Verify a JWT token
export const verifyToken = (token: string): TokenPayload => {
    try {
        const secret = process.env.JWT_SECRET as string;
        if (!secret) {
            throw new Error(
                "JWT_SECRET is not defined in environment variables."
            );
        }

        return jwt.verify(token, secret) as TokenPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error("Token has expired.");
        } else if (error instanceof jwt.JsonWebTokenError) {
            throw new Error("Invalid token.");
        } else {
            throw new Error("Token verification failed.");
        }
    }
};