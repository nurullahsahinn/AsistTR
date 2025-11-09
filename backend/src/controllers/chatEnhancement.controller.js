/**
 * Chat Enhancement Controller
 * Handles tags, notes, ratings, and transfers
 */

const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');
const { transferConversation } = require('../services/routing.service');

// ===== TAGS =====

// Get all tags
async function getTags(req, res) {
  try {
    const { siteId } = req.query;
    
    let sql = 'SELECT * FROM chat_tags WHERE 1=1';
    const params = [];
    
    if (siteId) {
      sql += ' AND site_id = $1';
      params.push(siteId);
    }
    
    sql += ' ORDER BY name';
    
    const result = await query(sql, params);
    res.json({ tags: result.rows });
    
  } catch (error) {
    logger.error('GetTags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
}

// Create tag
async function createTag(req, res) {
  try {
    const { name, color } = req.body;
    const siteId = req.user.site_id;
    
    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    
    const result = await query(`
      INSERT INTO chat_tags (site_id, name, color)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [siteId, name, color || '#3B82F6']);
    
    logger.info(`Tag created: ${name}`);
    res.status(201).json({ tag: result.rows[0] });
    
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    logger.error('CreateTag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
}

// Add tag to conversation
async function addTagToConversation(req, res) {
  try {
    const { conversationId, tagId } = req.body;
    
    const result = await query(`
      INSERT INTO conversation_tags (conversation_id, tag_id)
      VALUES ($1, $2)
      RETURNING *
    `, [conversationId, tagId]);
    
    logger.info(`Tag added to conversation: ${conversationId}`);
    res.status(201).json({ conversationTag: result.rows[0] });
    
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Tag already added to this conversation' });
    }
    logger.error('AddTagToConversation error:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
}

// Remove tag from conversation
async function removeTagFromConversation(req, res) {
  try {
    const { conversationId, tagId } = req.params;
    
    const result = await query(
      'DELETE FROM conversation_tags WHERE conversation_id = $1 AND tag_id = $2 RETURNING id',
      [conversationId, tagId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found on this conversation' });
    }
    
    logger.info(`Tag removed from conversation: ${conversationId}`);
    res.json({ message: 'Tag removed successfully' });
    
  } catch (error) {
    logger.error('RemoveTagFromConversation error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
}

// Get tags for conversation
async function getConversationTags(req, res) {
  try {
    const { conversationId } = req.params;
    
    const result = await query(`
      SELECT ct.*, t.name, t.color
      FROM conversation_tags ct
      JOIN chat_tags t ON ct.tag_id = t.id
      WHERE ct.conversation_id = $1
      ORDER BY t.name
    `, [conversationId]);
    
    res.json({ tags: result.rows });
    
  } catch (error) {
    logger.error('GetConversationTags error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation tags' });
  }
}

// ===== NOTES =====

// Get notes for conversation
async function getConversationNotes(req, res) {
  try {
    const { conversationId } = req.params;
    
    const result = await query(`
      SELECT cn.*, u.name as agent_name
      FROM conversation_notes cn
      LEFT JOIN users u ON cn.agent_id = u.id
      WHERE cn.conversation_id = $1
      ORDER BY cn.created_at DESC
    `, [conversationId]);
    
    res.json({ notes: result.rows });
    
  } catch (error) {
    logger.error('GetConversationNotes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

// Create note
async function createNote(req, res) {
  try {
    const { conversationId } = req.params;
    const { note } = req.body;
    const agentId = req.user.id;
    
    if (!note) {
      return res.status(400).json({ error: 'Note content is required' });
    }
    
    const result = await query(`
      INSERT INTO conversation_notes (conversation_id, agent_id, note)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [conversationId, agentId, note]);
    
    logger.info(`Note added to conversation: ${conversationId}`);
    res.status(201).json({ note: result.rows[0] });
    
  } catch (error) {
    logger.error('CreateNote error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
}

// Update note
async function updateNote(req, res) {
  try {
    const { noteId } = req.params;
    const { note } = req.body;
    
    const result = await query(`
      UPDATE conversation_notes
      SET note = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [note, noteId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    logger.info(`Note updated: ${noteId}`);
    res.json({ note: result.rows[0] });
    
  } catch (error) {
    logger.error('UpdateNote error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
}

// ===== RATING & FEEDBACK =====

// Submit chat rating
async function submitRating(req, res) {
  try {
    const { conversationId } = req.params;
    const { rating, feedback_comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const result = await query(`
      UPDATE conversations
      SET rating = $1, feedback_comment = $2, feedback_created_at = NOW()
      WHERE id = $3
      RETURNING id, rating, feedback_comment
    `, [rating, feedback_comment || null, conversationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    logger.info(`Rating submitted for conversation: ${conversationId} - ${rating} stars`);
    res.json({ 
      message: 'Rating submitted successfully',
      conversation: result.rows[0]
    });
    
  } catch (error) {
    logger.error('SubmitRating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
}

// ===== CHAT TRANSFER =====

// Transfer chat to another agent
async function transferChat(req, res) {
  try {
    const { conversationId } = req.params;
    const { toAgentId, reason } = req.body;
    const fromAgentId = req.user.id;
    
    if (!toAgentId) {
      return res.status(400).json({ error: 'Target agent is required' });
    }
    
    // Use routing service for transfer
    await transferConversation(conversationId, fromAgentId, toAgentId);
    
    // Log transfer
    await query(`
      INSERT INTO chat_transfers (conversation_id, from_agent_id, to_agent_id, reason)
      VALUES ($1, $2, $3, $4)
    `, [conversationId, fromAgentId, toAgentId, reason || null]);
    
    // Notify via socket
    const io = global.socketIO;
    if (io) {
      const convResult = await query('SELECT site_id FROM conversations WHERE id = $1', [conversationId]);
      if (convResult.rows.length > 0) {
        io.to(`site:${convResult.rows[0].site_id}:agents`).emit('chat:transferred', {
          conversationId,
          fromAgentId,
          toAgentId
        });
      }
    }
    
    logger.info(`Chat transferred: ${conversationId} from ${fromAgentId} to ${toAgentId}`);
    res.json({ message: 'Chat transferred successfully' });
    
  } catch (error) {
    logger.error('TransferChat error:', error);
    res.status(400).json({ error: error.message || 'Failed to transfer chat' });
  }
}

// Get transfer history
async function getTransferHistory(req, res) {
  try {
    const { conversationId } = req.params;
    
    const result = await query(`
      SELECT 
        ct.*,
        from_agent.name as from_agent_name,
        to_agent.name as to_agent_name
      FROM chat_transfers ct
      LEFT JOIN users from_agent ON ct.from_agent_id = from_agent.id
      LEFT JOIN users to_agent ON ct.to_agent_id = to_agent.id
      WHERE ct.conversation_id = $1
      ORDER BY ct.transferred_at DESC
    `, [conversationId]);
    
    res.json({ transfers: result.rows });
    
  } catch (error) {
    logger.error('GetTransferHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
}

module.exports = {
  // Tags
  getTags,
  createTag,
  addTagToConversation,
  removeTagFromConversation,
  getConversationTags,
  
  // Notes
  getConversationNotes,
  createNote,
  updateNote,
  
  // Rating
  submitRating,
  
  // Transfer
  transferChat,
  getTransferHistory
};
