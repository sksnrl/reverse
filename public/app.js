(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "home";
  const roomParam = (params.get("room") || "").toUpperCase();
  const $ = id => document.getElementById(id);


  // ==========================================================
  // Web Audio API 기반 긴장감 넘치는 사운드 신시사이저 엔진
  // (외부 mp3 파일 없이 브라우저 자체 오디오 합성을 통해 무음 방지 & 즉각 재생)
  // ==========================================================
  const SoundFX = (() => {
    let ctx = null;
    let muted = localStorage.getItem("mn_muted") === "true";

    function getCtx() {
      if (!ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) ctx = new AudioContext();
      }
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
      return ctx;
    }

    function isMuted() {
      return muted;
    }

    function toggleMute() {
      muted = !muted;
      localStorage.setItem("mn_muted", muted ? "true" : "false");
      return muted;
    }

    // 1. UI 클릭 / 버튼 터치음 (스마트 틱)
    function click() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.06);
    }

    // 2. 대상 지목 / 투표 선택음 (긴장감 있는 블립)
    function select() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.13);
    }

    // 3. 밤 페이즈 전환 (심야의 음산한 저음 콰앙 & 앰비언트)
    function phaseNight() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      // 저음 드론
      const osc1 = c.createOscillator();
      const osc2 = c.createOscillator();
      const gain = c.createGain();
      osc1.type = "sawtooth";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(110, now);
      osc1.frequency.exponentialRampToValueAtTime(55, now + 1.8);
      osc2.frequency.setValueAtTime(58, now);
      osc2.frequency.exponentialRampToValueAtTime(45, now + 2.0);

      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 1.8);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.3);
      osc2.stop(now + 2.3);
    }

    // 4. 낮 / 아침 발표 (종소리 & 서광 화음)
    function phaseDay() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.18, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 1.2);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.3);
      });
    }

    // 5. 투표 시작 (긴장감 있는 법정 타격음 / 고공 타격)
    function phaseVote() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }

    // 6. 타이머 심장박동 / 시계 째깍 소리 (틱)
    function tick(urgent = false) {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(urgent ? 920 : 600, now);
      osc.frequency.exponentialRampToValueAtTime(urgent ? 450 : 200, now + 0.04);
      gain.gain.setValueAtTime(urgent ? 0.15 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    // 7. 처형 / 탈락 음 (묵직한 사형 판결 타격음)
    function eliminated() {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      // 노이즈 버퍼 + 저음 감쇠 쿵
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.9);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    }

    // 8. 승리 팡파르 (마피아 승리 vs 시민 승리)
    function victory(winner) {
      if (muted) return;
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      const notes = winner === "mafia"
        ? [220, 261.63, 207.65, 174.61] // 음산한 마피아 승리 단조
        : [523.25, 659.25, 783.99, 1046.50]; // 찬란한 시민 승리 장조
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = winner === "mafia" ? "sawtooth" : "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.22);
        gain.gain.setValueAtTime(0.25, now + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 1.0);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 1.1);
      });
    }

    return {
      getCtx, isMuted, toggleMute, click, select, phaseNight, phaseDay, phaseVote, tick, eliminated, victory
    };
  })();


  // 직업별 정보
  const roleInfo = {
    mafia: {
      name: "마피아",
      icon: "🕵️‍♂️",
      symbol: "♠",
      desc: "어둠 속에 숨어 매일 밤 한 명을 제거합니다. 동료 마피아와 함께 도시를 장악하세요.",
      color: "var(--crimson)"
    },
    police: {
      name: "경찰",
      icon: "👮‍♂️",
      symbol: "⌕",
      desc: "밤마다 한 명을 지목해 마피아 여부를 수사합니다. 결과는 본인에게만 은밀히 통보됩니다.",
      color: "var(--cyan)"
    },
    doctor: {
      name: "의사",
      icon: "💉",
      symbol: "✚",
      desc: "밤마다 한 명을 선택해 치명적인 습격으로부터 보호하고 생명을 구호합니다.",
      color: "var(--emerald)"
    },
    medium: {
      name: "영매",
      icon: "🔮",
      symbol: "◉",
      desc: "밤마다 이미 사망한 영혼들의 정체와 진영을 감응하여 확인합니다.",
      color: "var(--purple)"
    },
    citizen: {
      name: "시민",
      icon: "👤",
      symbol: "◎",
      desc: "특수 능력은 없으나 예리한 관찰과 낮 투표를 통해 도시의 마피아를 축출해야 합니다.",
      color: "var(--gold)"
    }
  };

  const phaseMeta = {
    lobby: { title: "참가자 대기", icon: "⌛", bodyClass: "theme-lobby" },
    night: { title: "밤의 숙청", icon: "🌙", bodyClass: "theme-night" },
    announcement: { title: "새벽 결과 발표", icon: "📢", bodyClass: "theme-day" },
    discussion: { title: "낮의 토론", icon: "☀️", bodyClass: "theme-day" },
    voting: { title: "최후의 투표", icon: "⚖️", bodyClass: "theme-voting" },
    verdict: { title: "심판의 결과", icon: "🩸", bodyClass: "theme-voting" },
    finished: { title: "게임 종료", icon: "🏆", bodyClass: "theme-lobby" }
  };

  let socket = null, state = null, me = null, isHost = false, hostToken = null;
  let countdownInterval = null, lastPhase = null, lastSec = null;

  const saveSession = (code, playerId, host=false, token=null) => {
    try { sessionStorage.setItem("mn_session", JSON.stringify({code,playerId,host,token})); } catch {}
  };
  const readSession = () => { try { return JSON.parse(sessionStorage.getItem("mn_session") || "null"); } catch { return null; } };

  function toast(msg) {
    const el = $("toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    SoundFX.click();
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function getBackendUrl() {
    let url = localStorage.getItem("mn_backend_url");
    if (!url) {
      if (location.origin.includes("render.com") || location.origin.includes("localhost") || location.origin.includes("127.0.0.1")) {
        url = location.origin;
      } else {
        url = prompt("게임 서버 주소를 입력하세요 (예: https://mafia-night-live.onrender.com)");
      }
    }
    if (url) {
      url = url.replace(/\/+$/, "");
      localStorage.setItem("mn_backend_url", url);
    }
    return url;
  }

  function connect() {
    if (socket) return;
    SoundFX.getCtx();
    const backend = getBackendUrl();
    if (!backend) { toast("서버 주소가 설정되지 않았습니다."); return; }

    socket = io(backend, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      const saved = readSession();
      if (saved && mode !== "broadcast") {
        socket.emit("room:reconnect", { code: saved.code, playerId: saved.playerId, hostToken: saved.token || null });
      }
    });

    socket.on("connect_error", () => toast("서버 연결에 실패했습니다. Render 서버가 깨어나는 중일 수 있습니다."));
    socket.on("error_message", msg => toast(msg));
    
    socket.on("created", data => {
      me = data.playerId; isHost = true; hostToken = data.hostToken;
      saveSession(data.code, me, true, hostToken);
      showGame(data.code);
      history.replaceState({}, "", `?room=${data.code}`);
    });

    socket.on("joined", data => {
      me = data.playerId; isHost = false;
      saveSession(data.code, me);
      showGame(data.code);
      history.replaceState({}, "", `?room=${data.code}`);
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
    $("home").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("roomCode").textContent = code;
    $("broadcastLink").href = `${location.origin}${location.pathname}?mode=broadcast&room=${code}`;
    $("hostControls").classList.toggle("hidden", !isHost);
  }

  function createRoom() {
    SoundFX.click();
    connect();
    const nick = $("hostNick").value.trim() || "진행자";
    const go = () => socket.emit("room:create", { nickname: nick });
    if (socket?.connected) go(); else socket?.once("connect", go);
  }

  function joinRoom() {
    SoundFX.click();
    connect();
    const code = $("joinCode").value.trim().toUpperCase();
    const nickname = $("playerNick").value.trim();
    if (!code || !nickname) return toast("방 코드와 닉네임을 입력하세요.");
    const go = () => socket.emit("room:join", { code, nickname });
    if (socket?.connected) go(); else socket?.once("connect", go);
  }

  function handlePhaseSound(phase, winner) {
    if (phase === lastPhase) return;
    lastPhase = phase;
    if (phase === "night") SoundFX.phaseNight();
    else if (phase === "announcement" || phase === "discussion") SoundFX.phaseDay();
    else if (phase === "voting") SoundFX.phaseVote();
    else if (phase === "verdict") SoundFX.eliminated();
    else if (phase === "finished") SoundFX.victory(winner);
  }

  function renderState() {
    if (!state) return;
    handlePhaseSound(state.phase, state.winner);

    if (mode === "broadcast") return renderBroadcast();

    showGame(state.code);
    $("roomCode").textContent = state.code;
    $("playerCount").textContent = `${state.players.length} / ${state.maxPlayers}`;

    const currentMeta = phaseMeta[state.phase] || { title: state.phase, icon: "⚔️", bodyClass: "theme-lobby" };
    document.body.className = currentMeta.bodyClass;
    $("phaseIcon").textContent = currentMeta.icon;
    $("phaseTitle").textContent = `${currentMeta.title}${state.round ? ` · 제 ${state.round} 라운드` : ""}`;
    $("phaseMessage").textContent = state.message || "";

    $("players").innerHTML = state.players.map(p => {
      const isMe = p.id === me;
      const role = state.revealedRoles?.[p.id];
      const rObj = role ? roleInfo[role] : null;
      const statusText = !p.connected ? "접속 끊김" : p.alive ? "생존" : "탈락";
      const avatarIcon = p.alive ? (isMe ? "😎" : "👤") : "💀";

      return `
        <div class="player-card ${p.alive ? "" : "dead"} ${isMe ? "is-me" : ""}">
          <div class="player-head">
            <div class="avatar-circle">${avatarIcon}</div>
            <div class="player-name-wrap">
              <div class="player-name" title="${escapeHtml(p.nickname)}">${escapeHtml(p.nickname)}</div>
              ${isMe ? '<div class="player-tag-me">YOU</div>' : ''}
            </div>
          </div>
          <div class="player-meta">
            <span class="status-badge">
              <i class="dot-status ${p.connected ? "" : "off"}"></i>
              <span>${statusText}</span>
            </span>
            <span class="role-reveal-tag">
              ${rObj ? rObj.name : (p.alive ? "미공개" : "사망")}
            </span>
          </div>
        </div>
      `;
    }).join("");

    $("countdown").classList.toggle("hidden", !state.deadline || state.status !== "playing");
    if (state.deadline) startCountdown();

    if (state.status === "finished") {
      const isMafiaWin = state.winner === "mafia";
      $("roleTitle").textContent = isMafiaWin ? "마피아 진영 승리!" : "시민 진영 승리!";
      $("roleIcon").textContent = isMafiaWin ? "🕵️‍♂️" : "🏆";
      $("roleDescription").textContent = "모든 진실이 밝혀졌습니다. 재경기 버튼으로 새로운 판을 시작할 수 있습니다.";
    }
  }

  function renderPrivate(p) {
    isHost = !!p.isHost; hostToken = p.hostToken || hostToken;
    $("hostControls").classList.toggle("hidden", !isHost);

    if (p.role && roleInfo[p.role]) {
      const r = roleInfo[p.role];
      $("roleIcon").textContent = r.icon;
      $("roleWatermark").textContent = r.symbol;
      $("roleTitle").textContent = r.name;
      $("roleDescription").textContent = r.desc;
      $("roleIcon").style.borderColor = r.color;
    } else if (p.isHost) {
      $("roleIcon").textContent = "👑";
      $("roleWatermark").textContent = "GM";
      $("roleTitle").textContent = "진행자 (게임 마스터)";
      $("roleDescription").textContent = "참가자들을 확인하고 게임의 흐름을 통제합니다.";
    }

    const result = p.privateResult;
    $("privateResult").classList.toggle("hidden", !result);
    if (result) {
      $("privateResult").innerHTML = `<strong>[조사 보고]</strong> ${escapeHtml(result.nickname)}님의 정체는 <strong>${escapeHtml(result.result)}</strong>입니다.`;
    }

    const actions = $("actions");
    actions.innerHTML = "";
    if (!state || state.status !== "playing" || !p.alive || p.isHost) return;

    if (state.phase === "night" && ["mafia", "police", "doctor", "medium"].includes(p.role)) {
      const candidates = state.players.filter(x => 
        p.role === "medium" 
          ? !x.alive 
          : x.alive && (p.role === "doctor" || x.id !== p.playerId) && !(p.role === "mafia" && x.id === p.playerId)
      );

      actions.innerHTML = `
        <div class="kicker">SECRET NIGHT ACTION</div>
        <p class="role-desc" style="margin-bottom:8px;">능력을 행사할 대상을 선택하세요.</p>
        ${candidates.map(x => `
          <button class="target-btn" data-target="${x.id}">
            <span>🎯 ${escapeHtml(x.nickname)}</span>
            <small style="opacity:0.7">${x.alive ? "생존" : "사망"}</small>
          </button>
        `).join("")}
      `;

      actions.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => {
        SoundFX.select();
        if (confirm(`[${b.querySelector("span").textContent.replace("🎯 ","")}] 님을 선택하시겠습니까?`)) {
          SoundFX.click();
          socket.emit("game:action", { targetId: b.dataset.target });
        }
      }));

      if (p.actionSubmitted) {
        actions.insertAdjacentHTML("beforeend", `<div class="private-status-note">✓ 이번 밤의 비밀 작전 지시를 완료했습니다.</div>`);
      }
    } else if (state.phase === "voting") {
      const candidates = state.players.filter(x => x.alive && x.id !== p.playerId);
      actions.innerHTML = `
        <div class="kicker">PUBLIC TRIAL VOTE</div>
        <p class="role-desc" style="margin-bottom:8px;">의심되는 용의자에게 사형 표를 던지세요.</p>
        ${candidates.map(x => `
          <button class="target-btn" data-target="${x.id}">
            <span>⚖️ ${escapeHtml(x.nickname)}</span>
            <small style="color:var(--gold); font-weight:bold;">${state.voteCounts?.[x.id] ? `${state.voteCounts[x.id]}표 획득` : "0표"}</small>
          </button>
        `).join("")}
        <button class="target-btn" data-target="abstain" style="margin-top:6px; opacity:0.8;">
          <span>🏳️ 기권하기</span>
          <small>보류</small>
        </button>
      `;

      actions.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => {
        SoundFX.select();
        const name = b.querySelector("span").textContent;
        if (confirm(`${name}에 투표하시겠습니까? (투표 마감 전까지 변경 가능)`)) {
          SoundFX.click();
          socket.emit("game:vote", { targetId: b.dataset.target });
        }
      }));

      if (p.hasVoted) {
        actions.insertAdjacentHTML("beforeend", `<div class="private-status-note">✓ 투표가 정상 반영되었습니다. (마감 전 변경 가능)</div>`);
      }
    } else if (!p.alive) {
      actions.innerHTML = `<p class="role-desc" style="color:var(--crimson);">당신은 사망했습니다. 사후 세계에서 게임을 지켜보세요.</p>`;
    }
  }

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    const tick = () => {
      if (!state?.deadline) return;
      const secs = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
      const timeStr = `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
      if ($("countdownVal")) $("countdownVal").textContent = timeStr;
      if (mode === "broadcast" && $("broadcastTimer")) $("broadcastTimer").textContent = timeStr;

      // 1초 단위로 사운드 틱 발생 (마지막 10초는 긴박한 틱)
      if (secs !== lastSec) {
        lastSec = secs;
        if (secs > 0 && secs <= 10) {
          SoundFX.tick(true);
        } else if (secs > 0 && secs <= 25 && state.phase === "voting") {
          SoundFX.tick(false);
        }
      }
    };
    tick();
    countdownInterval = setInterval(tick, 250);
  }

  function renderBroadcast() {
    $("broadcastCode").textContent = `ROOM ${state.code}`;
    const titles = {
      lobby: "참가자 대기 중",
      night: "밤이 찾아왔습니다",
      announcement: "아침 결과 발표",
      discussion: "낮 토론 시간",
      voting: "최후의 심판 투표",
      verdict: "처형 판결",
      finished: state.winner === "mafia" ? "마피아 진영 승리!" : "시민 진영 승리!"
    };
    $("broadcastPhase").textContent = titles[state.phase] || "MAFIA NIGHT";
    $("broadcastMessage").textContent = state.message || "";
    $("broadcastRound").textContent = `ROUND ${String(state.round || 1).padStart(2,"0")}`;

    const alives = state.players.filter(p => p.alive).length;
    $("broadcastAlive").textContent = `ALIVE ${String(alives).padStart(2,"0")} / ${String(state.players.length).padStart(2,"0")}`;

    $("broadcastPlayers").innerHTML = state.players.map(p => {
      const role = state.revealedRoles?.[p.id];
      const rName = roleInfo[role]?.name || "ELIMINATED";
      return `
        <div class="broadcast-player ${p.alive ? "" : "dead"}">
          <div class="avatar">${p.alive ? "👤" : "💀"}</div>
          <strong>${escapeHtml(p.nickname)}</strong>
          <small>${p.alive ? "ALIVE" : rName}</small>
        </div>
      `;
    }).join("");

    if (state.deadline) startCountdown();
    else if ($("broadcastTimer")) $("broadcastTimer").textContent = "--:--";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function updateSoundBtn() {
    const btn = $("soundToggleBtn");
    if (!btn) return;
    const muted = SoundFX.isMuted();
    btn.textContent = muted ? "🔇" : "🔊";
    btn.title = muted ? "사운드 켜기" : "사운드 음소거";
  }

  function setup() {
    updateSoundBtn();

    const soundBtn = $("soundToggleBtn");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        const isMuted = SoundFX.toggleMute();
        updateSoundBtn();
        toast(isMuted ? "사운드가 음소거되었습니다." : "사운드가 활성화되었습니다.");
        if (!isMuted) SoundFX.click();
      });
    }

    $("serverConfigBtn").addEventListener("click", () => {
      SoundFX.click();
      const cur = localStorage.getItem("mn_backend_url") || "";
      const next = prompt("연결할 백엔드 서버 URL을 입력하세요:", cur);
      if (next !== null) {
        localStorage.setItem("mn_backend_url", next.trim().replace(/\/+$/, ""));
        toast("서버 주소가 저장되었습니다. 새로고침합니다.");
        setTimeout(() => location.reload(), 600);
      }
    });

    // 최초 화면 터치/클릭 시 AudioContext 언락
    document.addEventListener("pointerdown", () => {
      SoundFX.getCtx();
    }, { once: true });

    if (mode === "broadcast") {
      $("home").classList.add("hidden");
      $("game").classList.add("hidden");
      $("broadcast").classList.remove("hidden");
      document.body.className = "theme-night";

      const backend = getBackendUrl();
      if (!backend) { toast("서버 주소가 필요합니다."); return; }

      socket = io(backend, { transports: ["websocket", "polling"] });
      socket.on("connect", () => socket.emit("room:watch", { code: roomParam }));
      socket.on("state", s => { state = s; renderBroadcast(); });
      socket.on("connect_error", () => toast("방송 서버 연동에 실패했습니다."));
      socket.on("error_message", toast);
      return;
    }

    $("createRoom").addEventListener("click", createRoom);
    $("joinRoom").addEventListener("click", joinRoom);
    
    $("copyCode").addEventListener("click", async () => {
      SoundFX.click();
      try {
        await navigator.clipboard.writeText($("roomCode").textContent);
        toast("방 코드를 클립보드에 복사했습니다.");
      } catch {
        toast("방 코드: " + $("roomCode").textContent);
      }
    });

    $("startGame").addEventListener("click", () => {
      SoundFX.click();
      socket.emit("game:start");
    });
    $("advancePhase").addEventListener("click", () => {
      SoundFX.click();
      socket.emit("host:advance");
    });
    $("restartGame").addEventListener("click", () => {
      SoundFX.click();
      if (confirm("게임을 초기화하고 로비로 돌아갈까요?")) socket.emit("host:restart");
    });

    $("joinCode").addEventListener("input", e => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    if (roomParam) {
      const saved = readSession();
      if (saved && saved.code === roomParam) connect();
      else {
        $("joinCode").value = roomParam;
        $("joinCode").focus();
      }
    }
  }

  setup();
})();
