(() => {
  const $ = (id) => document.getElementById(id);

  const panel = $('panel');
  const togglePanelBtn = $('togglePanelBtn');
  const showPanelBtn = $('showPanelBtn');
  const roomInput = $('roomInput');
  const applyRoomBtn = $('applyRoomBtn');
  const statusEl = $('status');
  const fileInput = $('fileInput');
  const loadedFileNameEl = $('loadedFileName');
  const fontSizeSlider = $('fontSizeSlider');
  const fontSizeValue = $('fontSizeValue');
  const lineHeightSlider = $('lineHeightSlider');
  const lineHeightValue = $('lineHeightValue');
  const mirrorCheckbox = $('mirrorCheckbox');
  const flipVCheckbox = $('flipVCheckbox');
  const guideLineCheckbox = $('guideLineCheckbox');
  const guideLine = $('guideLine');
  const speedSlider = $('speedSlider');
  const speedValue = $('speedValue');
  const playBtn = $('playBtn');
  const topBtn = $('topBtn');
  const fullscreenBtn = $('fullscreenBtn');
  const fullscreenFloatBtn = $('fullscreenFloatBtn');
  const prompter = $('prompter');
  const prompterInner = $('prompterInner');
  const remoteMappingList = $('remoteMappingList');
  const resetMappingBtn = $('resetMappingBtn');
  const lastKeyHint = $('lastKeyHint');
  const remoteDebugLog = $('remoteDebugLog');
  const connectHidBtn = $('connectHidBtn');

  // ---------- Remote control diagnostic log ----------
  function logDebug(line) {
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${line}`;
    remoteDebugLog.prepend(entry);
    while (remoteDebugLog.children.length > 50) {
      remoteDebugLog.removeChild(remoteDebugLog.lastChild);
    }
  }

  // ---------- Read/write room from URL ----------
  function getRoomFromUrl() {
    const params = new URLSearchParams(location.search);
    return params.get('room') || 'default';
  }

  function setRoomInUrl(room) {
    const params = new URLSearchParams(location.search);
    params.set('room', room);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }

  let currentRoom = getRoomFromUrl();
  roomInput.value = currentRoom;

  // ---------- Local, non-synced display settings ----------
  function loadLocalSettings() {
    try {
      const raw = localStorage.getItem('xtele-settings');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveLocalSettings(patch) {
    const current = loadLocalSettings();
    localStorage.setItem('xtele-settings', JSON.stringify({ ...current, ...patch }));
  }

  const local = loadLocalSettings();
  fontSizeSlider.value = local.fontSize ?? 48;
  lineHeightSlider.value = local.lineHeight ?? 140;
  mirrorCheckbox.checked = !!local.mirrored;
  flipVCheckbox.checked = !!local.flippedV;
  guideLineCheckbox.checked = local.guideLine ?? true;
  speedSlider.value = local.speed ?? 40;

  function applyLocalSettings() {
    prompterInner.style.fontSize = `${fontSizeSlider.value}px`;
    fontSizeValue.textContent = `${fontSizeSlider.value}px`;

    const lh = Number(lineHeightSlider.value) / 100;
    prompterInner.style.lineHeight = String(lh);
    lineHeightValue.textContent = lh.toFixed(1);

    prompterInner.classList.toggle('mirrored', mirrorCheckbox.checked);
    prompterInner.classList.toggle('flipped-v', flipVCheckbox.checked);
    guideLine.classList.toggle('hidden', !guideLineCheckbox.checked);

    speedValue.textContent = `${speedSlider.value} px/s`;
  }
  applyLocalSettings();

  [fontSizeSlider, lineHeightSlider, mirrorCheckbox, flipVCheckbox, guideLineCheckbox, speedSlider].forEach((el) => {
    el.addEventListener('input', () => {
      applyLocalSettings();
      saveLocalSettings({
        fontSize: fontSizeSlider.value,
        lineHeight: lineHeightSlider.value,
        mirrored: mirrorCheckbox.checked,
        flippedV: flipVCheckbox.checked,
        guideLine: guideLineCheckbox.checked,
        speed: speedSlider.value,
      });
    });
  });

  // ---------- Show/hide panel ----------
  togglePanelBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    showPanelBtn.classList.add('visible');
  });
  showPanelBtn.addEventListener('click', () => {
    panel.classList.remove('hidden');
    showPanelBtn.classList.remove('visible');
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  fullscreenFloatBtn.addEventListener('click', toggleFullscreen);

  // ---------- WebSocket connection ----------
  let ws = null;
  let reconnectTimer = null;
  let applyingRemoteScroll = false;
  let lastSentScrollAt = 0;
  let pendingScrollRatio = null;

  function setStatus(connected) {
    statusEl.textContent = connected ? '● connected' : '● not connected';
    statusEl.classList.toggle('connected', connected);
    statusEl.classList.toggle('disconnected', !connected);
  }

  function connect(room) {
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    clearTimeout(reconnectTimer);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws?room=${encodeURIComponent(room)}`);

    ws.addEventListener('open', () => setStatus(true));
    ws.addEventListener('close', () => {
      setStatus(false);
      reconnectTimer = setTimeout(() => connect(currentRoom), 1500);
    });
    ws.addEventListener('error', () => ws.close());

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleIncoming(msg);
    });
  }

  function handleIncoming(msg) {
    if (msg.type === 'init') {
      setPrompterText(msg.text || '');
      applyScrollRatio(msg.scrollRatio || 0);
    } else if (msg.type === 'text') {
      setPrompterText(msg.content || '');
    } else if (msg.type === 'scroll') {
      applyScrollRatio(msg.ratio);
    }
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ---------- Set/send text ----------
  function setPrompterText(text) {
    prompterInner.textContent = text && text.trim().length
      ? text
      : '';
    if (!text || !text.trim().length) {
      prompterInner.innerHTML = '<p class="empty-hint">No text loaded yet. Open the panel on the left and load a text file.</p>';
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      loadedFileNameEl.textContent = `Loaded: ${file.name}`;
      setPrompterText(text);
      send({ type: 'text', content: text });
      applyScrollRatio(0);
      send({ type: 'scroll', ratio: 0 });
    };
    reader.readAsText(file, 'utf-8');
  });

  // ---------- Scroll sync ----------
  // Vertical mirroring swaps top/bottom on screen, so the sent/received ratio
  // always refers to the content (0=start, 1=end), independent of the local
  // mirror setting.
  function localRatioToContentRatio(rawRatio) {
    return flipVCheckbox.checked ? 1 - rawRatio : rawRatio;
  }

  function contentRatioToLocalRatio(contentRatio) {
    return flipVCheckbox.checked ? 1 - contentRatio : contentRatio;
  }

  function applyScrollRatio(contentRatio) {
    const maxScroll = prompter.scrollHeight - prompter.clientHeight;
    if (maxScroll <= 0) return;
    applyingRemoteScroll = true;
    prompter.scrollTop = maxScroll * contentRatioToLocalRatio(contentRatio);
    requestAnimationFrame(() => {
      applyingRemoteScroll = false;
    });
  }

  function currentScrollRatio() {
    const maxScroll = prompter.scrollHeight - prompter.clientHeight;
    if (maxScroll <= 0) return 0;
    return localRatioToContentRatio(prompter.scrollTop / maxScroll);
  }

  prompter.addEventListener('scroll', () => {
    if (applyingRemoteScroll) return;
    const ratio = currentScrollRatio();
    const now = performance.now();
    if (now - lastSentScrollAt > 80) {
      lastSentScrollAt = now;
      send({ type: 'scroll', ratio });
    } else {
      pendingScrollRatio = ratio;
      scheduleTrailingScrollSend();
    }
  });

  let trailingTimer = null;
  function scheduleTrailingScrollSend() {
    if (trailingTimer) return;
    trailingTimer = setTimeout(() => {
      trailingTimer = null;
      if (pendingScrollRatio !== null) {
        lastSentScrollAt = performance.now();
        send({ type: 'scroll', ratio: pendingScrollRatio });
        pendingScrollRatio = null;
      }
    }, 90);
  }

  topBtn.addEventListener('click', () => {
    applyScrollRatio(0);
    send({ type: 'scroll', ratio: 0 });
  });

  // ---------- Auto-Scroll ----------
  let playing = false;
  let lastFrameTime = null;
  let scrollRemainder = 0; // fractional pixels carried over between frames

  function tick(timestamp) {
    if (!playing) return;
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    const speed = Number(speedSlider.value);
    const maxScroll = prompter.scrollHeight - prompter.clientHeight;
    if (maxScroll > 0) {
      // scrollTop rounds to whole pixels, so fractions are tracked separately –
      // otherwise the prompter would stall at low speed because every
      // sub-pixel movement is immediately lost again due to rounding.
      const currentContentPx = currentScrollRatio() * maxScroll;
      const target = Math.min(maxScroll, currentContentPx + scrollRemainder + speed * dt);
      const nextContentPx = Math.floor(target);
      scrollRemainder = target - nextContentPx;
      prompter.scrollTop = maxScroll * contentRatioToLocalRatio(nextContentPx / maxScroll);
      if (nextContentPx >= maxScroll) {
        setPlaying(false);
        return;
      }
    }
    requestAnimationFrame(tick);
  }

  function setPlaying(next) {
    playing = next;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Start';
    if (playing) {
      lastFrameTime = null;
      scrollRemainder = 0;
      requestAnimationFrame(tick);
    }
  }

  playBtn.addEventListener('click', () => setPlaying(!playing));

  // ---------- Bluetooth/USB remote control (via key mapping) ----------
  // The Desview remote speaks a proprietary Bluetooth profile with the
  // Desview app and can't be read directly from the browser. If it's paired
  // instead in the device's Bluetooth settings (not in the Desview app) as a
  // keyboard, it usually sends normal key events, which can be freely
  // assigned per action here.
  const remoteActions = [
    { id: 'playPause', label: 'Play / Pause' },
    { id: 'scrollUp', label: 'Scroll up' },
    { id: 'scrollDown', label: 'Scroll down' },
    { id: 'speedUp', label: 'Faster' },
    { id: 'speedDown', label: 'Slower' },
    { id: 'top', label: 'Go to start' },
  ];

  const defaultMapping = {
    playPause: [{ type: 'key', code: 'Space' }],
    scrollUp: [{ type: 'key', code: 'ArrowUp' }],
    scrollDown: [{ type: 'key', code: 'ArrowDown' }],
    speedUp: [{ type: 'key', code: 'ArrowRight' }],
    speedDown: [{ type: 'key', code: 'ArrowLeft' }],
    top: [{ type: 'key', code: 'Home' }],
  };

  const ignoredCodes = new Set([
    'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab',
  ]);

  function cloneMapping(mapping) {
    return JSON.parse(JSON.stringify(mapping));
  }

  // older saved mappings only had a single binding per action
  // (string or single object instead of an array) – normalize to an array here
  function normalizeBindings(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [{ type: 'key', code: value }];
    if (value && typeof value === 'object') return [value];
    return [];
  }

  function loadMapping() {
    try {
      const raw = localStorage.getItem('xtele-remote-mapping');
      const merged = { ...cloneMapping(defaultMapping), ...(raw ? JSON.parse(raw) : {}) };
      Object.keys(merged).forEach((key) => {
        merged[key] = normalizeBindings(merged[key]);
      });
      return merged;
    } catch {
      return cloneMapping(defaultMapping);
    }
  }

  function saveMapping() {
    localStorage.setItem('xtele-remote-mapping', JSON.stringify(remoteMapping));
  }

  function describeBinding(binding) {
    return binding.type === 'gamepad' ? `Gamepad button ${binding.button}` : binding.code;
  }

  function bindingsEqual(a, b) {
    return a.type === b.type && a.code === b.code && a.button === b.button;
  }

  function adjustSpeed(delta) {
    const min = Number(speedSlider.min);
    const max = Number(speedSlider.max);
    speedSlider.value = String(Math.min(max, Math.max(min, Number(speedSlider.value) + delta)));
    applyLocalSettings();
    saveLocalSettings({ speed: speedSlider.value });
  }

  const remoteActionHandlers = {
    playPause: () => setPlaying(!playing),
    scrollUp: () => { prompter.scrollTop -= 40; },
    scrollDown: () => { prompter.scrollTop += 40; },
    speedUp: () => adjustSpeed(5),
    speedDown: () => adjustSpeed(-5),
    top: () => { applyScrollRatio(0); send({ type: 'scroll', ratio: 0 }); },
  };

  let remoteMapping = loadMapping();
  let listeningForAction = null;

  // finds the action whose binding list contains a matching binding
  function findActionByBinding(predicate) {
    return Object.keys(remoteMapping).find((key) => (remoteMapping[key] || []).some(predicate));
  }

  function assignToListeningAction(binding) {
    const bindings = remoteMapping[listeningForAction] || (remoteMapping[listeningForAction] = []);
    if (!bindings.some((b) => bindingsEqual(b, binding))) {
      bindings.push(binding);
    }
    saveMapping();
    listeningForAction = null;
    renderMappingList();
  }

  function renderMappingList() {
    remoteMappingList.innerHTML = '';
    remoteActions.forEach(({ id, label }) => {
      const row = document.createElement('div');
      row.className = 'mapping-row';

      const header = document.createElement('div');
      header.className = 'mapping-header';

      const nameEl = document.createElement('span');
      nameEl.className = 'mapping-name';
      nameEl.textContent = label;

      const assignBtn = document.createElement('button');
      const isListening = listeningForAction === id;
      assignBtn.textContent = isListening ? 'Press a key/button…' : '+ Assign key';
      assignBtn.classList.toggle('listening', isListening);
      assignBtn.addEventListener('click', () => {
        listeningForAction = id;
        renderMappingList();
      });

      header.append(nameEl, assignBtn);
      row.append(header);

      const chipRow = document.createElement('div');
      chipRow.className = 'mapping-chips';
      const bindings = remoteMapping[id] || [];

      if (!bindings.length) {
        const empty = document.createElement('span');
        empty.className = 'mapping-empty';
        empty.textContent = 'no key assigned';
        chipRow.appendChild(empty);
      } else {
        bindings.forEach((binding, index) => {
          const chip = document.createElement('span');
          chip.className = 'mapping-key';
          chip.textContent = describeBinding(binding);

          const removeBtn = document.createElement('button');
          removeBtn.className = 'chip-remove';
          removeBtn.textContent = '×';
          removeBtn.title = 'Remove';
          removeBtn.addEventListener('click', () => {
            bindings.splice(index, 1);
            saveMapping();
            renderMappingList();
          });

          chip.appendChild(removeBtn);
          chipRow.appendChild(chip);
        });
      }

      row.append(chipRow);
      remoteMappingList.appendChild(row);
    });
  }
  renderMappingList();

  resetMappingBtn.addEventListener('click', () => {
    remoteMapping = cloneMapping(defaultMapping);
    saveMapping();
    renderMappingList();
  });

  // ---------- Keyboard shortcuts & remote control keys ----------
  document.addEventListener('keydown', (e) => {
    const isFormField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    logDebug(`Keyboard event: code=${e.code} key=${e.key}${isFormField ? ' (form field, ignored)' : ''}`);
    if (isFormField) return;
    if (ignoredCodes.has(e.code)) return;

    if (listeningForAction) {
      assignToListeningAction({ type: 'key', code: e.code });
      e.preventDefault();
      return;
    }

    lastKeyHint.textContent = `Last detected keypress: ${e.code}`;

    const actionId = findActionByBinding((b) => b.type === 'key' && b.code === e.code);
    if (actionId) {
      e.preventDefault();
      remoteActionHandlers[actionId]();
    }
  });

  // ---------- Gamepad remote control ----------
  // Some BLE remotes don't identify as a keyboard, but as a generic HID
  // device that Chrome/Edge instead exposes via the Gamepad API (only after
  // the first button press on the device).
  window.addEventListener('gamepadconnected', (e) => {
    logDebug(`Gamepad connected: "${e.gamepad.id}"`);
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    logDebug(`Gamepad disconnected: "${e.gamepad.id}"`);
  });

  const lastGamepadButtonStates = new Map();
  function pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const prev = lastGamepadButtonStates.get(pad.index) || [];
      pad.buttons.forEach((btn, i) => {
        if (btn.pressed && !prev[i]) {
          logDebug(`Gamepad button pressed: "${pad.id}" button ${i}`);

          if (listeningForAction) {
            assignToListeningAction({ type: 'gamepad', button: i });
            return;
          }

          const actionId = findActionByBinding((b) => b.type === 'gamepad' && b.button === i);
          if (actionId) {
            remoteActionHandlers[actionId]();
          }
        }
      });
      lastGamepadButtonStates.set(pad.index, pad.buttons.map((b) => b.pressed));
    }
    requestAnimationFrame(pollGamepads);
  }
  requestAnimationFrame(pollGamepads);

  // ---------- Diagnostics: WebHID (Chrome/Edge only, requires HTTPS or localhost) ----------
  if (!('hid' in navigator)) {
    connectHidBtn.disabled = true;
    connectHidBtn.title = 'WebHID is not supported in this browser/context (Chrome/Edge over HTTPS or localhost required).';
  }
  connectHidBtn.addEventListener('click', async () => {
    if (!('hid' in navigator)) {
      logDebug('WebHID not available (browser or no secure context – https/localhost required).');
      return;
    }
    try {
      const devices = await navigator.hid.requestDevice({ filters: [] });
      if (!devices.length) {
        logDebug('No HID device selected.');
        return;
      }
      for (const device of devices) {
        await device.open();
        logDebug(`HID device connected: "${device.productName || 'unknown'}" (vendorId=0x${device.vendorId.toString(16)}, productId=0x${device.productId.toString(16)})`);
        device.addEventListener('inputreport', (event) => {
          const bytes = Array.from(new Uint8Array(event.data.buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ');
          logDebug(`HID report reportId=${event.reportId}: ${bytes}`);
        });
      }
    } catch (err) {
      logDebug(`HID error: ${err.message}`);
    }
  });

  // ---------- Switch room ----------
  applyRoomBtn.addEventListener('click', () => {
    const room = roomInput.value.trim() || 'default';
    currentRoom = room;
    setRoomInUrl(room);
    connect(room);
  });

  connect(currentRoom);
})();
