(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "home";
  const roomParam = (params.get("room") || "").toUpperCase();
  const $ = id => document.getElementById(id);
  const roleInfo = {
    mafia: {name:"마피아",icon:"♠",desc:"밤마다 한 명을 제거 대상으로 선택합니다. 다른 마피아와 협력하세요."},
    police: {name:"경찰",icon:"⌕",desc:"밤마다 한 명을 조사해 마피아인지 확인합니다. 결과는 본인에게만 보입니다."},
    doctor: {name:"의사",icon:"✚",desc:"밤마다 한 명을 보호합니다. 공격 대상과 일치하면 생존합니다."},
    medium: {name:"영매",icon:"◉",desc:"밤마다 이미 탈락한 플레이어의 진영을 확인합니다."},
    citizen: {name:"시민",icon:"◎",desc:"특별한 밤 능력은 없습니다. 토론과 투표로 마피아를 찾아내세요."}
  };
  let socket = null, state = null, me = null, isHost = false, hostToken = null;
  let chosenTarget = null, countdownInterval = null;
  const saveSession = (code, playerId, host=false, token=null) => {
    try { sessionStorage.setItem("mn_session", JSON.stringify({code,playerId,host,token})); } catch {}
  };
  const readSession = () => { try { return JSON.parse(sessionStorage.getItem("mn_session") || "null"); } catch { return null; } };
  function toast(msg) {
    const el = $("toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }
  function connect() {
    if (socket) return;
    const backend = localStorage.getItem("mn_backend_url") || prompt("게임 서버 주소를 입력하세요 (예: https://mafia-night-live.onrender.com)");
    if (!backend) { toast("서버 주소가 필요합니다."); return; }
    localStorage.setItem("mn_backend_url", backend.replace(/\/+$/,""));
    socket = io(backend.replace(/\/+$/,""), { transports:["websocket","polling"] });
    socket.on("connect", () => {
      const saved = readSession();
      if (saved && mode !== "broadcast") {
        socket.emit("room:reconnect", {code:saved.code,playerId:saved.playerId,hostToken:saved.token || null});
      }
    });
    socket.on("connect_error", () => toast("서버 연결에 실패했습니다. 주소와 서버 상태를 확인하세요."));
    socket.on("error_message", msg => toast(msg));
    socket.on("created", data => {
      me = data.playerId; isHost = true; hostToken = data.hostToken;
      saveSession(data.code, me, true, hostToken);
      showGame(data.code);
      history.replaceState({}, "", `?room=${data.code}`);
      socket.data = socket.data || {};
    });
    socket.on("joined", data => {
      me = data.playerId; isHost = false; saveSession(data.code, me);
      showGame(data.code); history.replaceState({}, "", `?room=${data.code}`);
    });
    socket.on("reconnected", data => {
      me = data.playerId;
      const s = readSession(); isHost = !!s?.host; hostToken = s?.token || null;
      showGame(data.code);
    });
    socket.on("state", s => { state = s; renderState(); });
    socket.on("private_state", p => { me = p.playerId; renderPrivate(p); });
    socket.on("action_ack", d => toast(d.message));
    socket.on("vote_ack", d => toast(d.message));
    socket.on("kicked", msg => { toast(msg); setTimeout(() => location.href = location.pathname, 900); });
  }
  function showGame(code) {
    $("home").classList.add("hidden"); $("game").classList.remove("hidden");
    $("roomCode").textContent = code;
    $("broadcastLink").href = `${location.origin}${location.pathname}?mode=broadcast&room=${code}`;
    $("hostControls").classList.toggle("hidden", !isHost);
  }
  function createRoom() {
    connect();
    const nick = $("hostNick").value.trim() || "진행자";
    const go = () => socket.emit("room:create", {nickname:nick});
    if (socket?.connected) go(); else socket?.once("connect", go);
  }
  function joinRoom() {
    connect();
    const code = $("joinCode").value.trim().toUpperCase();
    const nickname = $("playerNick").value.trim();
    if (!code || !nickname) return toast("방 코드와 닉네임을 입력하세요.");
    const go = () => socket.emit("room:join", {code,nickname});
    if (socket?.connected) go(); else socket?.once("connect", go);
  }
  function renderState() {
    if (!state) return;
    if (mode === "broadcast") return renderBroadcast();
    showGame(state.code);
    $("roomCode").textContent = state.code;
    $("playerCount").textContent = `${state.players.length} / ${state.maxPlayers}`;
    const titles = {lobby:"참가자 대기",night:"밤",announcement:"아침 결과",discussion:"토론",voting:"투표",verdict:"투표 결과",finished:"게임 종료"};
    $("phaseTitle").textContent = `${titles[state.phase] || state.phase}${state.round ? ` · ${state.round}라운드` : ""}`;
    $("phaseMessage").textContent = state.message || "";
    $("players").innerHTML = state.players.map(p => {
      const role = state.revealedRoles?.[p.id];
      const isMe = p.id === me;
      const status = !p.connected ? "연결 끊김" : p.alive ? "생존" : "탈락";
      return `<div class="player-card ${p.alive ? "" : "dead"}"><div class="player-name">${escapeHtml(p.nickname)}${isMe ? " (나)" : ""}</div><div class="player-meta"><span><i class="dot-status ${p.connected ? "" : "off"}"></i>${status}</span><span>${role ? roleInfo[role]?.name || role : (p.alive ? "미공개" : "탈락")}</span></div></div>`;
    }).join("");
    $("countdown").classList.toggle("hidden", !state.deadline || state.status !== "playing");
    if (state.deadline) startCountdown();
    if (state.status === "finished") {
      $("roleTitle").textContent = state.winner === "mafia" ? "마피아 진영 승리" : "시민 진영 승리";
      $("roleDescription").textContent = "모든 직업이 공개되었습니다. 재경기로 새 판을 시작할 수 있습니다.";
    }
  }
  function renderPrivate(p) {
    isHost = !!p.isHost; hostToken = p.hostToken || hostToken;
    $("hostControls").classList.toggle("hidden", !isHost);
    if (p.role && roleInfo[p.role]) {
      const r = roleInfo[p.role];
      $("roleIcon").textContent = r.icon; $("roleTitle").textContent = r.name; $("roleDescription").textContent = r.desc;
      $("roleIcon").style.color = p.role === "mafia" ? "var(--red)" : "var(--cyan)";
    } else if (p.isHost) {
      $("roleIcon").textContent = "GM"; $("roleTitle").textContent = "진행자";
      $("roleDescription").textContent = "참가자를 확인한 뒤 게임을 시작하세요.";
    }
    const result = p.privateResult;
    $("privateResult").classList.toggle("hidden", !result);
    if (result) $("privateResult").textContent = `${result.nickname} 조사 결과: ${result.result}`;
    const actions = $("actions"); actions.innerHTML = "";
    if (!state || state.status !== "playing" || !p.alive || p.isHost) return;
    if (state.phase === "night" && ["mafia","police","doctor","medium"].includes(p.role)) {
      const candidates = state.players.filter(x => p.role === "medium" ? !x.alive : x.alive && (p.role === "doctor" || x.id !== p.playerId) && !(p.role === "mafia" && x.id === p.playerId));
      actions.innerHTML = `<div class="section-kicker">NIGHT ACTION</div><p class="muted">행동할 대상을 선택하세요.</p>` + candidates.map(x => `<button class="target-btn" data-target="${x.id}">${escapeHtml(x.nickname)} · ${x.alive ? "생존" : "탈락"}</button>`).join("");
      actions.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => {
        if (confirm(`${b.textContent} 대상을 선택할까요?`)) socket.emit("game:action",{targetId:b.dataset.target});
      }));
      if (p.actionSubmitted) actions.insertAdjacentHTML("beforeend", `<p class="private-result">이번 밤 행동을 제출했습니다.</p>`);
    } else if (state.phase === "voting") {
      const candidates = state.players.filter(x => x.alive && x.id !== p.playerId);
      actions.innerHTML = `<div class="section-kicker">PUBLIC VOTE</div><p class="muted">처형할 대상을 선택하세요.</p>` + candidates.map(x => `<button class="target-btn" data-target="${x.id}">${escapeHtml(x.nickname)}${state.voteCounts?.[x.id] ? ` · ${state.voteCounts[x.id]}표` : ""}</button>`).join("") + `<button class="target-btn" data-target="abstain">기권하기</button>`;
      actions.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => {
        if (confirm(`${b.textContent}에 투표할까요? 마감 전 재투표할 수 있습니다.`)) socket.emit("game:vote",{targetId:b.dataset.target});
      }));
      if (p.hasVoted) actions.insertAdjacentHTML("beforeend", `<p class="private-result">투표 제출 완료 · 마감 전 변경 가능</p>`);
    } else if (!p.alive) {
      actions.innerHTML = `<p class="muted">탈락했습니다. 다음 게임까지 관전할 수 있습니다.</p>`;
    }
  }
  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    const tick = () => {
      if (!state?.deadline) return;
      const secs = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
      $("countdown").textContent = `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
      if (mode === "broadcast") $("broadcastTimer").textContent = $("countdown").textContent;
    };
    tick(); countdownInterval = setInterval(tick, 300);
  }
  function renderBroadcast() {
    $("broadcastCode").textContent = `ROOM ${state.code}`;
    const labels = {lobby:"참가자 대기",night:"밤이 찾아왔습니다",announcement:"아침 결과",discussion:"토론 시간",voting:"최후의 투표",verdict:"판결",finished:state.winner === "mafia" ? "MAFIA VICTORY" : "CITIZENS VICTORY"};
    $("broadcastPhase").textContent = labels[state.phase] || "MAFIA NIGHT";
    $("broadcastMessage").textContent = state.message || "";
    $("broadcastRound").textContent = `ROUND ${String(state.round).padStart(2,"0")}`;
    $("broadcastAlive").textContent = `ALIVE ${String(state.players.filter(p=>p.alive).length).padStart(2,"0")}`;
    $("broadcastPlayers").innerHTML = state.players.map(p => {
      const role = state.revealedRoles?.[p.id];
      return `<div class="broadcast-player ${p.alive ? "" : "dead"}"><div class="avatar">${escapeHtml(p.nickname.slice(0,1))}</div><strong>${escapeHtml(p.nickname)}</strong><small>${p.alive ? "ALIVE" : (roleInfo[role]?.name || "ELIMINATED")}</small></div>`;
    }).join("");
    if (state.deadline) startCountdown(); else $("broadcastTimer").textContent = "--";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function setup() {
    if (mode === "broadcast") {
      $("home").classList.add("hidden"); $("game").classList.add("hidden"); $("broadcast").classList.remove("hidden");
      const backend = localStorage.getItem("mn_backend_url") || prompt("게임 서버 주소를 입력하세요 (예: https://mafia-night-live.onrender.com)");
      if (!backend) { toast("서버 주소가 필요합니다."); return; }
      localStorage.setItem("mn_backend_url", backend.replace(/\/+$/,""));
      socket = io(backend.replace(/\/+$/,""), {transports:["websocket","polling"]});
      socket.on("connect", () => socket.emit("room:watch", {code:roomParam}));
      socket.on("state", s => {state=s;renderBroadcast();});
      socket.on("connect_error", () => toast("서버 연결에 실패했습니다. 주소를 확인하세요."));
      socket.on("error_message", toast);
      return;
    }
    $("createRoom").addEventListener("click", createRoom);
    $("joinRoom").addEventListener("click", joinRoom);
    $("copyCode").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("roomCode").textContent); toast("방 코드를 복사했습니다."); } catch { toast("방 코드: "+$("roomCode").textContent); }});
    $("startGame").addEventListener("click", () => socket.emit("game:start"));
    $("advancePhase").addEventListener("click", () => socket.emit("host:advance"));
    $("restartGame").addEventListener("click", () => {if(confirm("게임을 초기화하고 로비로 돌아갈까요?"))socket.emit("host:restart");});
    $("joinCode").addEventListener("input", e => e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
    if (roomParam) {
      const saved = readSession();
      if (saved && saved.code === roomParam) connect();
      else { $("joinCode").value = roomParam; $("joinCode").focus(); }
    }
  }
  // Broadcast observer uses a dedicated event; never joins as a player.
  setup();
})();


