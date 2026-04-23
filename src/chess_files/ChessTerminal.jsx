// =============================================================================
// ChessTerminal.jsx — Terminal UI. Imports engine + agent; contains no logic.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

import {
  createInitialBoard,
  boardToDisplay,
  boardToFEN,
  applyMove,
  isInCheck,
  parseAlgebraicMove,
  moveToAlgebraic,
  getGameOver,
} from './chessEngine.js';

import { requestAgentMove } from './chessAgent.js';

// ── Colour map for terminal line types ────────────────────────────────────────

const COLOR_MAP = {
  system:       '#888',
  output:       '#ccc',
  board:        '#e0e0e0',
  input:        '#7dd3fc',
  'white-move': '#fde68a',
  'black-move': '#a78bfa',
  thinking:     '#34d399',
  error:        '#f87171',
  check:        '#fb923c',
  victory:      '#fbbf24',
  draw:         '#6ee7b7',
  prompt:       '#86efac',
};

// ── Initial splash lines ──────────────────────────────────────────────────────

const SPLASH = [
  { type: 'system', text: '╔══════════════════════════════════════╗' },
  { type: 'system', text: '║      CHESS AGENT  ♟  v1.0            ║' },
  { type: 'system', text: '║   You play White. AI plays Black.     ║' },
  { type: 'system', text: '╚══════════════════════════════════════╝' },
  { type: 'system', text: '' },
  { type: 'system', text: 'Type moves in algebraic notation.' },
  { type: 'system', text: 'Examples: e4, Nf3, O-O, exd5, Qxh7+' },
  { type: 'system', text: 'Type "help" for all commands.' },
  { type: 'system', text: '' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChessTerminal() {
  const [board,     setBoard]     = useState(createInitialBoard);
  const [turn,      setTurn]      = useState('w');
  const [castling,  setCastling]  = useState('KQkq');
  const [enpassant, setEnpassant] = useState('-');
  const [halfmove,  setHalfmove]  = useState(0);
  const [moveCount, setMoveCount] = useState(1);
  const [history,   setHistory]   = useState([]);
  const [terminal,  setTerminal]  = useState(SPLASH);
  const [input,     setInput]     = useState('');
  const [thinking,  setThinking]  = useState(false);
  const [gameOver,  setGameOver]  = useState(false);

  const terminalRef = useRef(null);
  const inputRef    = useRef(null);

  // ── Terminal helpers ────────────────────────────────────────────────────────

  const addLine = useCallback((text, type = 'output') => {
    setTerminal(prev => [...prev, { type, text }]);
  }, []);

  const printBoard = useCallback((b) => {
    boardToDisplay(b).split('\n').forEach(l => addLine(l, 'board'));
  }, [addLine]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal]);

  // Initial board render
  useEffect(() => {
    printBoard(board);
    addLine('');
    addLine('White to move.', 'prompt');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── AI turn ─────────────────────────────────────────────────────────────────

  const runAgentTurn = useCallback(async (b, cast, ep, hm, fm, hist) => {
    setThinking(true);
    addLine('');
    addLine('Black is thinking…', 'thinking');

    const result = await requestAgentMove(b, cast, ep, hm, fm, hist);
    setThinking(false);

    if (result.type === 'error') {
      addLine(result.message, 'error');
      addLine("Skipping Black's turn.", 'system');
      setTurn('w');
      addLine('White to move.', 'prompt');
      return;
    }

    if (result.type === 'resign') {
      addLine('Black resigns! White wins! 🏆', 'victory');
      setGameOver(true);
      return;
    }

    if (result.type === 'draw') {
      addLine('Black offers a draw.', 'system');
      // In a full implementation you'd prompt the player to accept/decline.
      setTurn('w');
      addLine('White to move. (draw offer pending)', 'prompt');
      return;
    }

    // result.type === 'move'
    const { algebraic, move } = result;
    const { board: nb, castling: nc, enpassant: nep } = applyMove(b, move, 'b', cast);
    const newHM   = (move.capture || move.piece === 'P') ? 0 : hm + 1;
    const newHist = [...hist, algebraic];

    addLine(`Black: ${algebraic}`, 'black-move');

    const go    = getGameOver(nb, 'w', nc, nep);
    const check = isInCheck(nb, 'w');

    setBoard(nb);
    setCastling(nc);
    setEnpassant(nep);
    setHalfmove(newHM);
    setMoveCount(fm + 1);
    setHistory(newHist);

    addLine('');
    printBoard(nb);
    addLine('');

    if (go === 'checkmate') {
      addLine('Checkmate! Black wins! 🏆', 'victory');
      setGameOver(true);
    } else if (go === 'stalemate') {
      addLine("Stalemate! It's a draw! 🤝", 'draw');
      setGameOver(true);
    } else {
      if (check) addLine('Check!', 'check');
      setTurn('w');
      addLine('White to move.', 'prompt');
    }
  }, [addLine, printBoard]);

  // ── Command handler ─────────────────────────────────────────────────────────

  const handleCommand = useCallback(async (raw) => {
    const cmd = raw.trim();
    addLine(`> ${cmd}`, 'input');

    // ── Meta commands ──
    if (cmd === 'help') {
      [
        'Commands:',
        '  <move>   Make a move (e.g. e4, Nf3, O-O, exd5)',
        '  board    Redisplay the board',
        '  history  Show move history',
        '  fen      Show current FEN',
        '  resign   Resign the game',
        '  new      Start a new game',
      ].forEach(l => addLine(l, 'system'));
      return;
    }

    if (cmd === 'board') {
      printBoard(board);
      return;
    }

    if (cmd === 'fen') {
      addLine(boardToFEN(board, turn, castling, enpassant, halfmove, moveCount), 'output');
      return;
    }

    if (cmd === 'history') {
      if (!history.length) { addLine('No moves yet.', 'system'); return; }
      let line = '';
      history.forEach((m, i) => {
        line += i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m} ` : `${m}  `;
      });
      addLine(line.trim(), 'output');
      return;
    }

    if (cmd === 'resign') {
      addLine('White resigns. Black wins! 🏆', 'victory');
      setGameOver(true);
      return;
    }

    if (cmd === 'new') {
      const nb = createInitialBoard();
      setBoard(nb); setTurn('w'); setCastling('KQkq'); setEnpassant('-');
      setMoveCount(1); setHalfmove(0); setHistory([]); setGameOver(false);
      addLine(''); addLine('New game started!', 'system');
      printBoard(nb); addLine(''); addLine('White to move.', 'prompt');
      return;
    }

    // ── Guard clauses ──
    if (gameOver) { addLine('Game over. Type "new" to play again.', 'error'); return; }
    if (turn !== 'w') { addLine('Please wait for Black to move.', 'error'); return; }

    // ── Parse & validate player move ──
    const move = parseAlgebraicMove(cmd, board, 'w', castling, enpassant);
    if (!move) { addLine(`Illegal or unrecognised move: "${cmd}"`, 'error'); return; }

    const { board: tested } = applyMove(board, move, 'w', castling);
    if (isInCheck(tested, 'w')) { addLine('That move leaves your king in check!', 'error'); return; }

    // ── Apply player move ──
    const alg  = moveToAlgebraic(move, board, 'w', castling, enpassant);
    const { board: nb, castling: nc, enpassant: nep } = applyMove(board, move, 'w', castling);
    const newHM   = (move.capture || move.piece === 'P') ? 0 : halfmove + 1;
    const newHist = [...history, alg];

    addLine(`White: ${alg}`, 'white-move');

    const go = getGameOver(nb, 'b', nc, nep);

    setBoard(nb); setCastling(nc); setEnpassant(nep);
    setHalfmove(newHM); setHistory(newHist);

    if (go === 'checkmate') {
      addLine(''); printBoard(nb); addLine('');
      addLine('Checkmate! White wins! 🏆', 'victory');
      setGameOver(true);
      return;
    }
    if (go === 'stalemate') {
      addLine(''); printBoard(nb); addLine('');
      addLine("Stalemate! It's a draw! 🤝", 'draw');
      setGameOver(true);
      return;
    }

    if (isInCheck(nb, 'b')) addLine('Check!', 'check');

    setTurn('b');
    await runAgentTurn(nb, nc, nep, newHM, moveCount, newHist);
  }, [
    board, turn, castling, enpassant, halfmove, moveCount,
    history, gameOver, addLine, printBoard, runAgentTurn,
  ]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || thinking) return;
    const cmd = input;
    setInput('');
    handleCommand(cmd);
  }, [input, thinking, handleCommand]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const inputDisabled = thinking || (turn === 'b' && !gameOver);
  const placeholder   = thinking          ? 'AI thinking…'
                      : turn === 'b'      ? 'Waiting for Black…'
                      :                    'Enter move…';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Courier New', Courier, monospace",
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '680px',
        background: '#111',
        border: '1px solid #333',
        borderRadius: '8px',
        boxShadow: '0 0 40px rgba(0,255,150,0.05), 0 0 80px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}>
        {/* ── Title bar ── */}
        <div style={{
          background: '#1a1a1a', borderBottom: '1px solid #2a2a2a',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {['#ff5f57','#ffbd2e','#28c940'].map((bg, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: bg }} />
          ))}
          <span style={{ color: '#555', fontSize: '12px', marginLeft: '8px', letterSpacing: '2px' }}>
            CHESS AGENT — terminal
          </span>
        </div>

        {/* ── Output ── */}
        <div
          ref={terminalRef}
          onClick={() => inputRef.current?.focus()}
          style={{
            height: '520px', overflowY: 'auto',
            padding: '16px', cursor: 'text',
            scrollbarWidth: 'thin', scrollbarColor: '#333 #111',
          }}
        >
          {terminal.map((line, i) => (
            <div key={i} style={{
              color: COLOR_MAP[line.type] ?? '#ccc',
              fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre',
            }}>
              {line.text || '\u00A0'}
            </div>
          ))}
          {thinking && (
            <div style={{ color: '#34d399', fontSize: '13px', animation: 'pulse 1s infinite' }}>▋</div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div style={{
          borderTop: '1px solid #222', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#0e0e0e',
        }}>
          <span style={{ color: '#34d399', fontSize: '13px' }}>{'>'}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); }}
            disabled={inputDisabled}
            placeholder={placeholder}
            autoFocus
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#7dd3fc', fontSize: '13px',
              fontFamily: 'inherit', caretColor: '#34d399',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={thinking || !input.trim()}
            style={{
              background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px',
              color: '#555', fontSize: '11px', padding: '4px 8px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >↵</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar        { width:6px }
        ::-webkit-scrollbar-track  { background:#111 }
        ::-webkit-scrollbar-thumb  { background:#333; border-radius:3px }
      `}</style>
    </div>
  );
}
