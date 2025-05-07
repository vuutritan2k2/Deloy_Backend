import mongoose, { startSession } from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import AutoIncrementFactory from 'mongoose-sequence';
import { ROLE } from '../constant/index.js';

dotenv.config();

const AutoIncrement = AutoIncrementFactory(mongoose);

const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, unique: true, required: true },
    role: { type: String, enum: [ROLE.ADMIN, ROLE.USER], required: true },
    address: { type: [String], default: [] },
    refreshToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    firebaseUid: { type: String },
  },
  {
    timestamps: true,
  }
);

// Generate Access Token
userSchema.method('generateAccessToken', function () {
  return jwt.sign(
    { _id: this._id, role: this.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' } // Correct format
  );
});

// Generate Refresh Token
userSchema.method('generateRefreshToken', function () {
  return jwt.sign(
    { _id: this._id, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // Correct format
  );
});

const UserModel = mongoose.model('User', userSchema);

export default UserModel;
