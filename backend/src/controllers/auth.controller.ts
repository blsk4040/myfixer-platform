// mobile_apps/backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// --- Temporary Inline User Schema ---
// (If you already have a User model file, import it here instead and remove this schema block)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  location: {
    country: { type: String, default: 'South Africa' },
    city: { type: String, required: true, trim: true },
  },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['client', 'tech'], default: 'client' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// --- JWT Helper Generator ---
const generateToken = (userId: string, role: string): string => {
  const secret = process.env.JWT_SECRET || 'fallback_development_secret_key';
  return jwt.sign({ id: userId, role }, secret, { expiresIn: '30d' });
};

/**
 * @desc    Register a new client or specialist profile matrix
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, location, password, role } = req.body;

    // 1. Structural Payload Validation
    if (!name || !email || !phone || !location?.city || !password) {
      res.status(400).json({ message: 'Registration payload rejected. Please fill all required fields.' });
      return;
    }

    // 2. Prevent Account Duplication
    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      res.status(409).json({ message: 'An account with this email address already exists.' });
      return;
    }

    // 3. Cryptographic Password Hashing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Persistence Entry Commit
    const newUser = await User.create({
      name,
      email: normalizedEmail,
      phone: phone.trim(),
      location: {
        country: location.country || 'South Africa',
        city: location.city.trim(),
      },
      password: hashedPassword,
      role: role || 'client',
    });

    // 5. Auth Token Issuance Matrix
    const token = generateToken(newUser._id.toString(), newUser.role);

    res.status(201).json({
      status: 'success',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error: any) {
    console.error('❌ Registration processing engine failure:', error);
    res.status(500).json({ message: 'Internal server error processing security footprint registration.' });
  }
};

/**
 * @desc    Authenticate User Session & Return Token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Check Input Presence
    if (!email || !password) {
      res.status(400).json({ message: 'Please provide both an email and password.' });
      return;
    }

    // 2. Lookup Identity Footprint Match
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
      return;
    }

    // 3. Compare Cryptographic Fingerprint Signatures
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
      return;
    }

    // 4. Issue Valid Session Handshake Token
    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('❌ Login authentication mechanism failure:', error);
    res.status(500).json({ message: 'Internal server error verifying profile authentication states.' });
  }
};