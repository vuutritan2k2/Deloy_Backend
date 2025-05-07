import ProductModel from '../models/productModel.js';
import CategoryModel from '../models/categoriesModel.js';
import mongoose from 'mongoose';
import { ROLE } from '../constant/role.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

// Cấu hình bộ nhớ tạm cho multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Tạo sản phẩm
export const createProduct = async (request, response) => {
  try {
    const { name, price, description, categoryId, variations } = request.body;
    const imageFiles = request.files;
    if (!imageFiles || imageFiles.length === 0) {
      return response.status(400).json({ message: 'Vui lòng tải lên ít nhất một ảnh' });
    }

    // Hàm upload nhiều ảnh với metadata
    const uploadImages = async (files) => {
      const uploadPromises = files.map((file, index) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'products',
              allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
              format: 'webp',
              transformation: [
                { quality: 'auto', fetch_format: 'webp' },
                { width: 500, height: 500, crop: 'fill', gravity: 'auto' },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else
                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                  isPrimary: index === 0, // Mặc định ảnh đầu tiên là ảnh chính
                  order: index,
                });
            }
          );
          uploadStream.end(file.buffer);
        });
      });
      return Promise.all(uploadPromises);
    };

    const uploadedImages = await uploadImages(imageFiles);

    const newProduct = new ProductModel({
      name,
      price,
      description,
      images: uploadedImages,
      categoryId: new mongoose.Types.ObjectId(categoryId),
      variations: typeof variations === 'string' ? JSON.parse(variations) : variations,
    });

    const savedProduct = await newProduct.save();
    response.status(201).json(savedProduct);
  } catch (error) {
    console.error('Lỗi khi tạo sản phẩm:', error);
    response.status(500).json({
      message: 'Lỗi server',
      error: error.message,
    });
  }
};

// Lấy toàn bộ sản phẩm
export const getAllProducts = async (request, response) => {
  try {
    const page = parseInt(request.query.page) || 1;
    const perPage = parseInt(request.query.perPage);
    const search = request.query.search || ''; // Nếu không có search thì mặc định là rỗng
    const totalPages = await ProductModel.countDocuments();

    console.log('SEarch', search);

    if (page > perPage) {
      return response.status(404).json({
        message: 'Page not found',
        success: false,
        error: true,
      });
    }

    const query = {};

    // Nếu có giá trị search, thêm điều kiện tìm kiếm vào query
    if (search) {
      query.name = { $regex: search, $options: 'i' }; // Tìm tên sản phẩm chứa chuỗi search (không phân biệt hoa thường)
    }

    const products = await ProductModel.find(query)
      .populate('categoryId')
      .skip((page - 1) * perPage)
      .limit(perPage)
      .exec();

    if (!products) {
      return response.status(500).json({
        error: true,
        success: false,
      });
    }

    response.status(200).json({
      data: products,
      totalPage: totalPages,
      page: page,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
};

// Lấy toàn bộ sản phẩm trong từng danh mục (categoryId)
export const getAllProductsByCategoryId = async (req, res) => {
  const { categoryId } = req.params;
  const { page, limit, sort, type, search } = req.query;

  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;
  const sortObject = { [sort]: type === 'DESC' ? -1 : 1 };

  // Điều kiện query chính
  const query = { categoryId };

  // Thêm tìm kiếm theo tên (hoặc mô tả nếu bạn muốn)
  if (search) {
    query.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  }

  try {
    const products = await ProductModel.find(query)
      .sort(sortObject)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate('categoryId'); // Lấy thông tin của category

    const totalProducts = await ProductModel.countDocuments({ categoryId });
    const totalPages = Math.ceil(totalProducts / limitNumber);

    res.status(200).json({
      data: products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Cannot get products', error: error.message });
  }
};

// Get Product Count
export const getAllProductsCount = async (request, response) => {
  try {
    const countProducts = await ProductModel.countDocuments();

    response.status(200).json({
      countProducts: countProducts,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
};

// Get Single Product
export const getSingleProduct = async (request, response) => {
  // Lấy ID sản phẩm từ request params
  const productId = request.params.id;
  try {
    // Tìm sản phẩm trong cơ sở dữ liệu

    const product = await ProductModel.findById(productId).populate('categoryId');

    if (product.categoryId.type === 'Sale') {
      product.price = product.price * 0.9;
    }

    // Nếu không tìm thấy sản phẩm, trả về lỗi 404
    if (!product) {
      return response.status(404).json({
        message: 'Product not found',
      });
    }

    // Trả về thông tin sản phẩm
    return response.status(200).json({
      data: product,
      message: 'Get product successfully',
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return response.status(500).json({
      message: 'Error fetching product',
      error: error.message,
    });
  }
};

// Delete Product
export const deleteProduct = async (request, response) => {
  try {
    // Tìm sản phẩm cần xóa
    const product = await ProductModel.findById(request.params.id).populate('categoryId');

    if (!product) {
      return response.status(404).json({
        message: 'Product not found',
      });
    }

    // Xóa các hình ảnh liên quan trên Cloudinary
    const deleteImages = async (images) => {
      const deletePromises = images.map(
        (image) => cloudinary.uploader.destroy(image.publicId) // Xóa hình ảnh bằng `publicId`
      );
      return Promise.all(deletePromises);
    };

    if (product.images && product.images.length > 0) {
      await deleteImages(product.images);
    }

    // Xóa sản phẩm khỏi cơ sở dữ liệu
    await ProductModel.findByIdAndDelete(request.params.id);

    return response.status(200).json({
      message: 'Delete product and associated images successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return response.status(500).json({
      message: 'Error deleting product',
      error: error.message,
    });
  }
};

// Update Product
export const updateProduct = async (request, response) => {
  try {
    const { name, price, description, imageUrl, categoryId, variations } = request.body;

    const product = await ProductModel.findByIdAndUpdate(request.params.id, {
      name,
      price,
      description,
      imageUrl,
      categoryId: new mongoose.Types.ObjectId(categoryId),
      variations,
    }).populate('categoryId');

    if (!product) {
      response.status(404).json({
        message: 'Product not found',
      });
    }

    response.status(200).json({
      message: 'Product Updated',
      success: true,
      error: false,
    });
  } catch (error) {
    response.status(500).json({
      message: error.message,
      success: false,
      error: true,
    });
  }
};
