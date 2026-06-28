// src/types/express.d.ts
import mongoose from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: mongoose.Types.ObjectId | string;
        _id: mongoose.Types.ObjectId | string;
        email?: string;
        role?: string;
      };
    }
  }
}

export {};
