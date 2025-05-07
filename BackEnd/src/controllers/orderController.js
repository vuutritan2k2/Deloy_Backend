import OrderModel from '../models/orderModel.js';

// Updated APIs to handle optional pagination and sort by creation date
// localhost:5000/order/all?page=1&limit=10
export const getOrder = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const query = OrderModel.find().sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(Number(limit));
    }

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments();
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng', error: error.message });
  }
};

// Admin: Lấy danh sách đơn hàng theo ID
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng', error: error.message });
  }
};

// Admin: Cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await OrderModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng để cập nhật' });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái đơn hàng', error: error.message });
  }
};

// Admin: Xóa đơn hàng
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await OrderModel.findByIdAndDelete(id);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng để xóa' });
    }
    res.status(200).json({ message: 'Xóa đơn hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đơn hàng', error: error.message });
  }
};

// Updated APIs to handle optional pagination and sort by creation date
export const getOrderByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page, limit } = req.query;
    const query = OrderModel.find({ status }).sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(Number(limit));
    }

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments({ status });
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng theo trạng thái', error: error.message });
  }
};

// Updated APIs to handle optional pagination and sort by creation date
export const getOrderByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;
    const query = OrderModel.find({ userId }).sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(Number(limit));
    }

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments({ userId });
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng theo người dùng', error: error.message });
  }
};

// Updated APIs to handle optional pagination and sort by creation date
export const getOrderByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { page, limit } = req.query;
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    const query = OrderModel.find({
      createdAt: { $gte: startDate, $lt: endDate },
    }).sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(Number(limit));
    }

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
    });
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng theo ngày', error: error.message });
  }
};

// Updated APIs to handle optional pagination and sort by creation date
export const getOrderByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const { page, limit } = req.query;
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    const query = OrderModel.find({ createdAt: { $gte: startDate, $lt: endDate } }).sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(Number(limit));
    }

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments({ createdAt: { $gte: startDate, $lt: endDate } });
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng theo tháng', error: error.message });
  }
};

// Updated APIs to handle optional pagination and sort by creation date
export const getOrderByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('User ID:', userId);

    const query = OrderModel.find({ userId }).sort({ createdAt: -1 });

    const orders = await query;
    const totalOrders = await OrderModel.countDocuments({ userId });
    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng của người dùng', error: error.message });
  }
};

// User: Xem chi tiết đơn hàng
export const getOrderDetailByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    console.log({ userId, id }); // Debugging

    const order = await OrderModel.findOne({ _id: id, userId });
    if (!order) {
      console.warn(`Không tìm thấy đơn hàng với ID: ${id} và userId: ${userId}`);
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi khi lấy chi tiết đơn hàng', error: error.message });
  }
};

// User: Hủy đơn hàng
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const order = await OrderModel.findOneAndUpdate({ _id: id, userId }, { status: 'Cancelled' }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng để hủy' });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi hủy đơn hàng', error: error.message });
  }
};
