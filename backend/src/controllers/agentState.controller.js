/**
 * Agent State Controller
 * Manages agent availability states (online, away, busy, break, DND)
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Agent state types
const AGENT_STATES = {
  AVAILABLE: 'available',
  AWAY: 'away',
  BUSY: 'busy',
  BREAK: 'break',
  DND: 'dnd',  // Do Not Disturb
  OFFLINE: 'offline'
};

// State rules (can receive chats/calls)
const STATE_RULES = {
  available: {
    canReceiveCalls: true,
    canReceiveChats: true,
    autoResponse: null
  },
  busy: {
    canReceiveCalls: false,
    canReceiveChats: false,
    autoResponse: 'Şu anda meşgulüm, lütfen bekleyin.'
  },
  away: {
    canReceiveCalls: false,
    canReceiveChats: false,
    autoResponse: 'Şu anda uzaktayım, kısa süre içinde döneceğim.'
  },
  break: {
    canReceiveCalls: false,
    canReceiveChats: false,
    autoResponse: 'Moladayım, {duration} dakika sonra döneceğim.'
  },
  dnd: {
    canReceiveCalls: false,
    canReceiveChats: false,
    autoResponse: 'Lütfen rahatsız etmeyin. Acil durumlar için başka bir temsilciye bağlanabilirsiniz.'
  },
  offline: {
    canReceiveCalls: false,
    canReceiveChats: false,
    autoResponse: null
  }
};

/**
 * Get agent state
 */
async function getAgentState(req, res) {
  try {
    const agentId = req.user.id;

    const result = await query(`
      SELECT state, state_message, state_until, break_start, status
      FROM agents_presence
      WHERE agent_id = $1
    `, [agentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent presence not found' });
    }

    const agentState = result.rows[0];
    const stateRules = STATE_RULES[agentState.state] || STATE_RULES.available;

    res.json({
      state: agentState.state,
      stateMessage: agentState.state_message,
      stateUntil: agentState.state_until,
      breakStart: agentState.break_start,
      status: agentState.status,
      rules: stateRules
    });

  } catch (error) {
    logger.error('GetAgentState error:', error);
    res.status(500).json({ error: 'Failed to get agent state' });
  }
}

/**
 * Update agent state
 */
async function updateAgentState(req, res) {
  try {
    const agentId = req.user.id;
    const { state, stateMessage, durationMinutes } = req.body;

    // Validate state
    if (!Object.values(AGENT_STATES).includes(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    let stateUntil = null;
    let breakStart = null;

    // Calculate state_until for break
    if (state === AGENT_STATES.BREAK && durationMinutes) {
      stateUntil = new Date();
      stateUntil.setMinutes(stateUntil.getMinutes() + durationMinutes);
      breakStart = new Date();
    }

    // Update state
    const result = await query(`
      UPDATE agents_presence
      SET state = $1, 
          state_message = $2, 
          state_until = $3,
          break_start = $4
      WHERE agent_id = $5
      RETURNING *
    `, [state, stateMessage, stateUntil, breakStart, agentId]);

    if (result.rows.length === 0) {
      // Create if not exists
      await query(`
        INSERT INTO agents_presence (agent_id, state, state_message, state_until, break_start, status)
        VALUES ($1, $2, $3, $4, $5, 'online')
      `, [agentId, state, stateMessage, stateUntil, breakStart]);
    }

    // Broadcast state change to all agents
    const io = global.socketIO;
    if (io) {
      io.emit('agent:state:changed', {
        agentId,
        state,
        stateMessage,
        stateUntil
      });
    }

    logger.info(`Agent ${agentId} state changed to: ${state}`);

    res.json({
      message: 'Agent state updated',
      state,
      stateUntil,
      rules: STATE_RULES[state]
    });

  } catch (error) {
    logger.error('UpdateAgentState error:', error);
    res.status(500).json({ error: 'Failed to update agent state' });
  }
}

/**
 * Get all agents states (for admin/monitoring)
 */
async function getAllAgentsStates(req, res) {
  try {
    const { siteId } = req.query;

    let query_str = `
      SELECT 
        u.id, u.name, u.email, u.role,
        ap.state, ap.state_message, ap.state_until, ap.break_start,
        ap.status, ap.last_seen,
        u.current_chats, u.max_chats
      FROM users u
      JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.role IN ('agent', 'admin')
    `;

    const params = [];

    if (siteId) {
      query_str += ` AND (u.site_id = $1 OR u.site_id IS NULL)`;
      params.push(siteId);
    }

    query_str += ` ORDER BY ap.status DESC, u.name ASC`;

    const result = await query(query_str, params);

    // Add state rules to each agent
    const agentsWithRules = result.rows.map(agent => ({
      ...agent,
      rules: STATE_RULES[agent.state] || STATE_RULES.available
    }));

    res.json({
      agents: agentsWithRules
    });

  } catch (error) {
    logger.error('GetAllAgentsStates error:', error);
    res.status(500).json({ error: 'Failed to get agents states' });
  }
}

/**
 * Auto-check and reset expired break states
 */
async function checkExpiredStates() {
  try {
    const expired = await query(`
      SELECT agent_id, state
      FROM agents_presence
      WHERE state_until IS NOT NULL 
        AND state_until < NOW()
        AND state IN ('break', 'away')
    `);

    for (const agent of expired.rows) {
      // Reset to available
      await query(`
        UPDATE agents_presence
        SET state = 'available', 
            state_message = NULL, 
            state_until = NULL,
            break_start = NULL
        WHERE agent_id = $1
      `, [agent.agent_id]);

      // Broadcast state change
      const io = global.socketIO;
      if (io) {
        io.emit('agent:state:changed', {
          agentId: agent.agent_id,
          state: 'available',
          stateMessage: null,
          stateUntil: null
        });
      }

      logger.info(`Agent ${agent.agent_id} state auto-reset to available (expired ${agent.state})`);
    }

    if (expired.rows.length > 0) {
      logger.info(`Reset ${expired.rows.length} expired agent states`);
    }

  } catch (error) {
    logger.error('CheckExpiredStates error:', error);
  }
}

// Run expired state check every minute
setInterval(checkExpiredStates, 60000);

/**
 * Start break
 */
async function startBreak(req, res) {
  try {
    const agentId = req.user.id;
    const { durationMinutes = 15, message } = req.body;

    const stateUntil = new Date();
    stateUntil.setMinutes(stateUntil.getMinutes() + durationMinutes);

    await query(`
      UPDATE agents_presence
      SET state = 'break',
          state_message = $1,
          state_until = $2,
          break_start = NOW()
      WHERE agent_id = $3
    `, [message || `${durationMinutes} dakika mola`, stateUntil, agentId]);

    // Broadcast
    const io = global.socketIO;
    if (io) {
      io.emit('agent:state:changed', {
        agentId,
        state: 'break',
        stateMessage: message,
        stateUntil
      });
    }

    logger.info(`Agent ${agentId} started break for ${durationMinutes} minutes`);

    res.json({
      message: 'Break started',
      durationMinutes,
      stateUntil
    });

  } catch (error) {
    logger.error('StartBreak error:', error);
    res.status(500).json({ error: 'Failed to start break' });
  }
}

/**
 * End break early
 */
async function endBreak(req, res) {
  try {
    const agentId = req.user.id;

    await query(`
      UPDATE agents_presence
      SET state = 'available',
          state_message = NULL,
          state_until = NULL,
          break_start = NULL
      WHERE agent_id = $1
    `, [agentId]);

    // Broadcast
    const io = global.socketIO;
    if (io) {
      io.emit('agent:state:changed', {
        agentId,
        state: 'available',
        stateMessage: null,
        stateUntil: null
      });
    }

    logger.info(`Agent ${agentId} ended break early`);

    res.json({
      message: 'Break ended',
      state: 'available'
    });

  } catch (error) {
    logger.error('EndBreak error:', error);
    res.status(500).json({ error: 'Failed to end break' });
  }
}

module.exports = {
  getAgentState,
  updateAgentState,
  getAllAgentsStates,
  startBreak,
  endBreak,
  checkExpiredStates,
  AGENT_STATES,
  STATE_RULES
};







