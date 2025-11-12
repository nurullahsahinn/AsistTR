/**
 * Department Management Controller
 * Manages departments and team organization
 */

const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');

// Get all departments
async function getDepartments(req, res) {
  try {
    const { siteId } = req.query;
    
    let sql = `
      SELECT 
        d.id,
        d.site_id,
        d.name,
        d.description,
        d.is_active,
        d.created_at,
        COUNT(u.id) as agent_count,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          )
        ) FILTER (WHERE u.id IS NOT NULL) as agents
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id
      WHERE 1=1
    `;
    
    const params = [];
    if (siteId) {
      sql += ' AND d.site_id = $1';
      params.push(siteId);
    }
    
    sql += ' GROUP BY d.id ORDER BY d.created_at DESC';
    
    const result = await query(sql, params);
    
    res.json({ departments: result.rows });
    
  } catch (error) {
    logger.error('GetDepartments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

// Get single department
async function getDepartment(req, res) {
  try {
    const { departmentId } = req.params;
    
    const deptResult = await query(`
      SELECT 
        d.*,
        COUNT(u.id) as agent_count
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id
      WHERE d.id = $1
      GROUP BY d.id
    `, [departmentId]);
    
    if (deptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Get agents in this department
    const agentsResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar_url,
        ap.status as online_status
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.department_id = $1
      ORDER BY u.name
    `, [departmentId]);
    
    res.json({ 
      department: {
        ...deptResult.rows[0],
        agents: agentsResult.rows
      }
    });
    
  } catch (error) {
    logger.error('GetDepartment error:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
}

// Create department
async function createDepartment(req, res) {
  try {
    const { name, description, is_active = true } = req.body;
    const siteId = req.user.site_id;
    
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    
    const result = await query(`
      INSERT INTO departments (site_id, name, description, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [siteId, name, description, is_active]);
    
    logger.info(`Department created: ${name} for site ${siteId}`);
    
    res.status(201).json({ 
      message: 'Department created successfully',
      department: result.rows[0]
    });
    
  } catch (error) {
    logger.error('CreateDepartment error:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
}

// Update department
async function updateDepartment(req, res) {
  try {
    const { departmentId } = req.params;
    const { name, description, is_active } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(departmentId);
    
    const result = await query(`
      UPDATE departments 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    logger.info(`Department updated: ${departmentId}`);
    
    res.json({ 
      message: 'Department updated successfully',
      department: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdateDepartment error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
}

// Delete department
async function deleteDepartment(req, res) {
  try {
    const { departmentId } = req.params;
    
    await transaction(async (client) => {
      // Check if department has agents
      const agentCheck = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE department_id = $1',
        [departmentId]
      );
      
      if (parseInt(agentCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete department with active agents. Please reassign them first.');
      }
      
      // Delete department
      const result = await client.query(
        'DELETE FROM departments WHERE id = $1 RETURNING id',
        [departmentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Department not found');
      }
    });
    
    logger.info(`Department deleted: ${departmentId}`);
    
    res.json({ message: 'Department deleted successfully' });
    
  } catch (error) {
    logger.error('DeleteDepartment error:', error);
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete department' });
  }
}

module.exports = {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
