import axios from 'axios';
import mongoose from 'mongoose';
import ProductModel from '../models/productModel.js';
import OrderModel from '../models/orderModel.js';
import CartModel from '../models/cartModel.js';
// Bạn có thể cần import uuid nếu muốn dùng cho idempotency key của PayPal
// import { v4 as uuidv4 } from 'uuid';

// --- Constants ---
const GOONG_API_KEY = process.env.GOONG_API_KEY || 'YOUR_GOONG_API_KEY'; // Thay thế
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID'; // Thay thế
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'YOUR_PAYPAL_CLIENT_SECRET'; // Thay thế
const PAYPAL_API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com' // Live environment
    : 'https://api-m.sandbox.paypal.com'; // Sandbox environment

const GOONG_GEOCODE_URL = 'https://rsapi.goong.io/Geocode';
const GOONG_DISTANCE_URL = 'https://rsapi.goong.io/DistanceMatrix';
const DEFAULT_FROM_ADDRESS = 'Số 12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, Thành phố Hồ Chí Minh';
const ALLOWED_PAYMENT_METHODS = ['Cash', 'Paypal']; // Đảm bảo 'Paypal' có trong danh sách

// --- PayPal API Helper Functions ---

// Hàm lấy Access Token từ PayPal
const getPayPalAccessToken = async () => {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  try {
    console.log('Requesting PayPal Access Token...');
    const response = await axios.post(`${PAYPAL_API_BASE}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
    });
    console.log('PayPal Access Token obtained successfully.');
    return response.data.access_token;
  } catch (error) {
    console.error('Lỗi lấy PayPal Access Token:', error.response?.status, error.response?.data || error.message);
    throw new Error('Không thể lấy Access Token từ PayPal.');
  }
};

// Hàm tạo PayPal Order (Sử dụng REST API v2)
const createPayPalOrderAPI = async (amountUSD, description, orderId, returnUrlBase, cancelUrlBase) => {
  const accessToken = await getPayPalAccessToken();
  const requestBody = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        // reference_id: orderId, // Có thể thêm orderId của bạn để tham chiếu
        description: description || `Thanh toán cho đơn hàng #${orderId}`,
        amount: {
          currency_code: 'USD', // Hoặc VND nếu tài khoản hỗ trợ và bạn muốn dùng VND
          value: amountUSD.toString(), // Số tiền phải là chuỗi
        },
      },
    ],
    application_context: {
      brand_name: 'Your E-commerce Store Name', // Thay bằng tên cửa hàng của bạn
      landing_page: 'LOGIN', // Hoặc BILLING
      shipping_preference: 'NO_SHIPPING', // Hoặc SET_PROVIDED_ADDRESS nếu bạn gửi địa chỉ
      user_action: 'PAY_NOW',
      return_url: `${returnUrlBase}?orderId=${orderId}`, // Nối orderId vào URL
      cancel_url: `${cancelUrlBase}?orderId=${orderId}`, // Nối orderId vào URL
    },
  };

  try {
    console.log(`Creating PayPal order for Internal Order ID: ${orderId} with amount: ${amountUSD} USD`);
    const response = await axios.post(`${PAYPAL_API_BASE}/v2/checkout/orders`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // 'PayPal-Request-Id': uuidv4(), // Optional for idempotency
      },
    });
    console.log(`PayPal Order Create Response Status: ${response.status}`);
    const approvalUrl = response.data.links?.find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      console.error('Không tìm thấy approval_url trong response của PayPal:', response.data);
      throw new Error('Không tìm thấy URL phê duyệt thanh toán PayPal.');
    }
    console.log('PayPal Approval URL:', approvalUrl);
    // Trả về approvalUrl và PayPal Order ID (response.data.id)
    return { approvalUrl: approvalUrl, paypalOrderId: response.data.id };
  } catch (error) {
    console.error('Lỗi khi tạo PayPal order:', error.response?.status, error.response?.data || error.message);
    throw new Error('Không thể tạo thanh toán PayPal. Vui lòng thử lại.');
  }
};

// Hàm Capture PayPal Payment (Sử dụng REST API v2)
const capturePayPalPaymentAPI = async (paypalOrderId) => {
  const accessToken = await getPayPalAccessToken();
  try {
    console.log(`Attempting to capture PayPal payment for PayPal Order ID: ${paypalOrderId}`);
    // API endpoint để capture order
    const url = `${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`;
    const response = await axios.post(
      url,
      {},
      {
        // Body rỗng cho capture
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log('PayPal Capture Response Status:', response.status);
    // console.log('PayPal Capture Response Body:', JSON.stringify(response.data, null, 2));
    return response.data; // Trả về toàn bộ kết quả capture
  } catch (error) {
    console.error(
      `Lỗi khi capture PayPal payment for Order ID ${paypalOrderId}:`,
      error.response?.status,
      error.response?.data || error.message
    );
    throw new Error('Không thể capture thanh toán PayPal.');
  }
};

// --- Goong API Functions ---
const geocodeAddress = async (address) => {
  if (!GOONG_API_KEY) {
    console.error('Goong API Key is missing!');
    throw new Error('Lỗi cấu hình hệ thống vận chuyển.');
  }
  try {
    const response = await axios.get(GOONG_GEOCODE_URL, { params: { address, api_key: GOONG_API_KEY } });
    if (response.data?.results?.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    console.warn(`Geocoding không tìm thấy kết quả cho: ${address}`);
    throw new Error(`Không thể xác định vị trí cho địa chỉ: ${address}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error_message || error.message;
    const status = error.response?.status;
    console.error(`Lỗi Goong Geocode (${status}) cho "${address}":`, errorMsg);
    if (status === 403) throw new Error(`Lỗi xác thực Goong API. Vui lòng kiểm tra API Key.`);
    throw new Error(`Lỗi Goong Geocode: ${errorMsg}`);
  }
};

const calculateDistance = async (origin, destination) => {
  if (!GOONG_API_KEY) {
    console.error('Goong API Key is missing!');
    throw new Error('Lỗi cấu hình hệ thống vận chuyển.');
  }
  try {
    const response = await axios.get(GOONG_DISTANCE_URL, {
      params: {
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        vehicle: 'car',
        api_key: GOONG_API_KEY,
      },
    });
    const element = response.data?.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK') return element.distance.value / 1000;
    const status = element?.status || response.data?.status || 'UNKNOWN_ERROR';
    console.warn(`Không thể tính khoảng cách Goong. Status: ${status}`, response.data);
    if (status === 'ZERO_RESULTS') throw new Error('Không thể tìm thấy tuyến đường giữa hai địa điểm.');
    if (status === 'MAX_ROUTE_LENGTH_EXCEEDED') throw new Error('Khoảng cách quá lớn để tính toán.');
    throw new Error(`Không thể tính toán khoảng cách. Lỗi: ${status}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error_message || error.message;
    const status = error.response?.status;
    console.error(`Lỗi Goong Distance Matrix (${status}):`, errorMsg);
    if (status === 403) throw new Error(`Lỗi xác thực Goong API. Vui lòng kiểm tra API Key.`);
    throw new Error(`Lỗi Goong Distance Matrix: ${errorMsg}`);
  }
};

const calculateShippingFee = (distance) => {
  if (distance <= 0) return 0;
  const FIRST_KM_FEE = 15000;
  const ADDITIONAL_KM_FEE = 2000;
  if (distance <= 1) return FIRST_KM_FEE;
  const fee = FIRST_KM_FEE + (distance - 1) * ADDITIONAL_KM_FEE;
  return Math.round(fee / 1000) * 1000;
};

const getShippingDetails = async (fromAddress, toAddress, isReturn = false) => {
  try {
    const [fromLocation, toLocation] = await Promise.all([geocodeAddress(fromAddress), geocodeAddress(toAddress)]);
    const distance = await calculateDistance(fromLocation, toLocation);
    let fee = calculateShippingFee(distance);
    if (isReturn) fee = Math.round((fee * 1.5) / 1000) * 1000;
    return { shippingFee: fee, distance };
  } catch (error) {
    console.error(`Lỗi trong quá trình getShippingDetails: ${error.message}`);
    throw error;
  }
};

const fetchAndValidateProductVariation = async (itemData) => {
  const { productId, quantity, size, color } = itemData;
  try {
    const product = await ProductModel.findOne({ productId: productId });
    if (!product) return { error: `Sản phẩm với ID ${productId} không tồn tại.`, product: null, variation: null };
    const variation = product.variations?.find((v) => v.size === size && v.color === color);
    if (!variation)
      return {
        error: `Sản phẩm ${product.name} (ID: ${productId}) không có biến thể size '${size}', color '${color}'.`,
        product,
        variation: null,
      };
    if (variation.amount < quantity)
      return {
        error: `Sản phẩm ${product.name} (${size}/${color}) chỉ còn ${variation.amount} sản phẩm, không đủ ${quantity} sản phẩm.`,
        product,
        variation,
      };
    return { error: null, product, variation };
  } catch (error) {
    console.error(`Lỗi khi truy vấn/kiểm tra sản phẩm/biến thể cho productId ${productId}:`, error);
    throw new Error(`Lỗi cơ sở dữ liệu khi kiểm tra sản phẩm ${productId}.`);
  }
};

const saveOrderToDatabase = async (orderData) => {
  try {
    const newOrder = new OrderModel(orderData);
    const savedOrder = await newOrder.save();
    console.log('Đơn hàng đã lưu vào DB với ID:', savedOrder._id);
    return savedOrder; // Trả về Mongoose document để có thể dùng .save() sau này
  } catch (dbError) {
    console.error('Lỗi khi lưu đơn hàng vào DB:', dbError);
    if (dbError instanceof mongoose.Error.ValidationError)
      throw new Error(`Lỗi dữ liệu khi lưu đơn hàng: ${dbError.message}`);
    if (dbError.code === 11000) throw new Error(`Lỗi trùng lặp dữ liệu khi lưu đơn hàng.`);
    throw new Error('Không thể lưu đơn hàng vào cơ sở dữ liệu.');
  }
};

const updateStockAfterOrder = async (orderedItems) => {
  if (!orderedItems || orderedItems.length === 0) {
    console.warn('Không có items hợp lệ để cập nhật kho.');
    return;
  }
  try {
    const bulkOps = orderedItems
      .map((item) => {
        // Kiểm tra xem productId có hợp lệ không
        if (
          !item.productId ||
          !mongoose.Types.ObjectId.isValid(item.productId) ||
          !item.productVariationId ||
          !mongoose.Types.ObjectId.isValid(item.productVariationId) ||
          !item.quantity ||
          item.quantity <= 0
        ) {
          console.warn('Item không hợp lệ để cập nhật kho:', item);
          return null; // Bỏ qua item không hợp lệ
        }
        return {
          updateOne: {
            filter: {
              _id: item.productId,
              'variations._id': item.productVariationId,
              'variations.amount': { $gte: item.quantity },
            }, // Thêm điều kiện kiểm tra số lượng
            update: { $inc: { 'variations.$.amount': -item.quantity } },
          },
        };
      })
      .filter((op) => op !== null); // Lọc bỏ các operation null

    if (bulkOps.length > 0) {
      // bulk write là phương thức để thực hiện nhiều cập nhật trong một lần gọi
      console.log('Thực hiện bulk update kho:', JSON.stringify(bulkOps, null, 2));
      const result = await ProductModel.bulkWrite(bulkOps);
      console.log('Kết quả cập nhật kho:', result);
      // Kiểm tra xem có operation nào thất bại không (do hết hàng sau khi kiểm tra ban đầu)
      if (result.modifiedCount < bulkOps.length) {
        console.warn('Một số cập nhật kho có thể đã thất bại do thay đổi số lượng tồn.');
        // Có thể thêm logic xử lý phức tạp hơn ở đây nếu cần
      }
    } else {
      console.warn('Không có operations hợp lệ để cập nhật kho.');
    }
  } catch (error) {
    console.error('LỖI NGHIÊM TRỌNG: Không thể cập nhật tồn kho sau khi đặt hàng:', error);
    // Cân nhắc: Không throw lỗi ở đây để không chặn response, nhưng cần log và thông báo admin
  }
};

// --- API Endpoint: Create Order ---
export const createOrder = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ error: 'Xác thực thất bại. Vui lòng đăng nhập.' });

  const { customerName, customerPhone, toAddress, items, paymentMethod, note = '', isReturn = false } = req.body;
  const fromAddress = DEFAULT_FROM_ADDRESS;

  // --- 1. Input Validation ---
  let errors = [];
  if (!customerName) errors.push('Thiếu tên khách hàng.');
  if (!customerPhone) errors.push('Thiếu số điện thoại khách hàng.');
  if (!toAddress) errors.push('Thiếu địa chỉ giao hàng.');
  if (!paymentMethod) errors.push('Thiếu phương thức thanh toán.');
  else if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod))
    errors.push(`Phương thức thanh toán không hợp lệ. Chỉ chấp nhận: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`);
  if (!items || !Array.isArray(items) || items.length === 0) errors.push('Danh sách sản phẩm không hợp lệ hoặc rỗng.');
  else {
    items.forEach((item, index) => {
      const itemLabel = `Sản phẩm thứ ${index + 1}`;
      if (!item.productId || typeof item.productId !== 'number')
        errors.push(`${itemLabel}: Thiếu hoặc sai định dạng productId.`);
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity))
        errors.push(`${itemLabel}: Số lượng không hợp lệ.`);
      if (!item.size || typeof item.size !== 'string') errors.push(`${itemLabel}: Thiếu hoặc sai định dạng 'size'.`);
      if (!item.color || typeof item.color !== 'string') errors.push(`${itemLabel}: Thiếu hoặc sai định dạng 'color'.`);
    });
  }
  if (errors.length > 0) return res.status(400).json({ error: 'Dữ liệu yêu cầu không hợp lệ.', details: errors });

  // --- 2. Process Order ---
  let savedOrderDoc; // Sử dụng biến này để lưu document Mongoose
  try {
    let subtotal = 0;
    const validatedOrderItems = [];
    const itemsForStockUpdate = [];

    // --- 2a. Fetch Products, Validate Variations & Stock, Calculate Subtotal ---
    const validationPromises = items.map((item) => fetchAndValidateProductVariation(item));
    const validationResults = await Promise.all(validationPromises);
    const validationErrors = validationResults.filter((result) => result.error);
    if (validationErrors.length > 0) {
      const errorDetails = validationErrors.map((errResult) => errResult.error);
      let statusCode = 400;
      const isNotFound = validationErrors.every((e) => e.error.includes('không tồn tại'));
      const isOutOfStock = validationErrors.some((e) => e.error.includes('không đủ'));
      if (isNotFound && !isOutOfStock) statusCode = 404;
      return res
        .status(statusCode)
        .json({ error: 'Một hoặc nhiều sản phẩm không hợp lệ hoặc không đủ hàng.', details: errorDetails });
    }

    for (let i = 0; i < validationResults.length; i++) {
      const { product, variation } = validationResults[i];
      const itemRequestData = items[i];
      const itemTotal = product.price * itemRequestData.quantity;
      subtotal += itemTotal;
      validatedOrderItems.push({
        productId: product.productId, // Include productId
        images: product.images.map((image) => ({
          url: image.url,
          isPrimary: image.isPrimary || false,
          order: image.order || null,
          publicId: image.publicId || null,
        })), // Include product images
        name: product.name, // Include product name
        productVariationId: variation._id,
        size: variation.size, // Include size
        color: variation.color, // Include color
        price: product.price,
        quantity: itemRequestData.quantity,
      });
      itemsForStockUpdate.push({
        productId: product._id,
        productVariationId: variation._id,
        quantity: itemRequestData.quantity,
      });
    }

    // --- 2b. Calculate Shipping Fee ---
    const { shippingFee, distance } = await getShippingDetails(fromAddress, toAddress, isReturn);

    // --- 2c. Calculate Total Amount ---
    const totalAmount = subtotal + shippingFee;
    const exchangeRate = 23000; // Tỷ giá ví dụ
    const totalAmountUSD = (totalAmount / exchangeRate).toFixed(2);

    // --- 3. Prepare Order Data ---
    const newOrderData = {
      userId: userId,
      totalPrice: totalAmount,
      status: 'Pending',
      items: validatedOrderItems,
      payment: { method: paymentMethod, transactionId: null, status: 'Pending' },
      shippingAddress: {
        fullName: customerName,
        phone: customerPhone,
        address: toAddress,
        shippingFee: shippingFee, // Include shipping fee
        distance: distance, // Include distance
      },
    };

    console.log('newOrderData trước khi lưu:', JSON.stringify(newOrderData, null, 2));

    // --- 4. Save Order ---
    // Lưu document Mongoose vào biến savedOrderDoc
    const newOrder = new OrderModel(newOrderData);
    savedOrderDoc = await newOrder.save();
    console.log('Đơn hàng đã lưu vào DB với ID:', savedOrderDoc._id);

    // --- 5. Handle Payment Method ---
    if (paymentMethod === 'Paypal') {
      try {
        try {
          await CartModel.findOneAndUpdate(
            { userId: userId },
            { $pull: { items: { productId: { $in: validatedOrderItems.map((item) => item.productId) } } } },
            { new: true }
          );
          console.log('Đã xóa các sản phẩm đã đặt khỏi giỏ hàng.');
        } catch (cartError) {
          console.error('Lỗi khi xóa sản phẩm khỏi giỏ hàng:', cartError);
        }

        // Tạo thanh toán PayPal
        const { approvalUrl, paypalOrderId } = await createPayPalOrderAPI(
          totalAmountUSD,
          `Thanh toán đơn hàng ${savedOrderDoc._id}`,
          savedOrderDoc._id.toString(),
          `${req.protocol}://${req.get('host')}/payment/paypal/success`, // URL động
          `${req.protocol}://${req.get('host')}/payment/paypal/cancel` // URL động
        );

        // Cập nhật đơn hàng với PayPal Order ID (để tham chiếu sau này nếu cần)
        savedOrderDoc.payment.transactionId = paypalOrderId; // Lưu PayPal Order ID
        await savedOrderDoc.save(); // Lưu lại đơn hàng

        return res.status(201).json({
          message: 'Đơn hàng đã được tạo. Chuyển hướng đến PayPal để thanh toán.',
          order: savedOrderDoc.toObject(), // Trả về plain object
          paymentUrl: approvalUrl,
        });
      } catch (paypalError) {
        console.error('Lỗi khi khởi tạo thanh toán PayPal:', paypalError);
        await OrderModel.findByIdAndDelete(savedOrderDoc._id);
        console.log(`Đã xóa đơn hàng ${savedOrderDoc._id} do lỗi PayPal.`);
        return res.status(500).json({ error: 'Không thể khởi tạo thanh toán PayPal', details: paypalError.message });
      }
    } else if (paymentMethod === 'Cash') {
      // Cập nhật trạng thái và payment status cho đơn COD
      savedOrderDoc.status = 'Pending';
      savedOrderDoc.payment.status = 'Pending'; // Vẫn là Pending cho COD
      const updatedOrder = await savedOrderDoc.save();

      // Cập nhật kho hàng cho đơn COD
      await updateStockAfterOrder(itemsForStockUpdate);

      // --- 6. Clear Cart After Successful Order ---
      try {
        await CartModel.findOneAndUpdate(
          { userId: userId },
          { $pull: { items: { productId: { $in: validatedOrderItems.map((item) => item.productId) } } } },
          { new: true }
        );
        console.log('Đã xóa các sản phẩm đã đặt khỏi giỏ hàng.');
      } catch (cartError) {
        console.error('Lỗi khi xóa sản phẩm khỏi giỏ hàng:', cartError);
      }

      res.status(201).json({
        message: 'Đặt hàng thành công!',
        order: updatedOrder.toObject(), // Trả về plain object
      });
    } else {
      // Rollback nếu phương thức không hỗ trợ
      await OrderModel.findByIdAndDelete(savedOrderDoc._id);
      console.log(`Đã xóa đơn hàng ${savedOrderDoc._id} do phương thức thanh toán không hỗ trợ.`);
      return res.status(400).json({ error: 'Phương thức thanh toán không được hỗ trợ.' });
    }
  } catch (error) {
    console.error('!!! Lỗi trong API createOrder:', error);
    // Rollback nếu lỗi xảy ra sau khi tạo đơn hàng (trừ lỗi đã xử lý của PayPal)
    if (savedOrderDoc && !error.message.includes('PayPal')) {
      try {
        await OrderModel.findByIdAndDelete(savedOrderDoc._id);
        console.log(`Đã xóa đơn hàng ${savedOrderDoc._id} do có lỗi xảy ra trong quá trình xử lý.`);
      } catch (deleteError) {
        console.error(`Lỗi khi xóa đơn hàng ${savedOrderDoc._id}:`, deleteError);
      }
    }
    // Trả về lỗi chung
    if (
      error.message.includes('Lỗi Goong') ||
      error.message.includes('Không thể xác định vị trí') ||
      error.message.includes('Không thể tính toán khoảng cách')
    ) {
      return res
        .status(400)
        .json({ error: 'Địa chỉ không hợp lệ hoặc lỗi hệ thống vận chuyển.', details: error.message });
    } else if (
      error.message.includes('Lỗi cơ sở dữ liệu khi kiểm tra sản phẩm') ||
      error.message.includes('Không thể lưu đơn hàng') ||
      error.message.includes('Lỗi dữ liệu khi lưu')
    ) {
      return res.status(500).json({ error: 'Lỗi máy chủ khi xử lý đơn hàng.', details: error.message });
    } else if (error.message.includes('Lỗi xác thực Goong API')) {
      return res.status(500).json({ error: 'Lỗi cấu hình hệ thống vận chuyển.', details: error.message });
    } else {
      return res
        .status(500)
        .json({ error: 'Lỗi máy chủ nội bộ không xác định khi xử lý đơn hàng.', details: error.message });
    }
  }
};

// --- API Endpoint: Get Shipping Fee ---
export const shippingFee = async (req, res) => {
  const { toAddress, isReturn = false } = req.body;
  if (!toAddress || typeof toAddress !== 'string' || toAddress.trim() === '') {
    return res
      .status(400)
      .json({ success: false, error: 'Địa chỉ không hợp lệ.', details: 'Vui lòng cung cấp địa chỉ giao hàng hợp lệ.' });
  }
  try {
    const result = await getShippingDetails(DEFAULT_FROM_ADDRESS, toAddress.trim(), isReturn);
    if (!result || typeof result.shippingFee !== 'number' || typeof result.distance !== 'number') {
      console.error('Lỗi logic: getShippingDetails trả về kết quả không hợp lệ mà không throw lỗi.', result);
      return res.status(500).json({
        success: false,
        error: 'Lỗi máy chủ nội bộ khi xử lý phí vận chuyển.',
        details: 'Kết quả tính toán không hợp lệ.',
      });
    }
    res
      .status(200)
      .json({ success: true, data: { totalFee: result.shippingFee, distance: `${result.distance.toFixed(2)} km` } });
  } catch (error) {
    console.error(`Lỗi khi lấy phí ship cho "${toAddress}":`, error);
    let statusCode = 500;
    let errorMessage = 'Lỗi máy chủ khi tính toán phí vận chuyển.';
    let errorDetails = error.message || 'Lỗi không xác định.';
    const msg = error.message.toLowerCase();
    if (msg.includes('không thể xác định vị trí') || msg.includes('geocode')) {
      statusCode = 400;
      errorMessage = 'Không thể tìm thấy địa chỉ.';
      errorDetails = `Không thể xác định vị trí cho địa chỉ: ${toAddress}`;
    } else if (
      msg.includes('không thể tính toán khoảng cách') ||
      msg.includes('distance matrix') ||
      msg.includes('không thể tìm thấy tuyến đường')
    ) {
      statusCode = 400;
      errorMessage = 'Không thể tính khoảng cách.';
      errorDetails = `Không thể tính toán tuyến đường giữa "${DEFAULT_FROM_ADDRESS}" và "${toAddress}".`;
    } else if (msg.includes('lỗi xác thực goong api') || msg.includes('api key')) {
      statusCode = 500;
      errorMessage = 'Lỗi cấu hình hệ thống vận chuyển.';
      errorDetails = 'Lỗi xác thực với dịch vụ bản đồ.';
    } else if (error instanceof mongoose.Error) {
      statusCode = 500;
      errorMessage = 'Lỗi cơ sở dữ liệu.';
      errorDetails = 'Lỗi truy vấn dữ liệu.';
    }
    res.status(statusCode).json({ success: false, error: errorMessage, details: errorDetails });
  }
};

// --- API Endpoint: Xử lý Callback PayPal thành công ---
export const paypalSuccess = async (req, res) => {
  const paypalOrderIdFromToken = req.query.token; // PayPal Order ID từ query 'token'
  const internalOrderId = req.query.orderId;

  if (!paypalOrderIdFromToken || !internalOrderId) {
    console.error('Thiếu thông tin token (PayPal Order ID) hoặc orderId trong callback PayPal success');
    return res.redirect(
      `http://localhost:5173/payment/error?message=InvalidCallbackData&orderId=${internalOrderId || 'unknown'}`
    );
  }

  console.log(
    `PayPal Success Callback - Internal Order ID: ${internalOrderId}, PayPal Order ID: ${paypalOrderIdFromToken}`
  );
  let order;
  try {
    order = await OrderModel.findById(internalOrderId);
    if (!order) {
      console.error(`Không tìm thấy đơn hàng với ID: ${internalOrderId}`);
      return res.redirect(`http://localhost:5173/payment/error?message=OrderNotFound&orderId=${internalOrderId}`);
    }
    if (order.status !== 'Pending' || order.payment.status !== 'Pending') {
      console.warn(
        `Đơn hàng ${internalOrderId} đã được xử lý hoặc trạng thái không hợp lệ (${order.status}, ${order.payment.status}).`
      );
      return res.redirect(`http://localhost:5173/order-details/${internalOrderId}?status=already_processed`);
    }

    // Capture the PayPal payment using the PayPal Order ID
    const captureData = await capturePayPalPaymentAPI(paypalOrderIdFromToken);

    if (captureData.status === 'COMPLETED') {
      console.log(`Thanh toán PayPal thành công cho Internal Order ID: ${internalOrderId}`);
      const paypalTransactionId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || captureData.id;

      // Update order and payment status
      order.status = 'Pending';
      order.payment.status = 'Completed';
      order.payment.transactionId = paypalTransactionId; // Lưu ID giao dịch capture
      await order.save();
      console.log(`Đã cập nhật trạng thái đơn hàng ${internalOrderId} thành công.`);

      // Update stock levels
      const itemsForStockUpdate = await Promise.all(
        order.items.map(async (item) => {
          const product = await ProductModel.findOne({ 'variations._id': item.productVariationId }, { _id: 1 }).lean();
          if (!product) {
            console.warn(
              `Không tìm thấy sản phẩm cho variationId: ${item.productVariationId} trong đơn hàng ${internalOrderId}`
            );
            return null;
          }
          return { productId: product._id, productVariationId: item.productVariationId, quantity: item.quantity };
        })
      );
      const validItemsForStockUpdate = itemsForStockUpdate.filter((item) => item !== null);
      if (validItemsForStockUpdate.length > 0) {
        await updateStockAfterOrder(validItemsForStockUpdate);
      } else {
        console.warn(`Không có sản phẩm hợp lệ để cập nhật kho cho đơn hàng ${internalOrderId}`);
      }

      // Redirect to frontend success page
      res.redirect(`http://localhost:5173/checkout/success?orderId=${internalOrderId}`);
    } else {
      console.error(
        `Capture thanh toán PayPal không thành công cho đơn hàng ${internalOrderId}. Status:`,
        captureData.status
      );
      order.status = 'Cancelled';
      order.payment.status = 'Failed';
      await order.save();
      res.redirect(`http://localhost:5173/payment/error?message=PaymentCaptureFailed&orderId=${internalOrderId}`);
    }
  } catch (error) {
    console.error(`Lỗi khi xử lý callback PayPal success cho đơn hàng ${internalOrderId}:`, error);
    if (order) {
      try {
        if (order.status === 'Pending' && order.payment.status === 'Pending') {
          await OrderModel.findByIdAndUpdate(internalOrderId, { status: 'Cancelled', 'payment.status': 'Failed' });
          console.log(`Đã cập nhật trạng thái đơn hàng ${internalOrderId} thành Failed do lỗi callback.`);
        }
      } catch (updateError) {
        console.error(`Lỗi khi cập nhật trạng thái đơn hàng ${internalOrderId} thành Failed:`, updateError);
      }
    }
    res.redirect(`http://localhost:5173/payment/error?message=ProcessingError&orderId=${internalOrderId || 'unknown'}`);
  }
};

// --- API Endpoint: Xử lý Callback PayPal hủy ---
export const paypalCancel = async (req, res) => {
  const internalOrderId = req.query.orderId;
  console.log(`Thanh toán PayPal bị hủy cho đơn hàng ID: ${internalOrderId}`);

  if (!internalOrderId) {
    console.warn('Callback hủy PayPal không có orderId.');
    return res.redirect(`http://localhost:5173/payment/cancel`);
  }

  try {
    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: internalOrderId, status: 'Pending' },
      { status: 'Cancelled', 'payment.status': 'Cancelled' },
      { new: true }
    );
    if (updatedOrder) {
      console.log(`Đã cập nhật trạng thái đơn hàng ${internalOrderId} thành Cancelled.`);
    } else {
      console.warn(`Không tìm thấy đơn hàng ${internalOrderId} ở trạng thái Pending để cập nhật thành Cancelled.`);
    }
  } catch (error) {
    console.error(`Lỗi khi cập nhật trạng thái đơn hàng ${internalOrderId} thành Cancelled:`, error);
  }
  res.redirect(`http://localhost:5173/payment/cancel?orderId=${internalOrderId}`);
};
