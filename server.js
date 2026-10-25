const http = require('http');
const { WebSocketServer } = require('ws');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type':'text/plain'}); res.end('Tres en Raya online server is running.'); });
const wss = new WebSocketServer({ server });
const rooms = new Map();
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function send(ws, text) { if (ws && ws.readyState === 1) ws.send(text); }
function safe(s) { return String(s || '').replace(/[|\r\n]/g, ' ').slice(0, 32); }
function code() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; for(let i=0;i<5;i++) out+=chars[Math.floor(Math.random()*chars.length)]; return out; }
function start(room) {
  room.board=Array(9).fill(''); room.turn='X'; room.finished=false;
  send(room.x, `START|${room.code}|X|${room.nameX}|${room.emojiX}|${room.nameO}|${room.emojiO}|X`);
  send(room.o, `START|${room.code}|O|${room.nameX}|${room.emojiX}|${room.nameO}|${room.emojiO}|X`);
}
function winner(board, s) { return lines.some(line => line.every(i => board[i] === s)); }
wss.on('connection', ws => {
  ws.roomCode=null; ws.role=null;
  ws.on('message', raw => {
    const parts=raw.toString().split('|'); const cmd=parts[0];
    if(cmd==='CREATE') {
      let c; do { c=code(); } while(rooms.has(c));
      const room={code:c,x:ws,o:null,nameX:safe(parts[1])||'Jugador 1',emojiX:safe(parts[2])||'❤️',nameO:'',emojiO:'',board:Array(9).fill(''),turn:'X',finished:false};
      rooms.set(c,room); ws.roomCode=c; ws.role='X'; send(ws,`WAIT|${c}|X|${room.nameX}|${room.emojiX}`); return;
    }
    if(cmd==='JOIN') {
      const c=safe(parts[1]).toUpperCase(), room=rooms.get(c);
      if(!room){send(ws,'ERROR|No existe esa sala. Revisa el código.');return;}
      if(room.o){send(ws,'ERROR|Esa sala ya tiene dos jugadores.');return;}
      const name=safe(parts[2])||'Jugador 2', emoji=safe(parts[3])||'🐶';
      if(emoji===room.emojiX){send(ws,'ERROR|Debes elegir un emoji diferente al de tu rival.');return;}
      room.o=ws; room.nameO=name; room.emojiO=emoji; ws.roomCode=c; ws.role='O'; start(room); return;
    }
    const room=rooms.get(ws.roomCode); if(!room)return;
    if(cmd==='MOVE') {
      const i=Number(parts[1]);
      if(!room.o||room.finished||ws.role!==room.turn||!Number.isInteger(i)||i<0||i>8||room.board[i])return;
      room.board[i]=ws.role;
      let result=''; if(winner(room.board,ws.role)){room.finished=true;result=ws.role;} else if(room.board.every(Boolean)){room.finished=true;result='D';}
      room.turn=ws.role==='X'?'O':'X';
      const payload=`MOVE|${i}|${ws.role}|${room.turn}|${result}`; send(room.x,payload); send(room.o,payload); return;
    }
    if(cmd==='RESET' && room.x && room.o){ start(room); return; }
    if(cmd==='LEAVE'){ disconnect(ws); }
  });
  ws.on('close',()=>disconnect(ws));
  function disconnect(client){
    const c=client.roomCode; if(!c)return; const room=rooms.get(c); if(!room)return;
    if(room.x===client){ send(room.o,'OPPONENT_LEFT'); rooms.delete(c); }
    else if(room.o===client){ room.o=null; room.nameO=''; room.emojiO=''; room.finished=true; send(room.x,'OPPONENT_LEFT'); }
    client.roomCode=null;
  }
});
const port=process.env.PORT||3000; server.listen(port,'0.0.0.0',()=>console.log(`Tres en Raya server listening on ${port}`));
