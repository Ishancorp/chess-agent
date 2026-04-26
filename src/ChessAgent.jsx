import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const EMPTY = 0, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const WHITE = 1, BLACK = -1;

const GLYPHS = {
  [WHITE]: { [K]:"♔",[Q]:"♕",[R]:"♖",[B]:"♗",[N]:"♘",[P]:"♙" },
  [BLACK]: { [K]:"♚",[Q]:"♛",[R]:"♜",[B]:"♝",[N]:"♞",[P]:"♟" },
};

// ── Board helpers ────────────────────────────────────────────────────────────
const sq  = (r,c) => r*8+c;
const row = s => Math.floor(s/8);
const col = s => s%8;
const inB = (r,c) => r>=0&&r<8&&c>=0&&c<8;
const mkP = (type,color) => ({type,color});
const emp = () => mkP(EMPTY,0);
const FILES = "abcdefgh";
const sqName = s => FILES[col(s)]+(8-row(s));

function initBoard() {
  const b = Array(64).fill(null).map(emp);
  const back = [R,N,B,Q,K,B,N,R];
  for (let i=0;i<8;i++) {
    b[i]    = mkP(back[i],BLACK);
    b[8+i]  = mkP(P,BLACK);
    b[48+i] = mkP(P,WHITE);
    b[56+i] = mkP(back[i],WHITE);
  }
  return b;
}

const initCastling = () => ({wK:true,wQ:true,bK:true,bQ:true});

// ── Move application ─────────────────────────────────────────────────────────
function applyMove(board, move, epSq) {
  const nb = board.map(p=>({...p}));
  const piece = nb[move.from];
  nb[move.to] = move.promo ? mkP(move.promo, piece.color) : {...piece};
  nb[move.from] = emp();
  if (move.ep)          nb[sq(row(move.from),col(move.to))] = emp();
  if (move.castle==="wK") { nb[61]={...nb[63]}; nb[63]=emp(); }
  if (move.castle==="wQ") { nb[59]={...nb[56]}; nb[56]=emp(); }
  if (move.castle==="bK") { nb[5] ={...nb[7]};  nb[7] =emp(); }
  if (move.castle==="bQ") { nb[3] ={...nb[0]};  nb[0] =emp(); }
  return nb;
}

function getEpSq(board, move) {
  const p = board[move.from];
  if (p.type===P && Math.abs(row(move.to)-row(move.from))===2)
    return sq((row(move.from)+row(move.to))/2, col(move.from));
  return -1;
}

function updCastling(c, move, board) {
  const nc = {...c};
  const p  = board[move.from];
  if (p.type===K) { if(p.color===WHITE){nc.wK=false;nc.wQ=false;}else{nc.bK=false;nc.bQ=false;} }
  if (move.from===56||move.to===56) nc.wQ=false;
  if (move.from===63||move.to===63) nc.wK=false;
  if (move.from===0 ||move.to===0)  nc.bQ=false;
  if (move.from===7 ||move.to===7)  nc.bK=false;
  return nc;
}

// ── Move generation ──────────────────────────────────────────────────────────
function addPawn(moves, from, to, color) {
  if (row(to)===(color===WHITE?0:7))
    [Q,R,B,N].forEach(promo=>moves.push({from,to,promo,ep:false,castle:null}));
  else moves.push({from,to,promo:null,ep:false,castle:null});
}

function pseudoMoves(board, turn, epSq, castling) {
  const moves = [];
  for (let s=0;s<64;s++) {
    const p = board[s];
    if (p.color!==turn) continue;
    const r=row(s), c=col(s);
    if (p.type===P) {
      const dir=turn===WHITE?-1:1, startR=turn===WHITE?6:1, nr=r+dir;
      if (inB(nr,c)&&board[sq(nr,c)].type===EMPTY) {
        addPawn(moves,s,sq(nr,c),turn);
        if (r===startR&&board[sq(nr+dir,c)].type===EMPTY)
          moves.push({from:s,to:sq(nr+dir,c),promo:null,ep:false,castle:null});
      }
      for (const dc of [-1,1]) {
        if (!inB(nr,c+dc)) continue;
        const ts=sq(nr,c+dc);
        if (board[ts].color===-turn) addPawn(moves,s,ts,turn);
        else if (ts===epSq) moves.push({from:s,to:ts,promo:null,ep:true,castle:null});
      }
    } else if (p.type===N) {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const [nr,nc]=[r+dr,c+dc];
        if (inB(nr,nc)&&board[sq(nr,nc)].color!==turn)
          moves.push({from:s,to:sq(nr,nc),promo:null,ep:false,castle:null});
      }
    } else if (p.type===K) {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const [nr,nc]=[r+dr,c+dc];
        if (inB(nr,nc)&&board[sq(nr,nc)].color!==turn)
          moves.push({from:s,to:sq(nr,nc),promo:null,ep:false,castle:null});
      }
      if (turn===WHITE&&r===7&&c===4) {
        if (castling.wK&&board[61].type===EMPTY&&board[62].type===EMPTY&&board[63].type===R&&board[63].color===WHITE)
          moves.push({from:s,to:62,promo:null,ep:false,castle:"wK"});
        if (castling.wQ&&board[59].type===EMPTY&&board[58].type===EMPTY&&board[57].type===EMPTY&&board[56].type===R&&board[56].color===WHITE)
          moves.push({from:s,to:58,promo:null,ep:false,castle:"wQ"});
      }
      if (turn===BLACK&&r===0&&c===4) {
        if (castling.bK&&board[5].type===EMPTY&&board[6].type===EMPTY&&board[7].type===R&&board[7].color===BLACK)
          moves.push({from:s,to:6,promo:null,ep:false,castle:"bK"});
        if (castling.bQ&&board[3].type===EMPTY&&board[2].type===EMPTY&&board[1].type===EMPTY&&board[0].type===R&&board[0].color===BLACK)
          moves.push({from:s,to:2,promo:null,ep:false,castle:"bQ"});
      }
    } else {
      const rays = p.type===R?[[0,1],[0,-1],[1,0],[-1,0]]
                 : p.type===B?[[1,1],[1,-1],[-1,1],[-1,-1]]
                 :[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr,dc] of rays) {
        let [nr,nc]=[r+dr,c+dc];
        while (inB(nr,nc)) {
          const ts=sq(nr,nc);
          if (board[ts].color===turn) break;
          moves.push({from:s,to:ts,promo:null,ep:false,castle:null});
          if (board[ts].type!==EMPTY) break;
          nr+=dr; nc+=dc;
        }
      }
    }
  }
  return moves;
}

function inCheck(board, color) {
  let king=-1;
  for (let i=0;i<64;i++) if (board[i].type===K&&board[i].color===color){king=i;break;}
  if (king===-1) return true;
  return pseudoMoves(board,-color,-1,{wK:false,wQ:false,bK:false,bQ:false}).some(m=>m.to===king);
}

function legalMoves(board, turn, epSq, castling) {
  return pseudoMoves(board,turn,epSq,castling).filter(m=>{
    const nb=applyMove(board,m,epSq);
    return !inCheck(nb,turn);
  });
}

// ── Notation ─────────────────────────────────────────────────────────────────
const PNAME = {[P]:"",[N]:"N",[B]:"B",[R]:"R",[Q]:"Q",[K]:"K"};
function toNotation(m, board) {
  if (m.castle==="wK"||m.castle==="bK") return "O-O";
  if (m.castle==="wQ"||m.castle==="bQ") return "O-O-O";
  const p   = board[m.from];
  const cap = board[m.to].type!==EMPTY||m.ep?"x":"";
  const pre = p.type===P?(cap?FILES[col(m.from)]:""):PNAME[p.type];
  return pre+cap+sqName(m.to)+(m.promo?"="+PNAME[m.promo]:"");
}

// ── AI: Minimax + Alpha-Beta ─────────────────────────────────────────────────
const VAL = {[P]:100,[N]:320,[B]:330,[R]:500,[Q]:900,[K]:20000,[EMPTY]:0};
const PST  = {
  [P]: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  [N]: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  [B]: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  [R]: [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  [Q]: [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  [K]: [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
};

function evaluate(board) {
  let s=0;
  for (let i=0;i<64;i++) {
    const p=board[i]; if(!p.type) continue;
    const idx=p.color===WHITE?i:63-i;
    s+=p.color*(VAL[p.type]+(PST[p.type]?.[idx]??0));
  }
  return s;
}

function minimax(board,depth,alpha,beta,turn,ep,castling) {
  const moves=legalMoves(board,turn,ep,castling);
  if (!moves.length) return inCheck(board,turn)?-turn*99999:0;
  if (depth===0) return evaluate(board);
  if (turn===WHITE) {
    let best=-Infinity;
    for (const m of moves) {
      const nb=applyMove(board,m,ep);
      const v=minimax(nb,depth-1,alpha,beta,BLACK,getEpSq(board,m),updCastling(castling,m,board));
      if(v>best)best=v; if(v>alpha)alpha=v; if(beta<=alpha)break;
    }
    return best;
  } else {
    let best=Infinity;
    for (const m of moves) {
      const nb=applyMove(board,m,ep);
      const v=minimax(nb,depth-1,alpha,beta,WHITE,getEpSq(board,m),updCastling(castling,m,board));
      if(v<best)best=v; if(v<beta)beta=v; if(beta<=alpha)break;
    }
    return best;
  }
}

// The Agent Script — autonomous, reads state, returns best move
function agentPickMove(board, turn, ep, castling, depth) {
  const moves=[...legalMoves(board,turn,ep,castling)].sort(()=>Math.random()-.5);
  if (!moves.length) return null;
  let bestMove=null, bestVal=turn===WHITE?-Infinity:Infinity;
  for (const m of moves) {
    const nb=applyMove(board,m,ep);
    const v=minimax(nb,depth-1,-Infinity,Infinity,-turn,getEpSq(board,m),updCastling(castling,m,board));
    if (turn===WHITE?v>bestVal:v<bestVal) { bestVal=v; bestMove=m; }
  }
  return bestMove;
}

const isAgent = t => t==="agent";

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Chess() {
  const [board,      setBoard]      = useState(initBoard);
  const [turn,       setTurn]       = useState(WHITE);
  const [ep,         setEp]         = useState(-1);
  const [castling,   setCastling]   = useState(initCastling);
  const [status,     setStatus]     = useState("idle");
  const [result,     setResult]     = useState("");
  const [lastMove,   setLastMove]   = useState(null);
  const [moveLog,    setMoveLog]    = useState([]);
  const [thinking,   setThinking]   = useState(false);
  const [whiteType,  setWhiteType]  = useState("human");
  const [blackType,  setBlackType]  = useState("agent");
  const [whiteDepth, setWhiteDepth] = useState(3);
  const [blackDepth, setBlackDepth] = useState(3);
  const [agentSpeed, setAgentSpeed] = useState(600);
  const [selected,   setSelected]   = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [promoMove,  setPromoMove]  = useState(null);

  const stateRef = useRef({});
  stateRef.current = {board,turn,ep,castling,status,thinking};
  const logRef = useRef(null);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[moveLog]);

  const commitMove = useCallback((move, boardSnap, epSnap, castlingSnap, turnSnap)=>{
    const note=toNotation(move,boardSnap);
    const nb=applyMove(boardSnap,move,epSnap);
    const nEp=getEpSq(boardSnap,move);
    const nC=updCastling(castlingSnap,move,boardSnap);
    const next=-turnSnap;
    setBoard(nb); setTurn(next); setEp(nEp); setCastling(nC);
    setLastMove(move);
    setMoveLog(log=>[...log,{note,color:turnSnap}]);
    const nextMoves=legalMoves(nb,next,nEp,nC);
    if (!nextMoves.length) {
      setResult(inCheck(nb,next)
        ?(turnSnap===WHITE?"1-0  White wins by checkmate":"0-1  Black wins by checkmate")
        :"½-½  Stalemate");
      setStatus("over");
    }
  },[]);

  // Agent loop
  useEffect(()=>{
    const {board,turn,ep,castling,status,thinking}=stateRef.current;
    const curType=turn===WHITE?whiteType:blackType;
    if (status!=="playing"||thinking||!isAgent(curType)) return;
    const timer=setTimeout(()=>{
      const {board,turn,ep,castling}=stateRef.current;
      setThinking(true);
      setTimeout(()=>{
        const depth=turn===WHITE?whiteDepth:blackDepth;
        const move=agentPickMove(board,turn,ep,castling,depth);
        if (!move) {
          setResult(inCheck(board,turn)
            ?(turn===WHITE?"0-1  Black wins":"1-0  White wins")
            :"½-½  Stalemate");
          setStatus("over"); setThinking(false); return;
        }
        commitMove(move,board,ep,castling,turn);
        setThinking(false);
      },10);
    },agentSpeed);
    return ()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[status,thinking,turn,board,whiteType,blackType,whiteDepth,blackDepth,agentSpeed,commitMove]);

  const handleSquareClick = useCallback((s)=>{
    const {board,turn,ep,castling,status}=stateRef.current;
    if (status!=="playing"||promoMove) return;
    const curType=turn===WHITE?whiteType:blackType;
    if (isAgent(curType)) return;
    const piece=board[s];
    if (piece.color===turn) {
      const moves=legalMoves(board,turn,ep,castling).filter(m=>m.from===s);
      setSelected(s); setHighlights(moves.map(m=>m.to)); return;
    }
    if (selected!==null&&highlights.includes(s)) {
      const moves=legalMoves(board,turn,ep,castling).filter(m=>m.from===selected&&m.to===s);
      if (!moves.length){setSelected(null);setHighlights([]);return;}
      if (moves.length>1&&moves[0].promo) {
        setPromoMove({from:selected,to:s});
        setSelected(null);setHighlights([]);return;
      }
      setSelected(null);setHighlights([]);
      commitMove(moves[0],board,ep,castling,turn);return;
    }
    setSelected(null);setHighlights([]);
  },[selected,highlights,whiteType,blackType,promoMove,commitMove]);

  const handlePromo = useCallback((piece)=>{
    const {board,ep,castling,turn}=stateRef.current;
    if (!promoMove) return;
    commitMove({from:promoMove.from,to:promoMove.to,promo:piece,ep:false,castle:null},board,ep,castling,turn);
    setPromoMove(null);
  },[promoMove,commitMove]);

  const reset = useCallback(()=>{
    setBoard(initBoard());setTurn(WHITE);setEp(-1);setCastling(initCastling());
    setStatus("idle");setResult("");setLastMove(null);setMoveLog([]);
    setThinking(false);setSelected(null);setHighlights([]);setPromoMove(null);
  },[]);

  const sqBg = s => {
    const light=(row(s)+col(s))%2===0;
    if (s===selected)           return "#7fc97f";
    if (highlights.includes(s)) return light?"#e8ff80":"#aed672";
    if (lastMove&&(s===lastMove.from||s===lastMove.to)) return light?"#f6f669":"#baca2b";
    return light?"#f0d9b5":"#b58863";
  };

  const curType=turn===WHITE?whiteType:blackType;
  const statusText=
    status==="idle"   ?"Configure players, then press Start":
    status==="over"   ?result:
    status==="paused" ?"Paused":
    thinking          ?(turn===WHITE?"♔ White agent thinking…":"♚ Black agent thinking…"):
    isAgent(curType)  ?(turn===WHITE?"♔ White to move":"♚ Black to move"):
                       (turn===WHITE?"♔ Your move (White)":"♚ Your move (Black)");

  const pairs=[];
  for(let i=0;i<moveLog.length;i+=2) pairs.push(moveLog.slice(i,i+2));

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 12px",background:"#16213e",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8dcc8",userSelect:"none"}}>
      <h1 style={{fontSize:22,letterSpacing:4,textTransform:"uppercase",color:"#c9a84c",marginBottom:3,fontWeight:400}}>Chess</h1>
      <p style={{fontSize:10,color:"#445",letterSpacing:3,marginBottom:20}}>HUMAN · AGENT · ANY COMBINATION</p>

      <div style={{display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap",justifyContent:"center"}}>

        {/* Board */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{background:"#0f0f1a",padding:10,borderRadius:6,boxShadow:"0 12px 40px rgba(0,0,0,0.6)",position:"relative"}}>
            <div style={{display:"flex"}}>
              <div style={{display:"flex",flexDirection:"column",paddingRight:4}}>
                {[8,7,6,5,4,3,2,1].map(r=>(
                  <div key={r} style={{height:56,display:"flex",alignItems:"center",fontSize:10,color:"#556",width:12}}>{r}</div>
                ))}
              </div>
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(8,56px)",gridTemplateRows:"repeat(8,56px)",border:"1.5px solid #333"}}>
                  {Array.from({length:64},(_,s)=>{
                    const p=board[s];
                    const sym=p.type&&p.color?GLYPHS[p.color][p.type]:"";
                    const isLast=lastMove&&(s===lastMove.from||s===lastMove.to);
                    const isHum=!isAgent(turn===WHITE?whiteType:blackType);
                    const canClick=status==="playing"&&isHum&&!promoMove;
                    const isDot=highlights.includes(s)&&board[s].type===EMPTY;
                    const isCap=highlights.includes(s)&&board[s].type!==EMPTY;
                    return (
                      <div key={s} onClick={()=>handleSquareClick(s)}
                        style={{width:56,height:56,background:sqBg(s),display:"flex",alignItems:"center",justifyContent:"center",
                          cursor:canClick?"pointer":"default",position:"relative",transition:"background .12s"}}>
                        {isDot&&<div style={{width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,0.22)",pointerEvents:"none",zIndex:2}}/>}
                        {isCap&&<div style={{position:"absolute",inset:0,border:"3px solid rgba(0,0,0,0.28)",borderRadius:2,pointerEvents:"none",zIndex:2}}/>}
                        {sym&&<span key={`${s}-${moveLog.length}`} style={{
                          fontSize:36,lineHeight:1,pointerEvents:"none",zIndex:1,position:"relative",
                          color:p.color===WHITE?"#fff":"#111",
                          textShadow:p.color===WHITE?"0 1px 4px rgba(0,0,0,0.9)":"0 1px 2px rgba(255,255,255,0.15)",
                          animation:isLast?"drop .2s ease-out":"none"
                        }}>{sym}</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",marginTop:4}}>
                  {"abcdefgh".split("").map(f=>(
                    <div key={f} style={{width:56,textAlign:"center",fontSize:10,color:"#556"}}>{f}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Promotion overlay */}
            {promoMove&&(
              <div style={{position:"absolute",inset:0,background:"rgba(10,10,20,0.88)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:6,zIndex:20}}>
                <div style={{color:"#c9a84c",fontSize:12,letterSpacing:3,marginBottom:14}}>PROMOTE TO</div>
                <div style={{display:"flex",gap:10}}>
                  {[Q,R,B,N].map(piece=>{
                    const c=turn===WHITE?WHITE:BLACK;
                    return (
                      <div key={piece} onClick={()=>handlePromo(piece)} style={{
                        width:66,height:66,background:"#1a1a2e",border:"1px solid #444",borderRadius:6,
                        display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:40,
                        color:c===WHITE?"#fff":"#ccc",textShadow:c===WHITE?"0 1px 4px rgba(0,0,0,0.9)":"none"
                      }}>{GLYPHS[c][piece]}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div style={{marginTop:10,padding:"8px 14px",background:"#0a0a15",border:"1px solid #222",borderRadius:4,fontSize:13,color:"#aaa",fontStyle:"italic",textAlign:"center",width:"100%",boxSizing:"border-box",minHeight:36}}>
            {statusText}
          </div>

          {/* Controls */}
          <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
            {status==="idle"&&    <Btn onClick={()=>setStatus("playing")} color="#2d6a4f">▶ Start</Btn>}
            {status==="playing"&& <Btn onClick={()=>setStatus("paused")}  color="#5c3317">⏸ Pause</Btn>}
            {status==="paused"&&  <Btn onClick={()=>setStatus("playing")} color="#2d6a4f">▶ Resume</Btn>}
            {status==="over"&&    <Btn onClick={reset}                     color="#2d6a4f">▶ New Game</Btn>}
            {status!=="over"&&    <Btn onClick={reset}                     color="#2a2a3e">↺ Reset</Btn>}
          </div>
        </div>

        {/* Side panel */}
        <div style={{display:"flex",flexDirection:"column",gap:14,width:216}}>

          <Panel title="Players — change anytime">
            <PlayerRow label="White" icon="♔" isWhite
              type={whiteType} setType={setWhiteType}
              depth={whiteDepth} setDepth={setWhiteDepth}
              active={status==="playing"&&turn===WHITE} thinking={thinking&&turn===WHITE}/>
            <div style={{height:1,background:"#1a1a2a",margin:"10px 0"}}/>
            <PlayerRow label="Black" icon="♚" isWhite={false}
              type={blackType} setType={setBlackType}
              depth={blackDepth} setDepth={setBlackDepth}
              active={status==="playing"&&turn===BLACK} thinking={thinking&&turn===BLACK}/>

            {(isAgent(whiteType)||isAgent(blackType))&&(
              <div style={{marginTop:12}}>
                <SliderRow label="Delay" min={100} max={2000} step={100}
                  value={agentSpeed} onChange={setAgentSpeed} display={`${agentSpeed}ms`}/>
              </div>
            )}
          </Panel>

          {/* Move log */}
          <Panel title={`Move Log · ${moveLog.length} half-moves`}>
            <div ref={logRef} style={{maxHeight:280,overflowY:"auto",fontSize:11,fontFamily:"monospace"}}>
              {!pairs.length&&<div style={{color:"#334",fontStyle:"italic",fontSize:11}}>No moves yet</div>}
              {pairs.map((pair,i)=>(
                <div key={i} style={{display:"flex",gap:4,padding:"2px 0",borderBottom:"1px solid #1a1a2a"}}>
                  <span style={{color:"#445",minWidth:22,fontSize:10}}>{i+1}.</span>
                  <span style={{color:"#c8b89a",minWidth:58}}>{pair[0]?.note}</span>
                  <span style={{color:"#7a8fa6"}}>{pair[1]?.note??""}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="How to play">
            <div style={{fontSize:10,color:"#556",lineHeight:2.1}}>
              <b style={{color:"#667"}}>Human turn:</b> click piece, then target<br/>
              Green dots = legal moves<br/>
              Promotion picker appears automatically<br/>
              <b style={{color:"#667"}}>Switch sides mid-game</b> with the<br/>
              HUMAN / AGENT toggles above<br/>
              Agent depth 1–4 ply (higher = slower)
            </div>
          </Panel>
        </div>
      </div>

      <style>{`
        @keyframes drop{from{transform:scale(1.3) translateY(-4px);opacity:.6}to{transform:scale(1) translateY(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0a0a15}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>
    </div>
  );
}

function PlayerRow({label,icon,isWhite,type,setType,depth,setDepth,active,thinking}) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
      <span style={{fontSize:26,marginTop:2,color:isWhite?"#fff":"#ccc",
        textShadow:isWhite?"0 1px 4px rgba(0,0,0,0.9)":"none",
        animation:thinking?"pulse 1s infinite":"none",flexShrink:0}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:12,color:"#999",minWidth:36}}>{label}</span>
          <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:"1px solid #2a2a3a"}}>
            {["human","agent"].map(t=>(
              <button key={t} onClick={()=>setType(t)} style={{
                padding:"4px 11px",border:"none",cursor:"pointer",fontSize:9,letterSpacing:1.5,
                background:type===t?(isWhite?"#2d6a4f":"#2d3d6a"):"#111",
                color:type===t?"#e8dcc8":"#445",fontFamily:"Georgia,serif",transition:"all .2s"
              }}>{t.toUpperCase()}</button>
            ))}
          </div>
          {active&&<div style={{width:6,height:6,borderRadius:"50%",background:thinking?"#f90":"#4fa",flexShrink:0,
            animation:thinking?"pulse .8s infinite":"none"}}/>}
        </div>
        {type==="agent"&&(
          <SliderRow label="Depth" min={1} max={4} step={1} value={depth} onChange={setDepth} display={`${depth} ply`}/>
        )}
      </div>
    </div>
  );
}

function Panel({title,children}) {
  return (
    <div style={{background:"#0d1117",border:"1px solid #1e1e2e",borderRadius:6,padding:14}}>
      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:3,color:"#445",marginBottom:12}}>{title}</div>
      {children}
    </div>
  );
}

function Btn({onClick,color,children}) {
  return (
    <button onClick={onClick} style={{padding:"7px 18px",background:color,color:"#e8dcc8",border:"none",
      borderRadius:4,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",letterSpacing:1}}>
      {children}
    </button>
  );
}

function SliderRow({label,min,max,step,value,onChange,display}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#667"}}>
      <span style={{minWidth:34}}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(+e.target.value)} style={{flex:1,accentColor:"#c9a84c"}}/>
      <span style={{minWidth:34,textAlign:"right",color:"#889"}}>{display}</span>
    </div>
  );
}
