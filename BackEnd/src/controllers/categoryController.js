// Tạo category

import { ROLE } from '../constant/index.js';
import CategoryModel from '../models/categoriesModel.js';

// GET /category
export const getAllCategory = async (req, res) => {
  try {
    const categories = await CategoryModel.find({});
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Cannot get categories', error: error.message });
  }
};

// POST /category/create
export const createCategory = async (req, res) => {
  const { type } = req.body;
  try {
    const category = new CategoryModel({ type });
    await category.save();

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Cannot create category', error: error.message });
  }
};

// PATCH /category/update
export const updateCategory = async (req, res) => {
  // Nhận categoryId từ body
  const { categoryId, type } = req.body;

  // Kiểm tra categoryId có tồn tại không
  const category = await CategoryModel.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      statusCode: 404,
      message: 'Category not found',
    });
  }

  try {
    // Cập nhật category
    category.type = type;
    await category.save();
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Cannot update category',
      error: error.message,
    });
  }
};

// DELETE /category/delete
export const deleteCategory = async (req, res) => {
  const { categoryId } = req.body;
  const role = req.headers.role;
  try {
    await CategoryModel.findByIdAndDelete(categoryId);
    res.status(204).json({ statusCode: 204, message: 'Delete category successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, message: 'Cannot delete category', error: error.message });
  }
};
