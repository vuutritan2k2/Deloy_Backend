import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';
import ProductModel from '../models/productModel.js';
import OrderModel from '../models/orderModel.js';
import axios from 'axios';
import { EventSource } from 'eventsource';
import { createParser } from 'eventsource-parser';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Cấu hình Model ---
const generationConfig = {
  // temperature: 0.9, // Điều chỉnh nếu cần
};

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

// !!!!! ĐỊNH NGHĨA MODEL Ở PHẠM VI MODULE !!!!!
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-001', // <<< THAY ĐỔI Ở ĐÂY
  safetySettings,
});

// --- System Prompt ---
const systemPrompt = `
Bạn là một trợ lý AI hữu ích cho trang thương mại điện tử "My Awesome Shop". Nhiệm vụ chính là hiểu yêu cầu của người dùng bằng tiếng Việt (vi) hoặc tiếng Anh (en) và phân loại vào một trong các ý định (intent): "find_product", "place_order", "check_order", "greeting".

Dựa vào truy vấn, hãy xác định ngôn ngữ ("vi" hoặc "en"). Nếu không chắc chắn, mặc định là "vi".

Trích xuất các thông tin (parameters) liên quan cho từng intent:
- find_product: parameters = {"keyword": "<từ khóa tìm kiếm>", "size": "<kích cỡ>", "color": "<màu sắc>"} (Tất cả các trường này có thể là null nếu người dùng không cung cấp).
- place_order: parameters = {"productName": "<tên sản phẩm>", "quantity": <số lượng>, "size": "<kích cỡ>", "color": "<màu sắc>"} (Cố gắng lấy đủ thông tin nhất có thể. Quantity mặc định là 1 nếu không rõ. Size/Color có thể là null).
- check_order: parameters = {"orderCode": "<mã đơn hàng>"} (Chỉ cần lấy mã đơn hàng).
- greeting: parameters = {} (Không cần tham số).

QUAN TRỌNG: Luôn luôn trả về kết quả dưới dạng một đối tượng JSON HỢP LỆ TUYỆT ĐỐI và CHỈ JSON. KHÔNG được bao gồm bất kỳ ký tự markdown nào (như \`\`\`), giải thích, lời chào, hay bất kỳ văn bản nào khác nằm ngoài cấu trúc JSON. Định dạng JSON phải là:
{"intent": "<Tên Intent>", "language": "<vi|en>", "parameters": { <các tham số đã trích xuất> }}

Ví dụ về kết quả mong đợi:
User: "Tìm áo thun màu đen size L" -> {"intent": "find_product", "language": "vi", "parameters": {"keyword": "áo thun", "size": "L", "color": "đen"}}
User: "I want to check order ORD-12345" -> {"intent": "check_order", "language": "en", "parameters": {"orderCode": "ORD-12345"}}
User: "Cho tôi đặt 2 cái quần jean xanh size M" -> {"intent": "place_order", "language": "vi", "parameters": {"productName": "quần jean xanh", "quantity": 2, "size": "M", "color": "xanh"}}
User: "Mua áo khoác" -> {"intent": "place_order", "language": "vi", "parameters": {"productName": "áo khoác", "quantity": 1, "size": null, "color": null}}
User: "Hello bot" -> {"intent": "greeting", "language": "en", "parameters": {}}
User: "Đơn hàng của tôi đâu rồi?" -> {"intent": "check_order", "language": "vi", "parameters": {"orderCode": null}}

Nếu không thể xác định được một cách chắc chắn intent hoặc thông tin quan trọng bị thiếu (ví dụ: không rõ mã đơn hàng khi hỏi kiểm tra), hãy trả về intent tương ứng nhưng với tham số là null. Nếu yêu cầu hoàn toàn không rõ ràng hoặc không liên quan đến các intent trên, hãy trả về intent="unknown".
`;

// Hàm xử lý chính (Đảm bảo tên hàm khớp với tên được import/sử dụng trong routes)
export async function chatWithAI(req, res) {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Biến 'model' đã được định nghĩa ở trên
    const chat = model.startChat({
      history: [], // Reset lịch sử mỗi lần gọi (có thể thay đổi nếu muốn nhớ ngữ cảnh)
      generationConfig: { maxOutputTokens: 500, ...generationConfig },
    });

    const prompt = systemPrompt + '\nUser: ' + userMessage;
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    console.log('Gemini Raw Response:', responseText);

    let aiData;
    let aiText; // Khai báo aiText ở đây
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Dùng regex greedy
      if (jsonMatch) {
        aiText = jsonMatch[0];
        console.log('Extracted JSON string:', aiText);
        aiData = JSON.parse(aiText);
      } else {
        // Nếu không khớp regex, thử parse trực tiếp (phòng trường hợp AI trả về JSON thuần)
        try {
          aiData = JSON.parse(responseText);
        } catch (directParseError) {
          console.error('Failed direct JSON parse as well:', directParseError);
          throw new Error('Response from AI is not valid JSON.');
        }
      }
    } catch (parseError) {
      console.error('Error parsing JSON from AI:', parseError);
      console.error('AI Response that failed:', responseText);
      return res.json({
        intent: 'error',
        language: 'vi',
        message: 'Xin lỗi, tôi đang gặp chút sự cố để hiểu yêu cầu của bạn. Bạn có thể thử lại được không?',
        data: {},
      });
    }

    const { intent, language = 'vi', parameters = {} } = aiData;
    console.log('Detected Intent:', intent, 'Language:', language, 'Parameters:', parameters);

    let replyMessage = '';
    let resultData = {};

    // --- SWITCH CASE XỬ LÝ INTENT (Giữ nguyên như code trước) ---
    switch (intent) {
      case 'find_product':
        const { keyword, size, color } = parameters;
        const queryConditions = {};
        const orConditions = [];

        if (keyword) {
          const regex = new RegExp(keyword, 'i');
          orConditions.push({ name: regex });
          orConditions.push({ description: regex });
        }

        if (orConditions.length > 0) queryConditions.$or = orConditions;

        const variationConditions = {};
        if (size) variationConditions['variations.size'] = new RegExp(size, 'i');
        if (color) variationConditions['variations.color'] = new RegExp(color, 'i');

        if (Object.keys(variationConditions).length > 0) {
          if (queryConditions.$or) {
            queryConditions.$and = [{ $or: queryConditions.$or }, variationConditions];
            delete queryConditions.$or;
          } else {
            Object.assign(queryConditions, variationConditions);
          }
        }

        console.log('MongoDB Query:', JSON.stringify(queryConditions));
        const products = await ProductModel.find(queryConditions).limit(5);

        if (products.length > 0) {
          const productNames = products.map((p) => p.name).join(', ');
          replyMessage =
            language === 'vi'
              ? `Tôi tìm thấy các sản phẩm sau phù hợp: ${productNames}.`
              : `I found the following matching products: ${productNames}.`;
          resultData.products = products.map((p) => ({
            _id: p._id,
            name: p.name,
            price: p.price,
            image: p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url,
          }));
        } else {
          replyMessage =
            language === 'vi'
              ? 'Xin lỗi, tôi không tìm thấy sản phẩm nào phù hợp với yêu cầu của bạn.'
              : 'Sorry, I could not find any products matching your request.';
        }
        break;

      case 'place_order':
        const { productName, quantity = 1, size: orderSize, color: orderColor } = parameters;
        if (productName) {
          const foundProduct = await ProductModel.findOne({ name: new RegExp(productName, 'i') });
          let productInfo = productName;
          if (foundProduct) productInfo = foundProduct.name;

          replyMessage =
            language === 'vi'
              ? `Đã ghi nhận yêu cầu đặt ${quantity} sản phẩm "${productInfo}"` +
              (orderSize ? ` size ${orderSize}` : '') +
              (orderColor ? ` màu ${orderColor}` : '') +
              '. Bạn có muốn thêm vào giỏ hàng không?'
              : `Noted your request to order ${quantity} of "${productInfo}"` +
              (orderSize ? ` size ${orderSize}` : '') +
              (orderColor ? ` color ${orderColor}` : '') +
              '. Would you like to add it to your cart?';
          resultData.orderInfo = parameters;
          if (foundProduct)
            resultData.foundProduct = {
              _id: foundProduct._id,
              name: foundProduct.name,
              price: foundProduct.price,
              image: foundProduct.images?.find((img) => img.isPrimary)?.url || foundProduct.images?.[0]?.url,
            };
        } else {
          replyMessage =
            language === 'vi'
              ? 'Bạn muốn đặt sản phẩm nào ạ? Vui lòng cung cấp tên sản phẩm.'
              : 'Which product would you like to order? Please provide the product name.';
        }
        break;

      case 'check_order':
        const { orderCode } = parameters;
        if (!orderCode) {
          replyMessage =
            language === 'vi'
              ? 'Vui lòng cung cấp mã đơn hàng bạn muốn kiểm tra.'
              : 'Please provide the order code you want to check.';
        } else {
          const order = await OrderModel.findOne({ orderCode: orderCode.trim() });
          if (order) {
            const statusVi = {
              pending: 'Đang chờ xử lý',
              processing: 'Đang xử lý',
              shipped: 'Đã giao hàng',
              delivered: 'Đã nhận hàng',
              cancelled: 'Đã hủy',
            };
            const currentStatus = language === 'vi' ? statusVi[order.status] || order.status : order.status;
            replyMessage =
              language === 'vi'
                ? `Đơn hàng ${order.orderCode} của bạn hiện có trạng thái: ${currentStatus}.`
                : `Your order ${order.orderCode} is currently: ${currentStatus}.`;
            resultData.order = {
              orderCode: order.orderCode,
              status: order.status,
              totalAmount: order.totalAmount,
              createdAt: order.createdAt,
            };
          } else {
            replyMessage =
              language === 'vi'
                ? `Xin lỗi, tôi không tìm thấy đơn hàng nào với mã "${orderCode}".`
                : `Sorry, I could not find an order with the code "${orderCode}".`;
          }
        }
        break;

      case 'greeting':
        replyMessage = language === 'vi' ? 'Chào bạn! Tôi có thể giúp gì cho bạn?' : 'Hello! How can I help you today?';
        break;

      case 'unknown':
      default: // Bao gồm cả trường hợp 'unknown' và các lỗi không mong muốn khác từ AI
        // Thay vì chỉ nói "không hiểu", hãy hướng dẫn người dùng
        replyMessage =
          language === 'vi'
            ? 'Xin lỗi, tôi chưa hiểu rõ yêu cầu đó. Tôi có thể giúp bạn tìm kiếm sản phẩm, hỗ trợ đặt hàng hoặc kiểm tra trạng thái đơn hàng. Bạn cần tôi giúp gì ạ?'
            : "Sorry, I didn't quite understand that request. I can help you find products, assist with placing an order, or check your order status. What would you like help with?";
        // Giữ intent là 'unknown' hoặc intent gốc mà AI trả về (nếu có)
        resultData = {}; // Không có dữ liệu cụ thể cho trường hợp này
        break;
    }
    res.json({
      intent: intent,
      language: language,
      message: replyMessage,
      data: resultData,
    });
  } catch (error) {
    console.error('💥💥💥 UNHANDLED ERROR in chat controller: 💥💥💥');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    res.status(500).json({ message: 'An internal server error occurred. Please check server logs for details.' });
  }
}


export async function chatWithCoze(req, res) {
  const { user_id, additional_messages } = req.body;

  try {
    const response = await axios.post(
      'https://api.coze.com/v3/chat',
      {
        bot_id: '7500453264618799105',
        user_id,
        stream: true,
        auto_save_history: true,
        additional_messages,
      },
      {
        headers: {
          Authorization: 'Bearer pat_VeeRGFeJx7dNapqQYuWdP2q3TZT7TktjaRgRgEVUCqipf9nrVxfaBMq02WiZLZmG',
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      }
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = []; // Mảng lưu trữ các message trả về
    console.log(messages)
    
    const parser = createParser({
      onEvent: (event) => {
        if (event.event === "conversation.message.completed") {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "answer" || data.type === "follow_up") {
              messages.push({
                data
              })
            }
          } catch (err) {
            console.error('❌ JSON parse lỗi:', err);
          }
        }
        // if (event.type === 'event' && event.event === 'conversation.message.completed') {
        //   try {
        //     const data = JSON.parse(event.data);
        //     console.log('Dat', data)
        //     if (data.type === 'answer' || data.type === 'follow_up') {
        //       messages.push({
        //         event: event.event,
        //         data,
        //       });
        //     }
        //   } catch (err) {
        //     console.error('❌ JSON parse lỗi:', err);
        //   }
        // }
      },
    });

    response.data.on('data', (chunk) => {
      parser.feed(chunk.toString());
      // Chuyển chunk thành chuỗi
      // const chunkStr = chunk.toString();

      // Tiến hành xử lý dữ liệu trong chunk
      // if (chunkStr.includes('event:')) {
      //   const eventIndex = chunkStr.indexOf('event:');
      //   const eventEndIndex = chunkStr.indexOf('\n', eventIndex);
      //   currentEvent = chunkStr.slice(eventIndex + 6, eventEndIndex).trim(); // Lấy event
      // }

      // if (chunkStr.includes('data:') && currentEvent === "conversation.message.completed") {
      //   const dataIndex = chunkStr.indexOf('data:');
      //   const dataEndIndex = chunkStr.indexOf('\n', dataIndex);
      //   const jsonData = chunkStr.slice(dataIndex + 5, dataEndIndex).trim(); // Lấy dữ liệu

      //   try {
      //     if (jsonData.includes('"type":"answer"') || jsonData.includes('"type":"follow_up"')) {
      //       const parsedData = JSON.parse(jsonData);

      //       // Gom nhóm event và data thành một đối tượng
      //       const message = {
      //         event: currentEvent,
      //         data: parsedData
      //       };

      //       // Đẩy message vào mảng
      //       messages.push(message);
      //     }
      //   } catch (err) {
      //     console.error('❌ Lỗi khi parse dữ liệu JSON:', err);
      //   }
      // }

    });

    response.data.on('end', () => {
      // Gửi dữ liệu về client khi stream kết thúc
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Connection', 'close'); // đảm bảo đóng kết nối
      res.write(JSON.stringify(messages));
      res.end();
    });


    response.data.on('error', (err) => {
      res.end();
    });

  } catch (err) {
    console.error('❌ Lỗi trong chatWithCoze:', err);
    res.status(500).json({ error: 'Lỗi từ proxy server' });
  }
}


