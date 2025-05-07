import bcrypt from 'bcryptjs';
import UserModel from '../models/userModel.js';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import admin from '../config/firebaseConfig.js';
import dotenv from 'dotenv';
dotenv.config();

// Tạo user [POST] /api/register
export const createUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userName, fullName, phone, email, password, role, address } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Tạo người dùng trong Firebase Auth
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new UserModel({
      userName,
      fullName,
      phone,
      email,
      password: hashedPassword,
      role,
      address: Array.isArray(address) ? address : [address],
      firebaseUid: firebaseUser.uid, // Lưu Firebase UID
    });

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    const newUser = await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(201).json({
      statusCode: 201,
      user: newUser,
      message: 'Tạo tài khoản thành công',
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    next(error);
  }
};

// Đăng nhập [POST] /api/login
export const login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ statusCode: 400, message: 'Vui lòng nhập số điện thoại và mật khẩu' });
  }

  const userExist = await UserModel.findOne({ phone });
  if (!userExist) {
    return res.status(404).json({ statusCode: 404, message: 'Tài khoản không tồn tại' });
  }

  const isPasswordCorrect = await bcrypt.compare(password, userExist.password);
  if (!isPasswordCorrect) {
    return res.status(400).json({ statusCode: 400, message: 'Mật khẩu hoặc tài khoản không đúng' });
  }

  const accessToken = userExist.generateAccessToken();
  const refreshToken = userExist.generateRefreshToken();

  userExist.refreshToken = refreshToken;
  await userExist.save();

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(200).json({
    statusCode: 200,
    data: {
      _id: userExist._id,
      fullName: userExist.fullName,
      phone: userExist.phone,
      email: userExist.email,
      role: userExist.role,
      address: userExist.address, // Address is now an array
      accessToken,
    },
  });
};

// Đăng nhập với admin [POST] /api/login/admin
export const loginAdmin = async (req, res) => {
  const { phone, password } = req.body;
  const userExist = await UserModel.findOne({ phone, role: 'ADMIN' });
  if (!userExist) {
    return res.status(404).json({ statusCode: 404, message: 'Tài khoản không tồn tại' });
  }
  const isPasswordCorrect = await bcrypt.compare(password, userExist.password);
  if (!isPasswordCorrect) {
    return res.status(400).json({ statusCode: 400, message: 'Mật khẩu hoặc tài khoản không đúng' });
  }
  const accessToken = userExist.generateAccessToken();
  const refreshToken = userExist.generateRefreshToken();
  userExist.refreshToken = refreshToken;
  await userExist.save();
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  res.status(200).json({
    fullName: userExist.fullName,
    phone: userExist.phone,
    email: userExist.email,
    role: userExist.role,
    address: userExist.address, // Address is now an array
    accessToken,
  });
};

// POST Làm Mới Token (/api/refresh_token)
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Validate refreshToken
    if (!refreshToken || typeof refreshToken !== 'string') {
      console.error('Invalid refresh token:', refreshToken);
      return res.status(400).json({ message: 'Invalid refresh token' });
    }

    // Verify the refresh token
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        console.error('JWT Verification Error:', err);
        return res.status(403).json({ message: 'Refresh token không hợp lệ' });
      }

      console.log('Decoded Token:', decoded);

      // Find the user associated with the refresh token
      const user = await UserModel.findOne({ refreshToken });
      if (!user) {
        console.error('User not found for refresh token');
        return res.status(403).json({ message: 'Refresh token không hợp lệ' });
      }

      // Generate a new access token
      const newAccessToken = jwt.sign({ _id: user._id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
      });

      console.log('New Access Token:', newAccessToken);
      return res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    console.error('Error in refreshToken handler:', error);
    res.status(500).json({ message: 'Lỗi server', error });
  }
};
// Đăng xuất [POST] /api/logout
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.sendStatus(204);

    const user = await UserModel.findOne({ refreshToken });
    if (!user) return res.sendStatus(204);

    user.refreshToken = null;
    await user.save();

    res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.status(200).json({ message: 'Đã đăng xuất' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Email:', email);

    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc' });
    }

    // Kiểm tra email trong MongoDB
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong cơ sở dữ liệu' });
    }

    // Kiểm tra email trong Firebase Authentication
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      console.log('User found in Firebase:', userRecord.uid);
    } catch (error) {
      console.error('Firebase user check error:', error);
      return res.status(404).json({ message: 'Email không tồn tại trong Firebase' });
    }

    const actionCodeSettings = {
      url: process.env.CLIENT_URL,
      handleCodeInApp: true,
    };
    console.log('Action Code Settings:', actionCodeSettings);

    // Gửi link reset qua Firebase Auth
    const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    console.log('Password Reset Link:', resetLink);

    return res.status(200).json({
      message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.',
    });
  } catch (error) {
    console.error('Error in resetPassword:', error.code, error.message);
    return res.status(500).json({
      message: 'Lỗi khi gửi email đặt lại mật khẩu',
      error: error.message,
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email và mật khẩu mới là bắt buộc' });
    }

    // Kiểm tra người dùng trong MongoDB
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // Cập nhật mật khẩu trong Firebase Auth
    await admin.auth().updateUser(user.firebaseUid, {
      password: newPassword,
    });

    // Hash và cập nhật mật khẩu trong MongoDB
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: 'Mật khẩu đã được cập nhật thành công',
    });
  } catch (error) {
    console.error('Error in updatePassword:', error);
    return res.status(500).json({
      message: 'Lỗi khi cập nhật mật khẩu',
    });
  }
};
