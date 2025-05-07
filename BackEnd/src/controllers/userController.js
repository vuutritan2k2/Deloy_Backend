// GET /getAll phân trang danh sách người dùng

import UserModel from '../models/userModel.js';

export const getListUser = async (req, res) => {
  const { limit, page, q, order } = req.query;

  // Đổi limit và page từ string sang number
  const limitNumber = parseInt(limit) || 10; // Giá trị mặc định là 10 nếu không có limit
  const pageNumber = parseInt(page) || 1; // Giá trị mặc định là 1 nếu không có page

  // Tạo truy vấn q trên MongoDB với option i dùng để không phân biệt hoa thường
  const query = q
    ? {
        $or: [
          { fullName: { $regex: q, $options: 'i' } },
          { userName: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ],
        role: { $ne: 'ADMIN' }, // Bỏ qua user có role là ADMIN
      }
    : { role: { $ne: 'ADMIN' } }; // Bỏ qua user có role là ADMIN nếu không có q

  const sortBy = order === 'ASC' ? 1 : -1;

  try {
    // Đếm tổng số người dùng thỏa query
    const total = await UserModel.countDocuments(query);

    // Lấy ra danh sách người dùng, bỏ qua user có role là ADMIN
    const userList = await UserModel.find(query)
      .sort({ createdAt: sortBy }) // Sắp xếp theo thời gian tạo
      .skip((pageNumber - 1) * limitNumber) // Bỏ qua số lượng phần tử không cần khi phân trang, ví dụ page 2, limit 10 thì bỏ qua 10 phần tử đầu
      .limit(limitNumber); // Giới hạn số lượng phần tử trả về mỗi trang

    res.json({
      data: userList,
      total,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Lấy thông tin người dùng hiện tại
export const getUserInfo = async (req, res) => {
  const user = await UserModel.findById(req.user._id).select('-password'); // Lấy thông tin người dùng hiện tại, không lấy password
  res.json({
    statusCode: 200,
    data: user,
  });
};

// Sửa thông tin người dùng hiện tại
export const updateUser = async (req, res) => {
  const { userName, fullName, password, email, phone, address } = req.body;

  try {
    // Tìm người dùng trong cơ sở dữ liệu
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cập nhật thông tin người dùng
    if (userName) user.userName = userName;
    if (fullName) user.fullName = fullName;
    if (password) user.password = await bcrypt.hash(password, 10); // Mã hóa mật khẩu mới
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) {
      if (Array.isArray(address)) {
        user.address = address; // Ghi đè toàn bộ địa chỉ nếu là mảng
      } else {
        user.address.push(address); // Thêm địa chỉ mới nếu là chuỗi
      }
    }

    // Lưu thông tin người dùng đã cập nhật
    await user.save();

    // Trả về thông tin người dùng đã cập nhật, không bao gồm mật khẩu
    const updatedUser = await UserModel.findById(req.user._id).select('-password');
    res.json({
      statusCode: 200,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

// Xóa người dùng
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // Tìm và xóa người dùng trong cơ sở dữ liệu
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ statusCode: 200, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

// Cập nhật người dùng theo id
export const updateUserById = async (req, res) => {
  const { id } = req.params;
  const { userName, fullName, password, email, phone, role, address } = req.body;

  try {
    // Tìm người dùng trong cơ sở dữ liệu
    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cập nhật thông tin người dùng
    if (userName) user.userName = userName;
    if (fullName) user.fullName = fullName;
    if (password) user.password = await bcrypt.hash(password, 10); // Mã hóa mật khẩu mới
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (address) user.address = address;

    // Lưu thông tin người dùng đã cập nhật
    await user.save();

    // Trả về thông tin người dùng đã cập nhật, không bao gồm mật khẩu
    const updatedUser = await UserModel.findById(id).select('-password');
    res.json({
      statusCode: 200,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ errorCode: error.code, message: 'Error updating user', error: error.message });
  }
};

// Lấy danh sách địa chỉ của người dùng hiện tại
export const getUserAddresses = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id).select('address'); // Chỉ lấy trường address
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      statusCode: 200,
      data: user.address,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching addresses', error: error.message });
  }
};
