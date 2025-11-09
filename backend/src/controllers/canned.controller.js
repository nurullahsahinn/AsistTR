/**
 * Canned Responses Controller
 * Manages pre-defined message templates
 */

const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');

// Get all canned responses
async function getCannedResponses(req, res) {
  try {
    const { siteId, category } = req.query;
    
    let sql = `
      SELECT 
        cr.*,
        u.name as created_by_name
      FROM canned_responses cr
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (siteId) {
      sql += ` AND cr.site_id = $${paramCount}`;
      params.push(siteId);
      paramCount++;
    }
    
    if (category) {
      sql += ` AND cr.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    sql += ' ORDER BY cr.category, cr.title';
    
    const result = await query(sql, params);
    
    res.json({ cannedResponses: result.rows });
    
  } catch (error) {
    logger.error('GetCannedResponses error:', error);
    res.status(500).json({ error: 'Failed to fetch canned responses' });
  }
}

// Create canned response
async function createCannedResponse(req, res) {
  try {
    const { title, content, shortcut, category } = req.body;
    const siteId = req.user.site_id;
    const createdBy = req.user.id;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Check if shortcut already exists
    if (shortcut) {
      const existing = await query(
        'SELECT id FROM canned_responses WHERE site_id = $1 AND shortcut = $2',
        [siteId, shortcut]
      );
      
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Shortcut already exists' });
      }
    }
    
    const result = await query(`
      INSERT INTO canned_responses (site_id, title, content, shortcut, category, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [siteId, title, content, shortcut || null, category || 'common', createdBy]);
    
    logger.info(`Canned response created: ${title}`);
    
    res.status(201).json({
      message: 'Canned response created successfully',
      cannedResponse: result.rows[0]
    });
    
  } catch (error) {
    logger.error('CreateCannedResponse error:', error);
    res.status(500).json({ error: 'Failed to create canned response' });
  }
}

// Update canned response
async function updateCannedResponse(req, res) {
  try {
    const { id } = req.params;
    const { title, content, shortcut, category, is_active } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      params.push(content);
    }
    if (shortcut !== undefined) {
      updates.push(`shortcut = $${paramCount++}`);
      params.push(shortcut);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      params.push(category);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    params.push(id);
    
    const result = await query(`
      UPDATE canned_responses 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canned response not found' });
    }
    
    logger.info(`Canned response updated: ${id}`);
    
    res.json({
      message: 'Canned response updated successfully',
      cannedResponse: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdateCannedResponse error:', error);
    res.status(500).json({ error: 'Failed to update canned response' });
  }
}

// Delete canned response
async function deleteCannedResponse(req, res) {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM canned_responses WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canned response not found' });
    }
    
    logger.info(`Canned response deleted: ${id}`);
    
    res.json({ message: 'Canned response deleted successfully' });
    
  } catch (error) {
    logger.error('DeleteCannedResponse error:', error);
    res.status(500).json({ error: 'Failed to delete canned response' });
  }
}

module.exports = {
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse
};
