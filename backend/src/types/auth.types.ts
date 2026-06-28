// src/types/auth.types.ts
import { Request } from 'express';
import mongoose from 'mongoose';

export type AuthenticatedRequest = Request & {
  user: {
    id: mongoose.Types.ObjectId | string;
    _id: mongoose.Types.ObjectId | string;
    email?: string;
    role?: string;
  };
};
