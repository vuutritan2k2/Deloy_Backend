import jwt from 'jsonwebtoken';

const authUserMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Không tìm thấy token hoặc định dạng không hợp lệ');
    return res.status(401).json({ message: 'Không tìm thấy token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.role !== 'USER') {
      console.warn(`Người dùng có role ${decoded.role} không được phép truy cập`);
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }
    // **Quan trọng**: Gán trực tiếp decoded cho req.user
    req.user = decoded; // decoded chứa _id, role, iat, exp
    next();
  } catch (error) {
    console.error('Lỗi xác thực token:', error.name, error.message); // In thêm error.name
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token đã hết hạn' });
    }
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

export default authUserMiddleware;
