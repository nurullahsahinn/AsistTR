/**
 * Department Management Routes
 */

const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(['admin']));

// Get all departments
router.get('/', departmentController.getDepartments);

// Get single department
router.get('/:departmentId', departmentController.getDepartment);

// Create department
router.post('/', departmentController.createDepartment);

// Update department
router.put('/:departmentId', departmentController.updateDepartment);

// Delete department
router.delete('/:departmentId', departmentController.deleteDepartment);

module.exports = router;
