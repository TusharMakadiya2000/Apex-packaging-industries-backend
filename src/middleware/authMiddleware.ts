// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyToken = (token: string) => {
    return jwt.verify(token, process.env.JWT_SECRET as string);
};

// Middleware to authenticate token
export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return res
            .status(401)
            .send({ error: "Access denied. No token provided." });
    }

    const token = authHeader.replace("Bearer ", "");
    try {
        const decoded = verifyToken(token);
        (req as any).user = decoded;
        next();
    } catch (error) {
        res.status(401).send({ error: "Invalid token." });
    }
};
