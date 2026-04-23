// =============================================================================
// chessAgent.js — AI agent layer. Calls the Anthropic API; no UI concerns.
// =============================================================================

import {
  boardToFEN,
  applyMove,
  isInCheck,
  parseAlgebraicMove,
  moveToAlgebraic,
} from './chessEngine.js';

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a chess engine playing as Black. You receive the board in FEN notation and the move history, and must reply with your next move.

RULES:
- Respond with ONLY a move in algebraic notation (e.g. e5, Nf6, O-O, exd5, Qxh7+).
- You may also respond with "resign" if the position is hopeless, or "draw" to offer a draw.
- Play strong, strategic chess.
- Consider tactics: forks, pins, skewers, discovered attacks.
- Consider strategy: centre control, piece activity, king safety, pawn structure.
- Do NOT include any explanation — just the move.`;

// ── Result types ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AgentResult
 * @property {'move'|'resign'|'draw'|'error'} type
 * @property {string}  [algebraic]   — SAN string for type === 'move'
 * @property {Object}  [move]        — internal move object for type === 'move'
 * @property {string}  [message]     — human-readable detail for 'error'
 */

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ask the AI agent for its best move as Black.
 *
 * @param {Array}   board       - 8×8 board array
 * @param {string}  castling    - FEN castling string
 * @param {string}  enpassant   - FEN en-passant square or '-'
 * @param {number}  halfmove    - half-move clock
 * @param {number}  fullmove    - full-move number
 * @param {string[]} history    - move history in SAN (alternating w/b)
 * @returns {Promise<AgentResult>}
 */
export async function requestAgentMove(board, castling, enpassant, halfmove, fullmove, history) {
  const fen      = boardToFEN(board, 'b', castling, enpassant, halfmove, fullmove);
  const moveList = formatMoveList(history);

  const userContent = `FEN: ${fen}\nMove history: ${moveList || '(game start)'}\n\nYou are Black. What is your best move?`;

  let rawMove;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 50,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { type: 'error', message: `API error ${response.status}: ${err}` };
    }

    const data = await response.json();
    rawMove = (data.content?.[0]?.text ?? '').trim();
  } catch (err) {
    return { type: 'error', message: `Network error: ${err.message}` };
  }

  // ── Interpret the raw response ──

  if (rawMove === 'resign') return { type: 'resign' };
  if (rawMove === 'draw')   return { type: 'draw' };

  const move = parseAlgebraicMove(rawMove, board, 'b', castling, enpassant);
  if (!move) return { type: 'error', message: `AI returned an illegal move: "${rawMove}"` };

  // Verify the move doesn't leave the AI's own king in check
  const { board: nb } = applyMove(board, move, 'b', castling);
  if (isInCheck(nb, 'b')) return { type: 'error', message: `AI move "${rawMove}" exposes its king` };

  const algebraic = moveToAlgebraic(move, board, 'b', castling, enpassant);
  return { type: 'move', algebraic, move };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoveList(history) {
  return history.map((san, i) => {
    if (i % 2 === 0) return `${Math.floor(i / 2) + 1}. ${san}`;
    return san;
  }).join(' ');
}
