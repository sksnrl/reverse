const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const watchers = new Map();
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 6;
const PHASE_SECONDS = { night: 25, announcement: 8, discussion: 100, voting: 25, verdict: 6 };

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}
function id() { return crypto.randomUUID(); }
function roomFor(socket) {
  const rid = socket.data.roomCode;
  return rid ? rooms.get(rid) : null;
}
function playerFor(room, socket) {
  return room?.players.get(socket.data.playerId) || null;
}
function alivePlayers(room) {
  return [...room.players.values()].filter(p => p.alive && !p.isHost);
}
function livingMafia(room) {
  return alivePlayers(room).filter(p => p.role === "mafia").length;
}
function livingTown(room) {
  return alivePlayers(room).filter(p => p.role !== "mafia").length;
}
function publicState(room) {
  const players = [...room.players.values()].filter(p => !p.isHost).map(p => ({
    id: p.id, nickname: p.nickname, alive: p.alive, connected: p.connected,
    isHost: false, hasVoted: room.phase === "voting" && room.votes.has(p.id)
  }));
  return {
    code: room.code, status: room.status, phase: room.phase, round: room.round,
    deadline: room.deadline, players, maxPlayers: room.maxPlayers,
    minPlayers: MIN_PLAYERS, message: room.message, winner: room.winner,
    voteCounts: room.phase === "voting" || room.phase === "verdict"
      ? [...room.votes.values()].reduce((acc, target) => {
          if (target !== "abstain") acc[target] = (acc[target] || 0) + 1;
          return acc;
        }, {}) : null,
    revealedRoles: room.revealedRoles ? Object.fromEntries(room.revealedRoles) : null
  };
}
function privateState(room, playerId) {
  const p = room.players.get(playerId);
  if (!p) return null;
  return {
    playerId: p.id, nickname: p.nickname, role: p.role || null,
    alive: p.alive, isHost: p.isHost, hostToken: p.isHost ? room.hostToken : undefined,
    hasVoted: room.votes.has(p.id),
    myVote: room.votes.get(p.id) || null,
    actionSubmitted: room.actions.has(p.id),
    privateResult: p.privateResult || null,
    mafiaTeammates: p.role === "mafia"
      ? alivePlayers(room).filter(x => x.role === "mafia" && x.id !== p.id).map(x => ({id:x.id,nickname:x.nickname}))
      : []
  };
}
function emitRoom(room) {
  io.to(room.code).emit("state", publicState(room));
  for (const p of room.players.values()) {
    if (p.socketId) io.to(p.socketId).emit("private_state", privateState(room, p.id));
  }
}
function fail(socket, message) { socket.emit("error_message", message); }
function setPhase(room, phase, message, seconds) {
  if (room.timer) clearTimeout(room.timer);
  room.phase = phase;
  room.message = message;
  room.deadline = Date.now() + seconds * 1000;
  emitRoom(room);
  room.timer = setTimeout(() => handleTimeout(room.code, phase), seconds * 1000);
}
function checkWinner(room) {
  const mafia = livingMafia(room);
  const town = livingTown(room);
  if (mafia === 0) { finish(room, "town", "시민 진영 승리!"); return true; }
  if (mafia >= town) { finish(room, "mafia", "마피아 진영 승리!"); return true; }
  return false;
}
function finish(room, winner, message) {
  if (room.timer) clearTimeout(room.timer);
  room.status = "finished";
  room.phase = "finished";
  room.winner = winner;
  room.message = message;
  room.deadline = null;
  room.revealedRoles = new Map([...room.players.values()].filter(p => !p.isHost).map(p => [p.id, p.role]));
  emitRoom(room);
}
function revealRole(room, player) {
  room.revealedRoles.set(player.id, player.role);
}
function beginNight(room) {
  room.actions.clear();
  room.votes.clear();
  for (const p of room.players.values()) p.privateResult = null;
  setPhase(room, "night", `밤 ${room.round}: 각자의 능력을 사용하세요.`, PHASE_SECONDS.night);
}
function resolveNight(room) {
  const players = alivePlayers(room);
  const mafia = players.filter(p => p.role === "mafia");
  const mafiaTargets = mafia.map(p => room.actions.get(p.id)).filter(Boolean);
  let targetId = null;
  if (mafiaTargets.length) {
    const counts = mafiaTargets.reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {});
    targetId = Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0];
    // Tie between mafia choices: no attack this night.
    const top = Object.entries(counts).filter(([,n]) => n === Math.max(...Object.values(counts)));
    if (top.length !== 1) targetId = null;
  }
  const doctor = players.find(p => p.role === "doctor");
  const protectedId = doctor ? room.actions.get(doctor.id) : null;
  if (targetId && targetId !== protectedId) {
    const victim = room.players.get(targetId);
    if (victim && victim.alive) {
      victim.alive = false;
      revealRole(room, victim);
      room.message = `밤의 결과: ${victim.nickname}님이 탈락했습니다.`;
    } else room.message = "밤은 조용히 지나갔습니다.";
  } else {
    room.message = targetId && targetId === protectedId
      ? "밤의 결과: 누군가가 공격에서 살아남았습니다."
      : "밤은 조용히 지나갔습니다.";
  }
  const police = players.find(p => p.role === "police");
  if (police) {
    const t = room.actions.get(police.id);
    if (t) {
      const target = room.players.get(t);
      police.privateResult = target ? {
        type: "investigation", targetId: target.id, nickname: target.nickname,
        result: target.role === "mafia" ? "마피아" : "마피아가 아님"
      } : null;
    }
  }
  const medium = players.find(p => p.role === "medium");
  if (medium) {
    const t = room.actions.get(medium.id);
    const target = t ? room.players.get(t) : null;
    if (target && !target.alive) medium.privateResult = {
      type: "medium", targetId: target.id, nickname: target.nickname,
      result: target.role === "mafia" ? "마피아" : "시민 진영"
    };
  }
  if (checkWinner(room)) return;
  setPhase(room, "announcement", room.message, PHASE_SECONDS.announcement);
}
function resolveVote(room) {
  const counts = {};
  for (const target of room.votes.values()) {
    if (target !== "abstain") counts[target] = (counts[target] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  if (!ranked.length) room.message = "투표 결과: 기권 또는 무효표로 처형이 없습니다.";
  else {
    const top = ranked[0][1];
    const tied = ranked.filter(([,n]) => n === top);
    if (tied.length !== 1) room.message = "투표 결과: 최다 득표 동률로 처형이 없습니다.";
    else {
      const target = room.players.get(tied[0][0]);
      if (target && target.alive) {
        target.alive = false;
        revealRole(room, target);
        room.message = `투표 결과: ${target.nickname}님이 처형되었습니다. 직업은 ${roleName(target.role)}입니다.`;
      }
    }
  }
  if (checkWinner(room)) return;
  setPhase(room, "verdict", room.message, PHASE_SECONDS.verdict);
}
function roleName(role) {
  return ({mafia:"마피아", police:"경찰", doctor:"의사", medium:"영매", citizen:"시민"})[role] || "미배정";
}
function handleTimeout(roomCode, expectedPhase) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== expectedPhase || room.status !== "playing") return;
  if (expectedPhase === "night") resolveNight(room);
  else if (expectedPhase === "announcement") setPhase(room, "discussion", "토론 시간입니다. 마피아를 추리하세요.", PHASE_SECONDS.discussion);
  else if (expectedPhase === "discussion") {
    room.votes.clear();
    setPhase(room, "voting", "투표할 플레이어를 선택하세요.", PHASE_SECONDS.voting);
  } else if (expectedPhase === "voting") resolveVote(room);
  else if (expectedPhase === "verdict") { room.round += 1; beginNight(room); }
}
function assignRoles(room) {
  const players = alivePlayers(room);
  const n = players.length;
  const roles = [];
  const mafiaCount = n >= 12 ? 3 : 2;
  for (let i=0;i<mafiaCount;i++) roles.push("mafia");
  roles.push("police","doctor","medium");
  while (roles.length < n) roles.push("citizen");
  for (let i=roles.length-1;i>0;i--) {
    const j = crypto.randomInt(i+1);
    [roles[i],roles[j]] = [roles[j],roles[i]];
  }
  players.forEach((p,i) => { p.role = roles[i]; p.alive = true; p.privateResult = null; });
}
function requireHost(socket, room) {
  const p = playerFor(room, socket);
  return p && p.isHost && socket.data.hostToken && socket.data.hostToken === room.hostToken;
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "mafia-night-live", rooms: rooms.size }));
app.get("/config", (_req, res) => res.json({ service: "mafia-night-live", version: "1.0.0" }));

io.on("connection", socket => {
  socket.on("room:create", ({ nickname } = {}) => {
    nickname = String(nickname || "진행자").trim().slice(0, 16) || "진행자";
    if ([...rooms.values()].filter(r => r.status !== "finished").length > 100) return fail(socket, "현재 생성 가능한 방이 가득 찼습니다.");
    let roomCode;
    do { roomCode = code(); } while (rooms.has(roomCode));
    const hostId = id();
    const hostToken = crypto.randomBytes(24).toString("hex");
    const room = {
      code: roomCode, hostToken, status: "lobby", phase: "lobby", round: 0,
      deadline: null, message: "참가자를 기다리는 중입니다.", winner: null,
      maxPlayers: 12, players: new Map(), votes: new Map(), actions: new Map(),
      timer: null, revealedRoles: new Map()
    };
    room.players.set(hostId, { id: hostId, nickname, role: null, alive: true, isHost: true, connected: true, socketId: socket.id });
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = hostId;
    socket.data.hostToken = hostToken;
    socket.emit("created", { code: roomCode, playerId: hostId, hostToken });
    emitRoom(room);
  });

  socket.on("room:join", ({ code: roomCode, nickname } = {}) => {
    roomCode = String(roomCode || "").trim().toUpperCase();
    nickname = String(nickname || "").trim().slice(0, 16);
    const room = rooms.get(roomCode);
    if (!room) return fail(socket, "방 코드를 찾을 수 없습니다.");
    if (!nickname) return fail(socket, "닉네임을 입력하세요.");
    if (room.status !== "lobby") return fail(socket, "게임이 이미 시작되어 관전으로만 입장할 수 있습니다.");
    if (alivePlayers(room).length >= room.maxPlayers) return fail(socket, "방이 가득 찼습니다.");
    if ([...room.players.values()].some(p => !p.isHost && p.nickname.toLowerCase() === nickname.toLowerCase())) return fail(socket, "이미 사용 중인 닉네임입니다.");
    const playerId = id();
    room.players.set(playerId, { id: playerId, nickname, role: null, alive: true, isHost: false, connected: true, socketId: socket.id, privateResult: null });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
    socket.emit("joined", { code: roomCode, playerId });
    emitRoom(room);
  });

  socket.on("room:reconnect", ({ code: roomCode, playerId, hostToken } = {}) => {
    roomCode = String(roomCode || "").toUpperCase();
    const room = rooms.get(roomCode);
    const p = room?.players.get(playerId);
    if (!room || !p) return fail(socket, "복구할 참가자 정보를 찾지 못했습니다. 새로 입장해 주세요.");
    if (p.connected && p.socketId !== socket.id) {
      const old = io.sockets.sockets.get(p.socketId);
      if (old) old.disconnect(true);
    }
    if (p.isHost && (!hostToken || hostToken !== room.hostToken)) return fail(socket, "진행자 인증이 만료되었습니다. 방을 다시 생성해야 합니다.");
    p.connected = true; p.socketId = socket.id;
    if (p.isHost) socket.data.hostToken = hostToken;
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
    socket.emit("reconnected", { code: roomCode, playerId });
    emitRoom(room);
  });

  socket.on("room:watch", ({ code: roomCode } = {}) => {
    roomCode = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return fail(socket, "방 코드를 찾을 수 없습니다.");
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.isWatcher = true;
    socket.emit("state", publicState(room));
  });

  socket.on("game:start", () => {
    const room = roomFor(socket);
    if (!room || !requireHost(socket, room)) return fail(socket, "진행자만 게임을 시작할 수 있습니다.");
    const players = alivePlayers(room);
    if (room.status !== "lobby") return fail(socket, "이미 시작된 게임입니다.");
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return fail(socket, `참가자는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이어야 합니다.`);
    room.status = "playing"; room.round = 1; room.revealedRoles = new Map();
    assignRoles(room);
    emitRoom(room);
    beginNight(room);
  });

  socket.on("game:action", ({ targetId } = {}) => {
    const room = roomFor(socket);
    const p = room && playerFor(room, socket);
    if (!room || !p || room.status !== "playing" || room.phase !== "night") return fail(socket, "지금은 밤 행동을 할 수 없습니다.");
    if (!p.alive || p.isHost) return fail(socket, "생존 플레이어만 행동할 수 있습니다.");
    if (!["mafia","police","doctor","medium"].includes(p.role)) return fail(socket, "이 직업은 밤 능력이 없습니다.");
    if (room.actions.has(p.id)) return fail(socket, "이번 밤 행동을 이미 제출했습니다.");
    const target = room.players.get(targetId);
    if (!target || target.isHost) return fail(socket, "유효한 플레이어를 선택하세요.");
    if (p.role === "medium") {
      if (target.alive) return fail(socket, "영매는 탈락한 플레이어만 조사할 수 있습니다.");
    } else if (!target.alive) return fail(socket, "생존한 플레이어를 선택하세요.");
    if (target.id === p.id && p.role !== "doctor") return fail(socket, "자기 자신은 선택할 수 없습니다.");
    if (p.role === "mafia" && target.role === "mafia") return fail(socket, "같은 마피아 진영은 대상으로 선택할 수 없습니다.");
    room.actions.set(p.id, target.id);
    socket.emit("action_ack", { ok: true, message: "행동을 제출했습니다." });
    emitRoom(room);
    const active = alivePlayers(room).filter(x => ["mafia","police","doctor","medium"].includes(x.role));
    if (active.every(x => room.actions.has(x.id))) {
      if (room.timer) clearTimeout(room.timer);
      resolveNight(room);
    }
  });

  socket.on("game:vote", ({ targetId } = {}) => {
    const room = roomFor(socket);
    const p = room && playerFor(room, socket);
    if (!room || !p || room.status !== "playing" || room.phase !== "voting") return fail(socket, "지금은 투표할 수 없습니다.");
    if (!p.alive || p.isHost) return fail(socket, "생존 플레이어만 투표할 수 있습니다.");
    if (targetId !== "abstain") {
      const target = room.players.get(targetId);
      if (!target || target.isHost || !target.alive || target.id === p.id) return fail(socket, "유효한 다른 생존자를 선택하세요.");
    }
    room.votes.set(p.id, targetId);
    socket.emit("vote_ack", { ok: true, message: "투표를 제출했습니다." });
    emitRoom(room);
    if (alivePlayers(room).every(x => room.votes.has(x.id))) {
      if (room.timer) clearTimeout(room.timer);
      resolveVote(room);
    }
  });

  socket.on("host:advance", () => {
    const room = roomFor(socket);
    if (!room || !requireHost(socket, room)) return fail(socket, "진행자 권한이 필요합니다.");
    if (room.status !== "playing") return fail(socket, "진행 중인 게임이 아닙니다.");
    if (room.timer) clearTimeout(room.timer);
    handleTimeout(room.code, room.phase);
  });

  socket.on("host:restart", () => {
    const room = roomFor(socket);
    if (!room || !requireHost(socket, room)) return fail(socket, "진행자 권한이 필요합니다.");
    if (room.timer) clearTimeout(room.timer);
    room.status = "lobby"; room.phase = "lobby"; room.round = 0; room.deadline = null;
    room.winner = null; room.message = "새 게임 참가자를 기다리는 중입니다.";
    room.votes.clear(); room.actions.clear(); room.revealedRoles.clear();
    for (const p of room.players.values()) {
      p.role = null; p.alive = true; p.privateResult = null;
    }
    emitRoom(room);
  });

  socket.on("host:kick", ({ targetId } = {}) => {
    const room = roomFor(socket);
    if (!room || !requireHost(socket, room)) return fail(socket, "진행자 권한이 필요합니다.");
    const p = room.players.get(targetId);
    if (!p || p.isHost) return fail(socket, "대상을 찾을 수 없습니다.");
    if (p.socketId) io.to(p.socketId).emit("kicked", "진행자에 의해 방에서 퇴장되었습니다.");
    room.players.delete(targetId);
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const room = roomFor(socket);
    const p = room && playerFor(room, socket);
    if (p && p.socketId === socket.id) {
      p.connected = false;
      if (room.status === "lobby" && !p.isHost) {
        // Keep lobby slot briefly; this starter keeps the entry until host kicks or game starts.
      }
      emitRoom(room);
    }
  });
});

server.listen(PORT, () => console.log(`MAFIA NIGHT LIVE listening on ${PORT}`));

