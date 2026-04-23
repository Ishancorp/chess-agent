// =============================================================================
// chessEngine.js — Pure chess logic. No UI, no AI.
// =============================================================================

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// ── Board construction ────────────────────────────────────────────────────────

export function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  const backRow = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { piece: backRow[f], color: 'b' };
    board[1][f] = { piece: 'P',        color: 'b' };
    board[6][f] = { piece: 'P',        color: 'w' };
    board[7][f] = { piece: backRow[f], color: 'w' };
  }
  return board;
}

// ── Square helpers ────────────────────────────────────────────────────────────

export function parseSquare(sq) {
  return { r: 8 - parseInt(sq[1]), f: FILES.indexOf(sq[0]) };
}

export function squareName(r, f) {
  return FILES[f] + (8 - r);
}

export function isInBounds(r, f) {
  return r >= 0 && r < 8 && f >= 0 && f < 8;
}

// ── FEN serialisation ─────────────────────────────────────────────────────────

export function boardToFEN(board, turn, castling, enpassant, halfmove, fullmove) {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell) {
        empty++;
      } else {
        if (empty > 0) { fen += empty; empty = 0; }
        fen += cell.color === 'w' ? cell.piece : cell.piece.toLowerCase();
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += '/';
  }
  return `${fen} ${turn} ${castling || 'KQkq'} ${enpassant || '-'} ${halfmove ?? 0} ${fullmove ?? 1}`;
}

// ── ASCII board display ───────────────────────────────────────────────────────

export function boardToDisplay(board) {
  const lines = ['    a  b  c  d  e  f  g  h', '   +--+--+--+--+--+--+--+--+'];
  for (let r = 0; r < 8; r++) {
    let row = ` ${8 - r} |`;
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      row += cell ? ` ${cell.color === 'w' ? cell.piece : cell.piece.toLowerCase()}|` : ' ·|';
    }
    lines.push(row + ` ${8 - r}`);
    lines.push('   +--+--+--+--+--+--+--+--+');
  }
  lines.push('    a  b  c  d  e  f  g  h');
  return lines.join('\n');
}

// ── Move generation ───────────────────────────────────────────────────────────

export function getLegalMoves(board, color, castling, enpassant) {
  const moves = [];
  const opp = color === 'w' ? 'b' : 'w';

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell || cell.color !== color) continue;
      const { piece } = cell;

      // ── Pawns ──
      if (piece === 'P') {
        const dir    = color === 'w' ? -1 : 1;
        const startR = color === 'w' ? 6  : 1;
        if (isInBounds(r + dir, f) && !board[r + dir][f]) {
          moves.push({ from: squareName(r, f), to: squareName(r + dir, f), piece });
          if (r === startR && !board[r + 2 * dir][f])
            moves.push({ from: squareName(r, f), to: squareName(r + 2 * dir, f), piece });
        }
        for (const df of [-1, 1]) {
          if (!isInBounds(r + dir, f + df)) continue;
          if (board[r + dir][f + df]?.color === opp)
            moves.push({ from: squareName(r, f), to: squareName(r + dir, f + df), piece, capture: true });
          if (enpassant && squareName(r + dir, f + df) === enpassant)
            moves.push({ from: squareName(r, f), to: squareName(r + dir, f + df), piece, enpassant: true });
        }
      }

      // ── Sliding pieces ──
      const SLIDES = {
        R: [[0,1],[0,-1],[1,0],[-1,0]],
        B: [[1,1],[1,-1],[-1,1],[-1,-1]],
        Q: [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]],
      };
      if (SLIDES[piece]) {
        for (const [dr, df] of SLIDES[piece]) {
          let nr = r + dr, nf = f + df;
          while (isInBounds(nr, nf)) {
            if (board[nr][nf]) {
              if (board[nr][nf].color === opp)
                moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece, capture: true });
              break;
            }
            moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece });
            nr += dr; nf += df;
          }
        }
      }

      // ── Knights ──
      if (piece === 'N') {
        for (const [dr, df] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
          const nr = r + dr, nf = f + df;
          if (!isInBounds(nr, nf)) continue;
          if (!board[nr][nf])
            moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece });
          else if (board[nr][nf].color === opp)
            moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece, capture: true });
        }
      }

      // ── King (normal + castling) ──
      if (piece === 'K') {
        for (const [dr, df] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const nr = r + dr, nf = f + df;
          if (!isInBounds(nr, nf)) continue;
          if (!board[nr][nf])
            moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece });
          else if (board[nr][nf].color === opp)
            moves.push({ from: squareName(r, f), to: squareName(nr, nf), piece, capture: true });
        }
        if (color === 'w' && r === 7 && f === 4) {
          if (castling?.includes('K') && !board[7][5] && !board[7][6] && board[7][7]?.piece === 'R')
            moves.push({ from: 'e1', to: 'g1', piece, castle: 'K' });
          if (castling?.includes('Q') && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0]?.piece === 'R')
            moves.push({ from: 'e1', to: 'c1', piece, castle: 'Q' });
        }
        if (color === 'b' && r === 0 && f === 4) {
          if (castling?.includes('k') && !board[0][5] && !board[0][6] && board[0][7]?.piece === 'R')
            moves.push({ from: 'e8', to: 'g8', piece, castle: 'k' });
          if (castling?.includes('q') && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0]?.piece === 'R')
            moves.push({ from: 'e8', to: 'c8', piece, castle: 'q' });
        }
      }
    }
  }
  return moves;
}

// ── Move application ──────────────────────────────────────────────────────────

export function applyMove(board, move, color, castling) {
  const nb = board.map(row => row.map(c => c ? { ...c } : null));
  const { r: fr, f: ff } = parseSquare(move.from);
  const { r: tr, f: tf } = parseSquare(move.to);
  const piece = nb[fr][ff];

  nb[tr][tf] = piece;
  nb[fr][ff] = null;

  if (move.enpassant) {
    nb[color === 'w' ? tr + 1 : tr - 1][tf] = null;
  }

  if (move.castle) {
    if (move.castle === 'K') { nb[7][5] = nb[7][7]; nb[7][7] = null; }
    if (move.castle === 'Q') { nb[7][3] = nb[7][0]; nb[7][0] = null; }
    if (move.castle === 'k') { nb[0][5] = nb[0][7]; nb[0][7] = null; }
    if (move.castle === 'q') { nb[0][3] = nb[0][0]; nb[0][0] = null; }
  }

  if (piece.piece === 'P' && (tr === 0 || tr === 7))
    nb[tr][tf] = { piece: 'Q', color: piece.color };

  let nc = castling || 'KQkq';
  if (piece.piece === 'K')
    nc = color === 'w' ? nc.replace('K', '').replace('Q', '') : nc.replace('k', '').replace('q', '');
  if (piece.piece === 'R') {
    if (move.from === 'h1') nc = nc.replace('K', '');
    if (move.from === 'a1') nc = nc.replace('Q', '');
    if (move.from === 'h8') nc = nc.replace('k', '');
    if (move.from === 'a8') nc = nc.replace('q', '');
  }

  const nep = (piece.piece === 'P' && Math.abs(tr - fr) === 2)
    ? squareName((fr + tr) / 2, ff)
    : '-';

  return { board: nb, castling: nc || '-', enpassant: nep };
}

// ── Check / game-over detection ───────────────────────────────────────────────

export function isSquareAttacked(board, r, f, byColor) {
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const nr = r + pawnDir, nf = f + df;
    if (isInBounds(nr, nf) && board[nr][nf]?.piece === 'P' && board[nr][nf]?.color === byColor) return true;
  }
  for (const [dr, df] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
    const nr = r + dr, nf = f + df;
    if (isInBounds(nr, nf) && board[nr][nf]?.piece === 'N' && board[nr][nf]?.color === byColor) return true;
  }
  for (const [dr, df] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    let nr = r + dr, nf = f + df;
    while (isInBounds(nr, nf)) {
      if (board[nr][nf]) {
        if (board[nr][nf].color === byColor && (board[nr][nf].piece === 'R' || board[nr][nf].piece === 'Q')) return true;
        break;
      }
      nr += dr; nf += df;
    }
  }
  for (const [dr, df] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    let nr = r + dr, nf = f + df;
    while (isInBounds(nr, nf)) {
      if (board[nr][nf]) {
        if (board[nr][nf].color === byColor && (board[nr][nf].piece === 'B' || board[nr][nf].piece === 'Q')) return true;
        break;
      }
      nr += dr; nf += df;
    }
  }
  for (const [dr, df] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nr = r + dr, nf = f + df;
    if (isInBounds(nr, nf) && board[nr][nf]?.piece === 'K' && board[nr][nf]?.color === byColor) return true;
  }
  return false;
}

export function isInCheck(board, color) {
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if (board[r][f]?.piece === 'K' && board[r][f]?.color === color)
        return isSquareAttacked(board, r, f, color === 'w' ? 'b' : 'w');
  return false;
}

/** Returns 'checkmate' | 'stalemate' | null */
export function getGameOver(board, color, castling, enpassant) {
  const hasLegal = getLegalMoves(board, color, castling, enpassant)
    .some(m => {
      const { board: nb } = applyMove(board, m, color, castling);
      return !isInCheck(nb, color);
    });
  if (hasLegal) return null;
  return isInCheck(board, color) ? 'checkmate' : 'stalemate';
}

// ── Algebraic notation helpers ────────────────────────────────────────────────

/** Parse a SAN string into an internal move object, or return null if illegal. */
export function parseAlgebraicMove(moveStr, board, color, castling, enpassant) {
  const clean = moveStr.replace(/[+#!?]/g, '').trim();

  const castleSide = clean === 'O-O' || clean === '0-0'   ? (color === 'w' ? 'K' : 'k')
                   : clean === 'O-O-O' || clean === '0-0-0' ? (color === 'w' ? 'Q' : 'q')
                   : null;

  const allMoves = getLegalMoves(board, color, castling, enpassant);
  const validMoves = allMoves.filter(m => {
    const { board: nb } = applyMove(board, m, color, castling);
    return !isInCheck(nb, color);
  });

  if (castleSide) return validMoves.find(m => m.castle === castleSide) ?? null;

  const match = clean.match(/^([NBRQK]?)([a-h]?)([1-8]?)(x?)([a-h][1-8])(=[NBRQK])?$/);
  if (!match) return null;
  const [, pieceLetter, fromFile, fromRank, , toSq] = match;
  const piece = pieceLetter || 'P';

  return validMoves.find(m =>
    m.piece === piece &&
    m.to    === toSq &&
    (!fromFile || m.from[0] === fromFile) &&
    (!fromRank || m.from[1] === fromRank)
  ) ?? null;
}

/** Render an internal move object back to SAN. */
export function moveToAlgebraic(move, board, color, castling, enpassant) {
  if (move.castle) return move.castle === 'K' || move.castle === 'k' ? 'O-O' : 'O-O-O';

  const peers = getLegalMoves(board, color, castling, enpassant)
    .filter(m => m.piece === move.piece && m.to === move.to && m.from !== move.from)
    .filter(m => { const { board: nb } = applyMove(board, m, color, castling); return !isInCheck(nb, color); });

  let alg = move.piece !== 'P' ? move.piece : '';
  if (peers.length > 0)
    alg += peers.every(m => m.from[0] !== move.from[0]) ? move.from[0] : move.from[1];
  if (move.piece === 'P' && (move.capture || move.enpassant)) alg += move.from[0];
  if (move.capture || move.enpassant) alg += 'x';
  alg += move.to;
  return alg;
}
