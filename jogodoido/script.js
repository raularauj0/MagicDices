/* ================================================================
   ECOS DOS DADOS — v0.5
   Classes & Habilidades de Formação · Bosses & Debuffs · Coringas &
   Reações Elementais · Balanço (regen/resistência) · Tutorial & UX
   ================================================================ */

// ---------------------------------------------------------------
// CONSTANTES DE JOGO
// ---------------------------------------------------------------
const ELEMENTS = ['fire', 'ice', 'lightning', 'shadow', 'holy'];
const ELEMENT_LABEL = { fire: 'Fogo', ice: 'Gelo', lightning: 'Raio', shadow: 'Sombra', holy: 'Luz' };
const ELEMENT_COLOR = { fire: 'var(--fire)', ice: 'var(--ice)', lightning: 'var(--lightning)', shadow: 'var(--shadow)', holy: 'var(--holy)' };
const ELEMENT_SUM = { fire: 15, ice: 16, lightning: 17, shadow: 18, holy: 19 };
const SUM_ELEMENT = { 15: 'fire', 16: 'ice', 17: 'lightning', 18: 'shadow', 19: 'holy' };
const DIE_ICONS = { 10: '⭐', 15: '🔥', 16: '❄️', 17: '⚡', 18: '🌑', 19: '✨', 20: '🃏' };

const MONSTERS = [
  { name: 'Javali Sombrio', emoji: '🐗', hp: 120 },
  { name: 'Lobo Espectral', emoji: '🐺', hp: 170 },
  { name: 'Troll do Pântano', emoji: '👹', hp: 220 },
];

// NOVO (#2): Bosses — cada um carrega UM elemento, que define seu debuff de arena.
// A cada 4º desafio (índices 3, 7, 11...) o jogo entra em fase de Boss.
const BOSSES = [
  { name: 'Fogoraz, o Incendiário', emoji: '🐉', hp: 420, element: 'fire' },
  { name: 'Glacius, Senhor do Gelo', emoji: '🧊', hp: 440, element: 'ice' },
  { name: 'Voltrax, Fúria Elétrica', emoji: '🐲', hp: 460, element: 'lightning' },
  { name: 'Lumina, a Cegante', emoji: '👁️', hp: 480, element: 'holy' },
  { name: 'Umbra, Devoradora de Sombras', emoji: '👻', hp: 500, element: 'shadow' },
];

// NOVO (#1): as 4 classes jogáveis, com seus efeitos de Par/Trinca/Quadra.
const CLASSES = {
  warrior: {
    name: 'Guerreiro', icon: '⚔️',
    par: 'Escudo que absorve o próximo ataque do inimigo.',
    trinca: 'Atordoa o inimigo por 3s.',
    quadra: 'Golpe Devastador — dano massivo ignorando resistência.'
  },
  mage: {
    name: 'Mago', icon: '🧙‍♂️',
    par: '+1.5s no tempo do turno do inimigo.',
    trinca: 'Congela o tempo e dobra o dano de magias elementais.',
    quadra: 'Tempestade Arcana — dispara todos os elementos de uma vez.'
  },
  archer: {
    name: 'Arqueiro', icon: '🏹',
    par: 'Aumenta o crítico do próximo ataque.',
    trinca: 'Mira Certeira — escolha um dado do tabuleiro para recriar.',
    quadra: 'Chuva de Flechas — dano contínuo enquanto o Boss estiver atordoado.'
  },
  alchemist: {
    name: 'Alquimista', icon: '🧪',
    par: 'Cura HP a cada fusão de dados realizada.',
    trinca: 'Transmuta dados 1 e 2 do tabuleiro em dados Raros (10).',
    quadra: 'Elixir Supremo — cura total + bônus de dano permanente.'
  }
};

const POWER_CARDS = [
  { id: 'fireMastery', icon: '🔥', name: 'Domínio de Fogo', desc: '+25% de dano em ataques do elemento Fogo' },
  { id: 'extraTime', icon: '⏳', name: 'Tempo Extra', desc: 'Aumenta o tempo do turno do monstro em +2.0s' },
  { id: 'steelSkin', icon: '🛡️', name: 'Pele de Aço', desc: 'Reduz o dano sofrido por ataques em 15%' },
  { id: 'alchemist', icon: '🧪', name: 'Alquimista', desc: 'Ganha +10 HP sempre que realizar uma Fusão' },
  { id: 'luckyStrike', icon: '🍀', name: 'Mestre da Sorte', desc: '+30% de cura extra ao usar o Número da Sorte' },
  { id: 'vampirism', icon: '🦇', name: 'Vampirismo', desc: 'Recupera 10% do dano causado como Vida' }
];

// ---------------------------------------------------------------
// ESTADO DO JOGO
// ---------------------------------------------------------------
let COLS = 4, ROWS = 4, SIZE = 16;          // NOVO: tabuleiro agora é dinâmico (4x4 normal / 5x6 em Boss)
let board = [], selectedIndices = [], level = 0;
let monsterHP = 0, monsterMaxHP = 0, heroHP = 100, heroMaxHP = 100;
let weaknessElement = null, luckyNumber = 7;
let busy = false, audioCtx = null;
let freezeTimer = 0;                          // usado como "atordoamento" genérico do Boss
let runBonuses = { fireMastery: 0, extraTime: 0, steelSkin: 0, alchemist: 0 };
let timerDuration = 7, timerElapsed = 0, timerInterval = null;
let mergedTargetIndex = null;
let heroLevel = 1, heroXP = 0, heroMaxXP = 100;
let streakCount = 0, lastAttackTime = 0;
const STREAK_WINDOW = 4.5;

// NOVO (#1) — classe escolhida e seus buffs/flags de habilidade
let playerClass = null;
let shieldActive = false;          // Guerreiro (Par)
let critNextAttack = false;        // Arqueiro (Par)
let sniperMode = false;            // Arqueiro (Trinca) — próximo clique recria um dado
let arrowRainInterval = null;      // Arqueiro (Quadra)
let mageDoubleElemental = false;   // Mago (Trinca)
let permanentDmgBonus = 0;         // Alquimista (Quadra) — bônus permanente na run

// NOVO (#3) — fusão de coringas
let invulnerableTimer = 0;         // 2 coringas: herói invulnerável por um tempo
let nextAttackMultiplier = 1;      // 2 coringas: 5x no próximo ataque

// NOVO (#2) — bosses e seus debuffs de arena
let isBoss = false, bossElement = null;
let bossDebuffInterval = null;
let iceBlockTimer = 0;             // Gelo: bloqueia o botão Atacar
let shadowShrinkTimer = 0;         // Sombra: reduz área jogável a 3x3

// NOVO (#4) — punição por inatividade
let lastActionTime = Date.now();

// ---------------------------------------------------------------
// ÁUDIO (Web Audio API — sem arquivos externos)
// ---------------------------------------------------------------
function beep(freq = 440, dur = 0.09, type = 'sine', vol = 0.05) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch (e) { }
}
function playSelectSound() { beep(320, 0.05, 'triangle', 0.03); }
function playMergeSound() { beep(560, 0.12, 'sine', 0.05); }
function playElementSound(el) {
  const tones = { fire: 700, ice: 760, lightning: 820, shadow: 680, holy: 900 };
  beep(tones[el] || 700, 0.22, 'square', 0.06);
}
function playJokerSound() { beep(1200, 0.32, 'sawtooth', 0.07); }
function playUltimateSound() {
  [400, 700, 1000, 1400, 1800].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'sawtooth', 0.08), i * 90));
}
function playMonsterHitSound() { beep(180, 0.18, 'sawtooth', 0.06); }
function playVictorySound() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.06), i * 110));
}
function playDefeatSound() {
  [400, 320, 240, 160].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.06), i * 140));
}
function playStreakSound(streak) {
  const cappedStreak = Math.min(streak, 12); // evita som absurdamente agudo em streaks muito altos
  const base = 480 + cappedStreak * 60;
  beep(base, 0.1, 'square', 0.06);
  if (streak >= 3) setTimeout(() => beep(base + 140, 0.12, 'square', 0.07), 90);
  if (streak >= 5) setTimeout(() => beep(base + 280, 0.15, 'square', 0.08), 180);
  if (streak >= 10) setTimeout(() => beep(base + 420, 0.16, 'square', 0.08), 260);
}
function playDebuffSound() { beep(220, 0.3, 'sawtooth', 0.05); }
function playShieldSound() { beep(500, 0.15, 'sine', 0.05); }

// ---------------------------------------------------------------
// COMBO EM SEQUÊNCIA (streak)
// REGRA 6: o contador em si (streakCount) NÃO tem teto — sobe livremente até 99+.
// O multiplicador de DANO continua escalando, mas com teto de balanceamento em 3.0x
// (senão um streak de 40+ zeraria qualquer boss em um golpe só).
// ---------------------------------------------------------------
function streakMultiplier(streak) {
  if (streak <= 1) return 1.0;
  if (streak === 2) return 1.25;
  if (streak === 3) return 1.5;
  if (streak === 4) return 1.75;
  if (streak < 10) return 2.0;
  if (streak < 20) return 2.25;
  if (streak < 40) return 2.5;
  return 3.0; // teto de balanceamento do dano — o contador continua subindo normalmente
}
function resetStreak() {
  streakCount = 0;
  const layer = document.getElementById('comboStreakLayer');
  if (layer) layer.classList.remove('active', 'max', 'mega');
}
function streakDisplayText(streak) {
  if (streak > 99) return '🔥 99+ STREAK!';
  if (streak >= 10) return '🔥 ' + streak + 'x STREAK!';
  if (streak >= 5) return 'COMBO MAX!';
  return streak + 'x!';
}
function showStreakBadge(streak) {
  const layer = document.getElementById('comboStreakLayer');
  if (!layer) return;
  if (streak < 2) { layer.classList.remove('active', 'max', 'mega'); return; }
  layer.textContent = streakDisplayText(streak);
  layer.classList.toggle('max', streak >= 5 && streak < 10);
  layer.classList.toggle('mega', streak >= 10);
  layer.classList.remove('active'); void layer.offsetWidth; layer.classList.add('active');
  if (streak >= 3) {
    const arena = document.getElementById('arena');
    arena.classList.remove('shake-hard'); void arena.offsetWidth; arena.classList.add('shake-hard');
  }
}

// ---------------------------------------------------------------
// HELPERS DE TABULEIRO (usados por magias, fusões e reações híbridas)
// ---------------------------------------------------------------
function rowIndices(row, exclude) {
  const out = []; for (let c = 0; c < COLS; c++) { const i = row * COLS + c; if (!exclude.has(i)) out.push(i); } return out;
}
function colIndices(col, exclude) {
  const out = []; for (let r = 0; r < ROWS; r++) { const i = r * COLS + col; if (!exclude.has(i)) out.push(i); } return out;
}
function allWhere(pred, exclude) {
  const out = []; for (let i = 0; i < SIZE; i++) if (!exclude.has(i) && pred(board[i])) out.push(i); return out;
}
function randomOtherIndices(n, exclude) {
  const pool = []; for (let i = 0; i < SIZE; i++) if (!exclude.has(i)) pool.push(i);
  const picked = [];
  while (picked.length < Math.min(n, pool.length)) {
    const r = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    picked.push(r);
  }
  return picked;
}
// Efeito de tabuleiro de cada elemento (usado pela Tempestade Arcana do Mago
// e pelas reações híbridas — os ataques elementais "solo" continuam simples).
function elementBoardEffect(el, exclude) {
  switch (el) {
    case 'fire': return allWhere(v => v <= 5, exclude);
    case 'ice': return randomOtherIndices(4, exclude);
    case 'lightning': return rowIndices(Math.floor(Math.random() * ROWS), exclude);
    case 'shadow': return colIndices(Math.floor(Math.random() * COLS), exclude);
    case 'holy': heroHP = Math.min(heroMaxHP, heroHP + 15); updateHeroHP(); return [];
    default: return [];
  }
}

function rollLuckyNumber() {
  luckyNumber = 1 + Math.floor(Math.random() * 12);
  document.getElementById('luckyBadge').textContent = '🍀 Sorte: ' + luckyNumber;
}
function randDie() {
  const r = Math.random();
  if (r < 0.08) return 10;
  if (r < 0.14) return 15 + Math.floor(Math.random() * 5);
  let v;
  do { v = 1 + Math.floor(Math.random() * 14); } while (v === 10);
  return v;
}
function rareClass(v) {
  if (v === 20) return 'rare-joker';
  if (v >= 15) return 'rare-high';
  if (v === 10) return 'rare-ten';
  return 'normal';
}

// ---------------------------------------------------------------
// GRAVIDADE / QUEDA DOS DADOS
// ---------------------------------------------------------------
function resolveGravity(breakSet, targetIdx) {
  const freshSet = new Set();
  let newMergedIdx = null;

  for (let col = 0; col < COLS; col++) {
    const survivors = [];
    let mergedRowInCol = -1;

    for (let row = 0; row < ROWS; row++) {
      const idx = row * COLS + col;
      if (!breakSet.has(idx)) {
        survivors.push(board[idx]);
        if (idx === targetIdx) mergedRowInCol = survivors.length - 1;
      }
    }
    const numNew = ROWS - survivors.length;
    const newDice = Array.from({ length: numNew }, () => randDie());
    const newCol = newDice.concat(survivors);

    for (let row = 0; row < ROWS; row++) {
      const finalIdx = row * COLS + col;
      board[finalIdx] = newCol[row];
      if (row < numNew) freshSet.add(finalIdx);
      if (mergedRowInCol !== -1 && row === numNew + mergedRowInCol) newMergedIdx = finalIdx;
    }
  }
  return { freshSet, newMergedIdx };
}

// NOVO (#2): tiles fora do quadrado central 3x3 durante o debuff Sombra (Claustrofobia)
function isTileRestricted(i) {
  if (shadowShrinkTimer <= 0) return false;
  const row = Math.floor(i / COLS), col = i % COLS;
  const rowStart = Math.floor((ROWS - 3) / 2), colStart = Math.floor((COLS - 3) / 2);
  return !(row >= rowStart && row < rowStart + 3 && col >= colStart && col < colStart + 3);
}

function renderBoard(dropAnim, freshSet) {
  freshSet = freshSet || new Set();
  const el = document.getElementById('board');
  el.innerHTML = '';

  board.forEach((v, i) => {
    const d = document.createElement('div');
    const isSel = selectedIndices.includes(i);
    const isLucky = (v === luckyNumber);
    const isMerged = (i === mergedTargetIndex);
    const isFresh = freshSet.has(i);
    const restricted = isTileRestricted(i);
    const icon = DIE_ICONS[v] || '';

    d.className = 'die ' + rareClass(v) +
      (isSel ? ' selected' : '') +
      (isLucky ? ' is-lucky' : '') +
      (isMerged ? ' just-merged' : '') +
      (sniperMode ? ' sniper-target' : '') +
      (restricted ? ' disabled-area' : '') +
      (dropAnim && isFresh ? ' dropping' : '');

    d.dataset.idx = i;
    d.innerHTML = `${icon ? `<span class="icon">${icon}</span>` : ''}<span class="num">${v}</span>`;
    d.onclick = () => onDieClick(i);
    el.appendChild(d);
  });

  el.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  updateSelectionBar();
}

function updateSelectionBar() {
  const sum = selectedIndices.reduce((s, i) => s + (board[i] || 0), 0);
  document.getElementById('selSum').textContent = sum;

  const counts = {};
  selectedIndices.forEach(i => { counts[board[i]] = (counts[board[i]] || 0) + 1; });
  const occurrences = Object.values(counts);
  const maxSame = Math.max(0, ...occurrences);
  const hasLucky = selectedIndices.some(i => board[i] === luckyNumber);
  const jokerCount = selectedIndices.filter(i => board[i] === 20).length;

  let comboText = '';
  if (jokerCount === 2) comboText = '🃏🃏 Fusão de Coringas (Invulnerabilidade + 5x!)';
  else if (jokerCount === 4) comboText = '🃏🃏🃏🃏 ULTIMATE — 50% da vida do Boss!';
  else if (maxSame === 2) comboText = classComboPreview(2);
  else if (maxSame === 3) comboText = classComboPreview(3);
  else if (maxSame === 4) comboText = classComboPreview(4);
  if (hasLucky) comboText += (comboText ? ' + ' : '') + '🍀 Sorte (+25% Dano/Cura)';

  document.getElementById('comboBadge').textContent = comboText;

  const iceBlocked = iceBlockTimer > 0;
  document.getElementById('launchBtn').disabled = (selectedIndices.length === 0) || busy || iceBlocked;
  document.getElementById('launchBtn').classList.toggle('ice-blocked', iceBlocked);

  let canMerge = false;
  if (!busy && selectedIndices.length >= 2) {
    if (sum === 20) canMerge = (selectedIndices.length === 2 && selectedIndices.every(i => board[i] === 10));
    else if (sum < 20) canMerge = true;
  }
  document.getElementById('mergeBtn').disabled = !canMerge;
}

// Texto de prévia do combo de acordo com a classe escolhida
function classComboPreview(n) {
  const cls = CLASSES[playerClass];
  if (!cls) return n === 2 ? '👥 Par' : n === 3 ? '🔺 Trinca' : '👑 Quadra';
  if (n === 2) return `👥 Par — ${cls.par}`;
  if (n === 3) return `🔺 Trinca — ${cls.trinca}`;
  return `👑 Quadra — ${cls.quadra}`;
}

// ---------------------------------------------------------------
// SELEÇÃO / INTERAÇÃO COM O TABULEIRO
// ---------------------------------------------------------------
function onDieClick(i) {
  if (busy) return;
  if (isTileRestricted(i)) return;

  // NOVO (#1 Arqueiro — Trinca): "Mira Certeira" — o próximo clique recria o dado escolhido
  if (sniperMode) {
    sniperMode = false;
    board[i] = randDie();
    const elx = document.querySelector(`.die[data-idx="${i}"]`);
    if (elx) { elx.classList.add('breaking'); }
    floatText('🏹 Mira Certeira!', '#ffd23f');
    beep(900, 0.15, 'triangle', 0.05);
    setTimeout(() => renderBoard(true, new Set([i])), 200);
    return;
  }

  const pos = selectedIndices.indexOf(i);
  if (pos >= 0) {
    selectedIndices.splice(pos, 1);
  } else {
    if (selectedIndices.length >= 4) return;
    selectedIndices.push(i);
    playSelectSound();
  }
  renderBoard(false);
}

function floatText(text, color, big) {
  const layer = document.getElementById('floatLayer');
  const t = document.createElement('div');
  t.className = 'float-text' + (big ? ' hybrid' : '');
  t.style.color = color || '#fff';
  t.textContent = text;
  t.style.left = '50%';
  layer.appendChild(t);
  setTimeout(() => t.remove(), 1100);
}

// ---------------------------------------------------------------
// FUSÃO (Somar) — combina 2+ dados em 1 só, valor = soma
// ---------------------------------------------------------------
function resolveMerge() {
  if (busy || selectedIndices.length < 2) return;
  const idxs = [...selectedIndices];
  const sum = idxs.reduce((s, i) => s + board[i], 0);

  if (sum > 20) return;
  if (sum === 20 && !(idxs.length === 2 && idxs.every(i => board[i] === 10))) return;

  busy = true;
  lastActionTime = Date.now(); // NOVO (#4): reseta o relógio de inatividade
  const targetIdx = idxs[0];
  const breakSet = new Set(idxs.slice(1));
  board[targetIdx] = sum;

  idxs.slice(1).forEach(idx => {
    const elx = document.querySelector(`.die[data-idx="${idx}"]`);
    if (elx) elx.classList.add('breaking');
  });

  floatText(`Fusão: Dado ${sum}!`, '#5ecbff');
  playMergeSound();

  // Alquimista (Par): cura a cada fusão
  if (playerClass === 'alchemist') {
    heroHP = Math.min(heroMaxHP, heroHP + 8);
    updateHeroHP();
  }
  if (runBonuses.alchemist > 0) {
    heroHP = Math.min(heroMaxHP, heroHP + 10 * runBonuses.alchemist);
    updateHeroHP();
  }

  setTimeout(() => {
    selectedIndices = [];
    const { freshSet, newMergedIdx } = resolveGravity(breakSet, targetIdx);
    mergedTargetIndex = newMergedIdx;
    renderBoard(true, freshSet);
    busy = false;
    setTimeout(() => { mergedTargetIndex = null; }, 800);
  }, 350);
}

// ---------------------------------------------------------------
// EFEITOS DE CLASSE POR COMBO (Par / Trinca / Quadra)
// Retorna { mult, label, ignoreResist, extraBreak }
// ---------------------------------------------------------------
function applyClassCombo(maxSame, breakSet) {
  if (maxSame < 2 || !playerClass) return { mult: 1, label: '' };
  const cls = playerClass;

  if (maxSame === 2) {
    if (cls === 'warrior') {
      shieldActive = true;
      const badge = document.getElementById('shieldBadge');
      badge.classList.add('active');
      playShieldSound();
      return { mult: 1.3, label: ' (Escudo Ativado!)' };
    }
    if (cls === 'mage') {
      timerElapsed = Math.max(0, timerElapsed - 1.5); // efetivamente dá +1.5s de fôlego
      return { mult: 1.3, label: ' (+1.5s de Tempo!)' };
    }
    if (cls === 'archer') {
      critNextAttack = true;
      return { mult: 1.3, label: ' (Crítico Preparado!)' };
    }
    if (cls === 'alchemist') {
      return { mult: 1.3, label: ' (Par!)' };
    }
  }

  if (maxSame === 3) {
    if (cls === 'warrior') {
      freezeTimer = 3.0;
      return { mult: 1.8, label: ' (Inimigo Atordoado!)' };
    }
    if (cls === 'mage') {
      freezeTimer = 3.0;
      mageDoubleElemental = true;
      return { mult: 1.8, label: ' (Tempo Congelado — Magias em Dobro!)' };
    }
    if (cls === 'archer') {
      sniperMode = true;
      return { mult: 1.8, label: ' (Mira Certeira Pronta — escolha um dado!)' };
    }
    if (cls === 'alchemist') {
      const transmuted = allWhere(v => v === 1 || v === 2, breakSet);
      transmuted.forEach(idx => { board[idx] = 10; });
      return { mult: 1.8, label: ' (Transmutação!)' };
    }
  }

  if (maxSame === 4) {
    if (cls === 'warrior') {
      return { mult: 3.5, label: ' (Golpe Devastador!)', ignoreResist: true };
    }
    if (cls === 'mage') {
      return { mult: 2.5, label: ' (Tempestade Arcana!)', arcaneStorm: true };
    }
    if (cls === 'archer') {
      freezeTimer = Math.max(freezeTimer, 3.0);
      startArrowRain();
      return { mult: 2.2, label: ' (Chuva de Flechas!)' };
    }
    if (cls === 'alchemist') {
      heroHP = heroMaxHP; updateHeroHP();
      permanentDmgBonus += 0.1;
      return { mult: 2.5, label: ' (Elixir Supremo!)' };
    }
  }
  return { mult: 1, label: '' };
}

// Arqueiro (Quadra): dano contínuo enquanto o Boss estiver atordoado
function startArrowRain() {
  clearInterval(arrowRainInterval);
  arrowRainInterval = setInterval(() => {
    if (freezeTimer <= 0 || monsterHP <= 0) { clearInterval(arrowRainInterval); return; }
    monsterHP -= 6;
    updateHP();
    floatText('🏹 -6', '#ffd23f');
    beep(950, 0.06, 'triangle', 0.04);
    checkEndState();
  }, 500);
}

// ---------------------------------------------------------------
// REAÇÕES ELEMENTAIS HÍBRIDAS (#3)
// Detecta pares de dados elementais DIFERENTES dentro da seleção.
// ---------------------------------------------------------------
function applyHybridReactions(idxs, breakSet) {
  const vals = new Set(idxs.map(i => board[i]));
  let bonusDmg = 0, label = '';

  if (vals.has(15) && vals.has(16)) { // Fogo + Gelo = Choque Térmico
    bonusDmg += 70;
    label = '💥 Choque Térmico!';
    randomOtherIndices(3, breakSet).forEach(x => breakSet.add(x));
    playElementSound('lightning');
  }
  if (vals.has(19) && vals.has(17)) { // Luz + Raio = Supercondutor
    bonusDmg += 55;
    label = (label ? label + ' + ' : '') + '⚡✨ Supercondutor!';
    timerElapsed = 0; // reseta o ataque do Boss
    randomOtherIndices(4, breakSet).forEach(x => breakSet.add(x));
  }
  if (vals.has(15) && vals.has(18)) { // Fogo + Sombra = Chama Negra (dano ao longo do tempo)
    bonusDmg += 40;
    label = (label ? label + ' + ' : '') + '🖤 Chama Negra!';
    setTimeout(() => { if (monsterHP > 0) { monsterHP -= 25; updateHP(); floatText('🖤 -25', '#a06bff'); checkEndState(); } }, 700);
    setTimeout(() => { if (monsterHP > 0) { monsterHP -= 25; updateHP(); floatText('🖤 -25', '#a06bff'); checkEndState(); } }, 1400);
  }
  return { bonusDmg, label };
}

// ---------------------------------------------------------------
// ATAQUE PRINCIPAL
// ---------------------------------------------------------------
function resolvePlay() {
  if (busy || selectedIndices.length === 0) return;
  if (iceBlockTimer > 0) return; // debuff de Gelo do Boss bloqueia o ataque

  const idxs = [...selectedIndices];
  const sum = idxs.reduce((s, i) => s + board[i], 0);
  const count = idxs.length;
  const jokerCount = idxs.filter(i => board[i] === 20).length;

  // NOVA REGRA 2: poderes elementais só existem se houver um dado JÁ especial
  // (valor 15-19) selecionado — nunca apenas pela soma de dados comuns.
  const elementalOnly = idxs.filter(i => board[i] >= 15 && board[i] <= 19);
  // Se houver mais de um dado elemental na seleção, o mais forte (maior valor) domina.
  const bestElemental = elementalOnly.length
    ? elementalOnly.reduce((best, i) => (board[i] > board[best] ? i : best), elementalOnly[0])
    : null;

  const counts = {};
  idxs.forEach(i => { counts[board[i]] = (counts[board[i]] || 0) + 1; });
  const maxSame = Math.max(...Object.values(counts));
  const hasLucky = idxs.some(i => board[i] === luckyNumber);

  let dmg = 0, color = '#fff', label = '';
  let breakSet = new Set(idxs);
  let isUltimate = false;
  let usedMagic = false; // REGRA 6: só conta pro streak se este ataque foi mágico/especial

  // ---- FASE 1: consumir buffs pendentes de "próximo ataque" ----
  let pendingCrit = critNextAttack ? 1.6 : 1;
  if (critNextAttack) { critNextAttack = false; label += ' (Crítico!)'; }
  let pendingJokerBuff = nextAttackMultiplier;
  if (nextAttackMultiplier > 1) nextAttackMultiplier = 1;

  // ---- FASE 2: CORINGAS E MAGIAS (regras 2 e 3) ----
  if (count === 4 && jokerCount === 4) {
    // Quadra de Coringas: ULTIMATE
    isUltimate = true; usedMagic = true;
    dmg = Math.round(monsterMaxHP * 0.5);
    color = '#ffd23f'; label = '👑 ULTIMATE: Fúria dos Coringas!';
    breakSet = new Set(allWhere(() => true, new Set())); // limpa o tabuleiro inteiro
    playUltimateSound();
  } else if (count === 2 && jokerCount === 2) {
    // Dois Coringas: invulnerabilidade + 5x no PRÓXIMO ataque
    usedMagic = true;
    dmg = 40; color = '#ffd23f'; label = '🃏🃏 Fusão de Coringas!';
    invulnerableTimer = 5;
    nextAttackMultiplier = 5;
    playJokerSound();
  } else if (jokerCount === 1 && bestElemental !== null) {
    // NOVO (REGRA 3): Coringa + Elemental = Ataque Elemental Amplificado
    usedMagic = true;
    const el = SUM_ELEMENT[board[bestElemental]];
    const soloDmg = board[bestElemental] * 4 + 30;
    dmg = Math.round(soloDmg * 2.5); // dano multiplicado, não apenas somado
    color = ELEMENT_COLOR[el];
    label = '🃏+' + ELEMENT_LABEL[el] + ' Amplificado!';
    if (weaknessElement === el) dmg *= 1.5;
    if (el === 'fire' && runBonuses.fireMastery > 0) dmg *= (1 + 0.25 * runBonuses.fireMastery);
    if (mageDoubleElemental) { dmg *= 2; label += ' (Dobrado!)'; mageDoubleElemental = false; }
    elementBoardEffect(el, breakSet).forEach(x => breakSet.add(x)); // efeito em força total
    playElementSound(el); playJokerSound();
  } else if (jokerCount === 1 && bestElemental === null) {
    // Coringa sozinho (sem elemento junto): Coringa Supremo clássico
    usedMagic = true;
    dmg = 220; color = '#ffd23f'; label = 'Coringa Supremo ★';
    playJokerSound();
  } else if (bestElemental !== null) {
    // NOVO (REGRA 2): magia elemental exige o dado especial em si — nunca a soma pura
    usedMagic = true;
    const el = SUM_ELEMENT[board[bestElemental]];
    dmg = board[bestElemental] * 4 + 30;
    color = ELEMENT_COLOR[el];
    label = ELEMENT_LABEL[el];
    if (weaknessElement === el) dmg *= 1.5;
    if (el === 'fire' && runBonuses.fireMastery > 0) dmg *= (1 + 0.25 * runBonuses.fireMastery);
    if (mageDoubleElemental) { dmg *= 2; label += ' (Dobrado!)'; mageDoubleElemental = false; }
    playElementSound(el);
  } else {
    // NOVO (REGRA 2): nenhum dado especial selecionado = dano físico básico puro (soma)
    dmg = sum;
    const willIgnoreResist = (playerClass === 'warrior' && maxSame === 4);
    if (isBoss && sum < 14 && !willIgnoreResist) {
      dmg *= 0.35;
      label = '(Resistente!)';
    }
  }

  if (!isUltimate) {
    // ---- Reações elementais híbridas (camada extra — exige dados especiais também) ----
    const hybrid = applyHybridReactions(idxs, breakSet);
    if (hybrid.bonusDmg > 0) {
      dmg += hybrid.bonusDmg;
      label = (label ? label + ' + ' : '') + hybrid.label;
      floatText(hybrid.label, '#ff5e9e', true);
      usedMagic = true;
    }

    // ---- Efeito de combo por Classe (Par/Trinca/Quadra) ----
    const combo = applyClassCombo(maxSame, breakSet);
    dmg *= combo.mult;
    label += combo.label;
    if (combo.arcaneStorm) {
      ELEMENTS.forEach(el => { elementBoardEffect(el, breakSet).forEach(x => breakSet.add(x)); });
      dmg += 60;
    }

    // ---- Número da Sorte (REGRA 1: cura reduzida para +2/+3 HP, não mais +5) ----
    if (hasLucky) {
      const luckyBonus = 0.25 + (runBonuses.luckyStrike > 0 ? 0.3 * runBonuses.luckyStrike : 0);
      dmg *= (1 + luckyBonus);
      let luckyHeal = 2 + Math.floor(Math.random() * 2); // +2 ou +3 HP (antes era +5)
      if (runBonuses.luckyStrike > 0) luckyHeal = Math.round(luckyHeal * (1 + 0.3 * runBonuses.luckyStrike));
      heroHP = Math.min(heroMaxHP, heroHP + luckyHeal);
      floatText('🍀 +' + luckyHeal + ' HP', 'var(--lucky)');
    }

    // ---- Combo em sequência (REGRAS 4 e 6) ----
    // Só acumula se o ataque usou dado especial/mágico OU formou Par/Trinca/Quadra.
    // Ataques físicos comuns sem formação nenhuma NÃO sobem o streak — e o quebram.
    const qualifiesForStreak = usedMagic || maxSame >= 2;
    if (qualifiesForStreak) {
      const now = Date.now();
      if (streakCount > 0 && (now - lastAttackTime) <= STREAK_WINDOW * 1000) streakCount += 1;
      else streakCount = 1;
      lastAttackTime = now;
      dmg *= streakMultiplier(streakCount);
      label += ` (${streakCount > 99 ? '99+' : streakCount}x Combo!)`;
      showStreakBadge(streakCount);
      playStreakSound(streakCount);
    } else {
      resetStreak();
    }

    // ---- Buffs consumidos na Fase 1 ----
    dmg *= pendingCrit;
    dmg *= pendingJokerBuff;

    // ---- Vampirismo / bônus permanente do Alquimista ----
    if (permanentDmgBonus > 0) dmg *= (1 + permanentDmgBonus);
    if (runBonuses.vampirism > 0) heroHP = Math.min(heroMaxHP, heroHP + Math.round(dmg * 0.1 * runBonuses.vampirism));
  }

  dmg = Math.round(dmg);
  busy = true;
  lastActionTime = Date.now(); // reseta o relógio de inatividade do Boss

  monsterHP -= dmg;
  const me = document.getElementById('monsterEmoji');
  me.classList.remove('hit'); void me.offsetWidth; me.classList.add('hit');
  playMonsterHitSound();

  floatText((label ? label + ' ' : '') + '-' + dmg, streakCount >= 10 ? '#ff5e9e' : (streakCount >= 3 ? '#ffd23f' : color), isUltimate);
  updateHP();
  updateHeroHP();

  idxs.forEach(idx => {
    const elx = document.querySelector(`.die[data-idx="${idx}"]`);
    if (elx) elx.classList.add('breaking');
  });
  breakSet.forEach(idx => {
    const elx = document.querySelector(`.die[data-idx="${idx}"]`);
    if (elx) elx.classList.add('breaking');
  });

  setTimeout(() => {
    selectedIndices = [];
    rollLuckyNumber();
    const { freshSet } = resolveGravity(breakSet);
    renderBoard(true, freshSet);
    busy = false;
    checkEndState();
  }, 380);
}

// ---------------------------------------------------------------
// HP / XP / BÔNUS — atualização de interface
// ---------------------------------------------------------------
function updateHP() {
  const pct = Math.max(0, monsterHP / monsterMaxHP * 100);
  document.getElementById('hpFill').style.width = pct + '%';
  document.getElementById('hpLabel').textContent = Math.max(0, Math.round(monsterHP)) + '/' + monsterMaxHP;
}
function updateHeroHP() {
  const pct = Math.max(0, heroHP / heroMaxHP * 100);
  document.getElementById('heroHpFill').style.width = pct + '%';
  document.getElementById('heroHpLabel').textContent = Math.max(0, Math.round(heroHP)) + '/' + heroMaxHP;
}
function updateXPBar() {
  const pct = Math.min(100, Math.max(0, (heroXP / heroMaxXP) * 100));
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpLabel').textContent = `Nível ${heroLevel} (${heroXP}/${heroMaxXP} XP)`;
}
function renderBonusChips() {
  const bar = document.getElementById('bonusBar');
  bar.innerHTML = '';
  Object.keys(runBonuses).forEach(key => {
    if (runBonuses[key] > 0) {
      const card = POWER_CARDS.find(c => c.id === key);
      if (card) {
        const chip = document.createElement('div');
        chip.className = 'bonus-chip';
        chip.textContent = `${card.icon} ${card.name} x${runBonuses[key]}`;
        bar.appendChild(chip);
      }
    }
  });
}
function addXP(amount) {
  heroXP += amount;
  if (heroXP >= heroMaxXP) {
    heroXP -= heroMaxXP;
    heroLevel++;
    heroMaxXP = Math.round(heroMaxXP * 1.3);
    updateXPBar();
    return true;
  }
  updateXPBar();
  return false;
}

// ---------------------------------------------------------------
// DEBUFFS DE BOSS (#2) — cada Boss carrega UM elemento/debuff próprio
// ---------------------------------------------------------------
function shuffleBoardPositions() {
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  selectedIndices = [];
  floatText('⚡ Paralisia — dados embaralhados!', 'var(--lightning)');
  renderBoard(false);
}
function resetPowerDiceToCommon() {
  let changed = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] >= 15) { board[i] = 1 + Math.floor(Math.random() * 6); changed = true; }
  }
  if (changed) {
    floatText('✨ Ofuscamento — dados de poder resetados!', 'var(--holy)');
    renderBoard(false);
  }
}
function updateDebuffLabel(text, cls) {
  const el = document.getElementById('debuffLabel');
  el.textContent = text || '';
  el.className = 'debuff-label' + (cls ? ' ' + cls : '');
}
function startBossDebuffs() {
  clearInterval(bossDebuffInterval);
  if (!isBoss) { updateDebuffLabel(''); return; }

  if (bossElement === 'ice') {
    updateDebuffLabel('❄️ ' + BOSSES.find(b => b.element === 'ice').name + ' pode congelar seu ataque!', 'ice');
    bossDebuffInterval = setInterval(() => {
      if (monsterHP <= 0 || heroHP <= 0) return;
      iceBlockTimer = 3;
      playDebuffSound();
      floatText('❄️ Congelamento!', 'var(--ice)');
      updateSelectionBar();
    }, 7000);
  } else if (bossElement === 'lightning') {
    updateDebuffLabel('⚡ ' + BOSSES.find(b => b.element === 'lightning').name + ' pode embaralhar o tabuleiro!', 'lightning');
    bossDebuffInterval = setInterval(() => {
      if (monsterHP <= 0 || heroHP <= 0 || busy) return;
      playDebuffSound();
      shuffleBoardPositions();
    }, 6500);
  } else if (bossElement === 'holy') {
    updateDebuffLabel('✨ ' + BOSSES.find(b => b.element === 'holy').name + ' pode ofuscar seus dados de poder!', 'holy');
    bossDebuffInterval = setInterval(() => {
      if (monsterHP <= 0 || heroHP <= 0) return;
      playDebuffSound();
      resetPowerDiceToCommon();
    }, 8000);
  } else if (bossElement === 'shadow') {
    updateDebuffLabel('🌑 ' + BOSSES.find(b => b.element === 'shadow').name + ' pode fechar a arena em 3x3!', 'shadow');
    bossDebuffInterval = setInterval(() => {
      if (monsterHP <= 0 || heroHP <= 0) return;
      shadowShrinkTimer = 4;
      playDebuffSound();
      floatText('🌑 Claustrofobia!', 'var(--shadow)');
      renderBoard(false);
    }, 7000);
  } else if (bossElement === 'fire') {
    updateDebuffLabel('🔥 Queimadura contínua enquanto durar o combate!', 'fire');
    // dano contínuo é tratado diretamente no loop do timer principal (startTimer)
  }
}

// ---------------------------------------------------------------
// TIMER DE ATAQUE DO BOSS (tempo real) + PUNIÇÃO POR INATIVIDADE (#4)
// ---------------------------------------------------------------

let fireBurnAccum = 0;
function startTimer() {
  clearInterval(timerInterval);
  timerDuration = 7 + (runBonuses.extraTime * 2);
  timerElapsed = 0;
  fireBurnAccum = 0;

  timerInterval = setInterval(() => {
    if (busy || monsterHP <= 0 || heroHP <= 0) return;

    // contadores de duração de debuffs/buffs
    if (iceBlockTimer > 0) { iceBlockTimer -= 0.1; if (iceBlockTimer <= 0) { iceBlockTimer = 0; updateSelectionBar(); } }
    if (shadowShrinkTimer > 0) { shadowShrinkTimer -= 0.1; if (shadowShrinkTimer <= 0) { shadowShrinkTimer = 0; renderBoard(false); } }
    if (invulnerableTimer > 0) invulnerableTimer -= 0.1;

    // Boss de Fogo: queimadura contínua (~1 HP/seg)
    if (isBoss && bossElement === 'fire') {
      fireBurnAccum += 0.1;
      if (fireBurnAccum >= 1) {
        fireBurnAccum = 0;
        heroHP = Math.max(0, heroHP - 1);
        updateHeroHP();
      }
    }

    // NOVO (#4): Regeneração do Boss por inatividade (>5s sem Somar/Atacar)
    const idleFor = (Date.now() - lastActionTime) / 1000;
    if (idleFor > 5 && monsterHP > 0 && monsterHP < monsterMaxHP) {
      const regenPct = 0.03 + Math.random() * 0.02; // 3% a 5% por segundo
      monsterHP = Math.min(monsterMaxHP, monsterHP + monsterMaxHP * regenPct * 0.1);
      updateHP();
    }

    if (freezeTimer > 0) {
      freezeTimer -= 0.1;
      document.getElementById('timerFill').classList.add('frozen');
      document.getElementById('timerLabel').textContent = '❄️ Atordoado (' + freezeTimer.toFixed(1) + 's)';
      return;
    }
    document.getElementById('timerFill').classList.remove('frozen');
    timerElapsed += 0.1;
    const remaining = Math.max(0, timerDuration - timerElapsed);
    document.getElementById('timerFill').style.width = ((timerElapsed / timerDuration) * 100) + '%';
    document.getElementById('timerLabel').textContent = 'Ataque em ' + remaining.toFixed(1) + 's';

    if (timerElapsed >= timerDuration) {
      timerElapsed = 0;
      let dmg = 12 + Math.floor(Math.random() * 8);
      dmg = Math.round(dmg * (1 - 0.15 * runBonuses.steelSkin));

      // Guerreiro (Par): Escudo absorve o ataque
      if (shieldActive) {
        shieldActive = false;
        document.getElementById('shieldBadge').classList.remove('active');
        floatText('🛡️ Escudo Absorveu!', '#5ecbff');
        playShieldSound();
      } else if (invulnerableTimer > 0) {
        floatText('✨ Invulnerável!', '#ffd23f');
      } else {
        heroHP -= dmg;
        updateHeroHP();
        floatText('Monstro Atacou! -' + dmg, '#ff5b5b');
        const he = document.getElementById('heroEmoji');
        he.classList.remove('hurt'); void he.offsetWidth; he.classList.add('hurt');
      }
      const me = document.getElementById('monsterEmoji');
      me.classList.remove('attackmove'); void me.offsetWidth; me.classList.add('attackmove');
      resetStreak();
      if (heroHP <= 0) { heroHP = 0; updateHeroHP(); showGameOverModal(); }
    }
  }, 100);
}

// ---------------------------------------------------------------
// INÍCIO DE NÍVEL — normal ou Boss (grade 4x4 ou 5x6)
// ---------------------------------------------------------------
function startLevel(idx) {
  level = idx;
  isBoss = ((idx + 1) % 4 === 0); // NOVO (#2): a cada 4º desafio é um Boss

  // reset de flags por nível
  shieldActive = false; document.getElementById('shieldBadge').classList.remove('active');
  critNextAttack = false; sniperMode = false; mageDoubleElemental = false;
  invulnerableTimer = 0; nextAttackMultiplier = 1;
  iceBlockTimer = 0; shadowShrinkTimer = 0; freezeTimer = 0;
  clearInterval(arrowRainInterval);
  lastActionTime = Date.now();
  resetStreak();

  const arena = document.getElementById('arena');
  let m;
  if (isBoss) {
    const boss = BOSSES[Math.floor(idx / 4) % BOSSES.length];
    bossElement = boss.element;
    // REGRA 5: Boss = 6 LINHAS por 5 COLUNAS. ROWS é o nº de linhas, COLS o nº de colunas.
    COLS = 5; ROWS = 6; SIZE = COLS * ROWS;
    m = { name: boss.name, emoji: boss.emoji, hp: boss.hp };
    monsterMaxHP = boss.hp + idx * 25;
    arena.classList.add('boss-fight');
    document.getElementById('monsterName').innerHTML = '<span class="boss-tag">👑 BOSS</span>' + m.name;
  } else {
    m = MONSTERS[level % MONSTERS.length];
    COLS = 4; ROWS = 4; SIZE = COLS * ROWS;
    monsterMaxHP = m.hp + idx * 50;
    bossElement = null;
    arena.classList.remove('boss-fight');
    document.getElementById('monsterName').textContent = m.name;
  }
  monsterHP = monsterMaxHP;
  weaknessElement = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];

  document.getElementById('levelPill').textContent = 'Desafio ' + (level + 1);
  document.getElementById('monsterEmoji').textContent = m.emoji;
  document.getElementById('weaknessTag').textContent = 'Fraqueza: ' + ELEMENT_LABEL[weaknessElement];
  document.getElementById('weaknessTag').style.color = ELEMENT_COLOR[weaknessElement];

  rollLuckyNumber();
  updateHP();
  updateHeroHP();
  board = Array.from({ length: SIZE }, () => randDie());
  selectedIndices = [];
  renderBoard(false);
  startTimer();
  startBossDebuffs();
}

// ---------------------------------------------------------------
// MODAIS
// ---------------------------------------------------------------
function showModal(title, message, btnText, onClick) {
  const overlay = document.getElementById('overlay');
  const modalBox = document.getElementById('modalBox');
  modalBox.innerHTML = `<h2>${title}</h2><p>${message}</p><button class="btn" id="modalActionBtn">${btnText}</button>`;
  overlay.classList.add('show');
  document.getElementById('modalActionBtn').onclick = () => {
    overlay.classList.remove('show');
    if (onClick) onClick();
  };
}
function showGameOverModal() {
  clearInterval(timerInterval);
  clearInterval(bossDebuffInterval);
  clearInterval(arrowRainInterval);
  playDefeatSound();
  showModal('💀 DERROTA', 'Seus pontos de vida acabaram e o monstro venceu esta batalha...', 'Tentar Novamente', () => {
    heroHP = heroMaxHP;
    startLevel(0);
  });
}
function showLevelUpModal(onComplete) {
  const shuffled = [...POWER_CARDS].sort(() => 0.5 - Math.random());
  const options = shuffled.slice(0, 3);
  const overlay = document.getElementById('overlay');
  const modalBox = document.getElementById('modalBox');

  const cardsHTML = options.map(card => `
    <div class="card" onclick="selectPower('${card.id}')">
      <div class="card-icon">${card.icon}</div>
      <div class="card-info">
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
      </div>
    </div>
  `).join('');

  modalBox.innerHTML = `<h2>🎉 LEVEL UP!</h2><p>Escolha uma dádiva para fortalecer sua jornada:</p><div class="cards">${cardsHTML}</div>`;
  overlay.classList.add('show');

  window.selectPower = (powerId) => {
    runBonuses[powerId] = (runBonuses[powerId] || 0) + 1;
    renderBonusChips();
    if (powerId === 'extraTime') timerDuration += 2;
    overlay.classList.remove('show');
    delete window.selectPower;
    if (onComplete) onComplete();
  };
}

// NOVO (#1): modal de seleção de classe, exibido antes do Desafio 1
function showClassSelectModal(onComplete) {
  const overlay = document.getElementById('overlay');
  const modalBox = document.getElementById('modalBox');
  const cardsHTML = Object.keys(CLASSES).map(id => {
    const c = CLASSES[id];
    return `
      <div class="class-card" onclick="chooseClass('${id}')">
        <div class="class-title">${c.icon} ${c.name}</div>
        <ul>
          <li><strong>Par:</strong> ${c.par}</li>
          <li><strong>Trinca:</strong> ${c.trinca}</li>
          <li><strong>Quadra:</strong> ${c.quadra}</li>
        </ul>
      </div>`;
  }).join('');

  modalBox.innerHTML = `<h2>Escolha sua Classe</h2><p>Sua classe muda o efeito de Pares, Trincas e Quadras durante toda a run.</p>${cardsHTML}`;
  overlay.classList.add('show');

  window.chooseClass = (id) => {
    playerClass = id;
    document.getElementById('classBadge').textContent = CLASSES[id].icon + ' ' + CLASSES[id].name;
    overlay.classList.remove('show');
    delete window.chooseClass;
    if (onComplete) onComplete();
  };
}

// NOVO (#5): tutorial inicial — Somar -> Criar Magias -> Atacar Fraquezas
function showTutorialModal(onComplete) {
  const overlay = document.getElementById('overlay');
  const modalBox = document.getElementById('modalBox');
  modalBox.innerHTML = `
    <h2>Como Jogar</h2>
    <div class="tutorial-steps">
      <p><b>1. Some</b> — selecione 2 a 4 dados e toque em "➕ Somar" para juntá-los em um único dado maior.</p>
      <p><b>2. Crie Magias</b> — se a soma dos dados selecionados bater exatamente em 15-19 (com no máximo 2 dados), você desperta uma Magia Elemental ao Atacar.</p>
      <p><b>3. Ataque a Fraqueza</b> — cada inimigo tem um elemento fraco (mostrado abaixo do nome dele). Acertar essa magia causa +50% de dano!</p>
    </div>
    <button class="btn" id="modalActionBtn">Entendi, vamos lá!</button>
  `;
  overlay.classList.add('show');
  document.getElementById('modalActionBtn').onclick = () => {
    overlay.classList.remove('show');
    if (onComplete) onComplete();
  };
}

function checkEndState() {
  if (monsterHP <= 0) {
    clearInterval(timerInterval);
    clearInterval(bossDebuffInterval);
    clearInterval(arrowRainInterval);
    heroHP = heroMaxHP;
    updateHeroHP();
    playVictorySound();
    const wasBoss = isBoss;
    const leveledUp = addXP(wasBoss ? 120 : 60);

    setTimeout(() => {
      const proceed = () => startLevel(level + 1);
      const finish = leveledUp ? () => showLevelUpModal(proceed) : proceed;
      showModal(
        wasBoss ? '👑 BOSS DERROTADO!' : '⚔️ VITÓRIA!',
        `Você derrotou ${document.getElementById('monsterName').textContent.replace('👑 BOSS','')}! Sua vida foi restaurada.`,
        'Próximo Desafio',
        finish
      );
    }, 300);
  }
}

document.getElementById('mergeBtn').onclick = resolveMerge;
document.getElementById('launchBtn').onclick = resolvePlay;
document.getElementById('helpBtn').onclick = () => showTutorialModal(() => {});
document.getElementById('codexBtn').onclick = () => {
  showModal('📖 Codex', 'Elementos: 15 Fogo · 16 Gelo · 17 Raio · 18 Sombra · 19 Luz · 20 Coringa.<br><br>Reações híbridas: Fogo+Gelo = Choque Térmico · Luz+Raio = Supercondutor · Fogo+Sombra = Chama Negra.<br><br>2 Coringas = Invulnerabilidade + 5x. 4 Coringas = Ultimate (50% da vida do Boss).', 'Fechar', () => {});
};

// ---------------------------------------------------------------
// BOOT: classe -> tutorial -> Desafio 1
// ---------------------------------------------------------------
showClassSelectModal(() => {
  showTutorialModal(() => {
    startLevel(0);
  });
});