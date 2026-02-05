/**
 * LIFE ENGLISH - SCRIPT COMPLETO 
 * Versão: Cloud Optimized (MongoDB + Render)
 */

// AJUSTE PARA NUVEM: Detecta automaticamente se está no PC ou na Web
const BASE_URL = window.location.origin;
const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api/frases"
    : `${BASE_URL}/api/frases`;

let frases = [];
let xp = parseInt(localStorage.getItem('dev_xp')) || 0;
let indexAtual = 0;
let nivelAtivo = 'BEGINNER';
let analiseAtual = {};
let timeLeft = 15;
let timerFunc;
let timeoutTraducao;
let filaSRS = JSON.parse(localStorage.getItem('dev_srs_queue_v2')) || [];

// --- CONSTANTES & BIBLIOTECAS ---
const PARETO_LIST = [
    'get', 'have', 'take', 'do', 'make', 'go', 'can', 'will', 'would', 'should',
    'want', 'need', 'like', 'think', 'know', 'say', 'tell', 'look', 'come', 'give',
    'time', 'way', 'new', 'good', 'some', 'about', 'just', 'more', 'then', 'now',
    'could', 'where', 'how', 'who', 'why', 'help', 'sorry', 'please', 'thanks'
];

const LIB = {
    pronomes: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'this', 'that'],
    auxiliares: ['do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'must', 'am', 'is', 'are', 'was', 'were', 'have', 'has', 'had'],
    verbos: ['go', 'want', 'like', 'play', 'work', 'see', 'take', 'get', 'know', 'speak', 'study', 'believe', 'understand'],
    adjetivos: ['good', 'bad', 'happy', 'sad', 'beautiful', 'big', 'small', 'hot', 'cold', 'new', 'old', 'easy', 'hard', 'important', 'ready']
};

const TEMPLATES_IA = {
    trabalho: [
        { en: "I have to finish this now", pt: "Eu tenho que terminar isso agora", sounds: "ai häv-tuh finish dis nau" },
        { en: "Can you help me with the meeting?", pt: "Você pode me ajudar com a reunião?", sounds: "quên-ju help-mi uid-da mitin" },
        { en: "I will send the email today", pt: "Eu vou enviar o e-mail hoje", sounds: "ai uil sênd da imêil tudêi" }
    ],
    viagem: [
        { en: "Where can I get a taxi?", pt: "Onde posso conseguir um táxi?", sounds: "uêr quên-ai guet-â téksi" },
        { en: "I need to find my way back", pt: "Eu preciso encontrar meu caminho de volta", sounds: "ai nid-tuh faind-mai uêi bék" },
        { en: "Is it far from here?", pt: "É longe daqui?", sounds: "iz it fár frâm hir" }
    ],
    dia_a_dia: [
        { en: "What do you want to eat?", pt: "O que você quer comer?", sounds: "uatcha uana it" },
        { en: "I think it is going to rain", pt: "Eu acho que vai chover", sounds: "ai t-hink its gona rêin" },
        { en: "I am just looking, thanks", pt: "Estou apenas olhando, obrigado", sounds: "ai âm djast lukin tênks" }
    ]
};

// --- ALGORITMO DE DISTÂNCIA ---
function calcularDistancia(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

// --- FUNÇÕES IA ---
function sugerirFrasesIA() {
    const tema = prompt("Escolha um tema: trabalho, viagem ou dia_a_dia")?.toLowerCase();
    if (!tema) return;
    const lista = TEMPLATES_IA[tema] || TEMPLATES_IA.dia_a_dia;
    const sugestao = lista[Math.floor(Math.random() * lista.length)];
    document.getElementById('newEn').value = sugestao.en;
    document.getElementById('newPt').value = sugestao.pt;
    document.getElementById('manualSounds').value = sugestao.sounds;
    analisarDinamico();
    alert("🤖 Sugestão IA carregada! Revise e clique em SALVAR.");
}

async function gerarFraseViaAPI() {
    try {
        const res = await fetch('https://api.adviceslip.com/advice');
        const data = await res.json();
        document.getElementById('newEn').value = data.slip.advice;
        analisarDinamico();
        alert("🎲 Nova frase aleatória carregada!");
    } catch (e) { alert("Erro ao buscar frase externa."); }
}

// --- LÓGICA COGNITIVA & PARETO ---
function isParetoPhrase(text) {
    const words = text.toLowerCase().split(/\s+/);
    const matches = words.filter(word => PARETO_LIST.includes(word.replace(/[?.,!]/g, "")));
    return matches.length >= 2;
}

function revelarResposta(item) {
    const displayPronuncia = document.getElementById('pronunciationDisplay');
    if (displayPronuncia && !displayPronuncia.querySelector('.translation-hint')) {
        const div = document.createElement('div');
        div.className = 'translation-hint';
        div.style = "margin-top: 10px; color: #00ff88; font-weight: bold; font-size: 1.1rem; border-top: 1px solid #333; padding-top: 5px;";
        div.innerHTML = `🇧🇷 ${item.pt}`;
        displayPronuncia.appendChild(div);
    }
}

// --- TIMER ADAPTATIVO ---
function startTimer() {
    clearInterval(timerFunc);
    let penalty = Math.floor(xp / 3000);
    timeLeft = Math.max(7, 15 - penalty);
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        timerDisplay.innerText = timeLeft;
        timerFunc = setInterval(() => {
            timeLeft--;
            timerDisplay.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timerFunc);
                triggerErrorEffect();
                registrarErro();
                proximaFrase();
            }
        }, 1000);
    }
}

// --- SISTEMA SRS ---
function registrarErro() {
    const item = getCurrentItem();
    if (!item) return;
    if (!filaSRS.find(x => x.en === item.en)) {
        filaSRS.push({ ...item, mastery: 0 });
        localStorage.setItem('dev_srs_queue_v2', JSON.stringify(filaSRS));
    }
    renderSRS();
}

function renderSRS() {
    const list = document.getElementById('reviewList');
    const panel = document.getElementById('reviewPanel');
    if (!list || !panel) return;
    if (filaSRS.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    list.innerHTML = '';
    filaSRS.slice(-3).reverse().forEach(item => {
        const div = document.createElement('div');
        div.style = "background: #000; padding: 10px; border-radius: 12px; margin-bottom: 8px; border-left: 3px solid #ff4444;";
        div.innerHTML = `<div style="color: #fff; font-size: 0.85rem; font-weight: bold;">${item.en}</div><div style="color: #888; font-size: 0.75rem;">${item.pt}</div>`;
        list.appendChild(div);
    });
}

// --- FEEDBACK DE VOZ ---
function gerarFeedbackShadowing(original, falado) {
    const limpar = (t) => t.toLowerCase().replace(/[?.,!]/g, "").trim();
    const origArr = limpar(original).split(/\s+/);
    const falArr = limpar(falado).split(/\s+/);
    let html = ""; let scoreTotal = 0;
    origArr.forEach((word, i) => {
        const userWord = falArr[i] || "";
        const dist = calcularDistancia(word, userWord);
        if (dist === 0) { html += `<span style="color: #00ff88; font-weight: bold;">${word}</span> `; scoreTotal += 1; }
        else if (dist <= 2 && userWord.length > 2) { html += `<span style="color: #ffcc00; border-bottom: 2px dashed;">${userWord || word}</span> `; scoreTotal += 0.7; }
        else { html += `<span style="color: #ff4444; text-decoration: line-through;">${userWord || "..."}</span> <small style="color: #666">(${word})</small> `; }
    });
    return { html, precisao: (scoreTotal / origArr.length) * 100 };
}

function testarPronuncia() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return alert("Voz não suportada.");
    const rec = new Speech(); rec.lang = 'en-US';
    rec.onstart = () => { document.getElementById('wave').classList.add('active'); document.getElementById('heardText').innerText = "Ouvindo..."; };
    rec.onend = () => document.getElementById('wave').classList.remove('active');
    rec.onresult = (e) => {
        const talk = e.results[0][0].transcript;
        const textoOriginal = document.getElementById('blockDisplay').innerText.replace(/\n/g, " ");
        const feedback = gerarFeedbackShadowing(textoOriginal, talk);
        document.getElementById('heardText').innerHTML = `<div style="font-size: 0.8rem; color: #888;">Detected: "${talk}"</div><div>${feedback.html}</div><div style="font-weight: 900; color: ${feedback.precisao > 70 ? '#00ff88' : '#ff4444'}">PRECISION: ${Math.round(feedback.precisao)}%</div>`;
        if (feedback.precisao >= 70) finalizarSucesso(getCurrentItem(), Math.floor(feedback.precisao), true);
        else { triggerErrorEffect(); registrarErro(); }
    };
    rec.start();
}

function finalizarSucesso(item, baseXP, isVoz) {
    playFeedback('success');
    revelarResposta(item);
    const paretoActive = isParetoPhrase(item.en);
    const bonus = Math.floor((baseXP + (timeLeft * 5)) * (paretoActive ? 2 : 1));
    xp += bonus;
    localStorage.setItem('dev_xp', xp);
    document.getElementById('xpDisplay').innerText = xp;
    showXpBonus(bonus, paretoActive);
    filaSRS = filaSRS.filter(x => x.en !== item.en);
    localStorage.setItem('dev_srs_queue_v2', JSON.stringify(filaSRS));
    setTimeout(proximaFrase, 2800);
}

// --- RENDERIZAÇÃO ---
function render() {
    // PROTEÇÃO: Garante que 'frases' seja sempre um array antes de filtrar
    const listaParaFiltrar = Array.isArray(frases) ? frases : [];
    const filtradas = listaParaFiltrar.filter(f => f.meta && f.meta.level === nivelAtivo);

    document.getElementById('xpDisplay').innerText = xp;
    updateAnalytics();
    renderSRS();

    let item;
    if (filaSRS.length > 0 && Math.random() < 0.4) {
        item = filaSRS[Math.floor(Math.random() * filaSRS.length)];
    } else {
        item = filtradas[indexAtual % filtradas.length] || defaultFrases()[0];
    }

    if (!item) return;

    const paretoActive = isParetoPhrase(item.en);
    const container = document.getElementById('mainContainer');
    const tenseBadge = document.getElementById('tenseBadge');
    if (container) container.className = paretoActive ? 'container pareto-active' : 'container';
    if (tenseBadge) {
        tenseBadge.innerText = paretoActive ? item.meta.tense + " • 80/20" : item.meta.tense;
        tenseBadge.className = paretoActive ? 'badge badge-pareto' : 'badge';
    }
    document.getElementById('typeBadge').innerText = item.meta.type;
    document.getElementById('pronunciationDisplay').innerHTML = gerarPronunciaDinamica(item.en, item.meta.soundsLike);
    const display = document.getElementById('blockDisplay');
    display.innerHTML = '';
    applySmartChunking(item.en).forEach(text => {
        const div = document.createElement('div');
        div.className = 'chunk'; div.innerText = text; div.style = getCorGramatical(text);
        display.appendChild(div);
    });
    falar(item.en);
    startTimer();
}

// --- FUNÇÕES DE APOIO ---
function gerarPronunciaDinamica(texto, originalSound) {
    const REGRAS = [{ r: /\bdid you\b/gi, s: "did-ju" }, { r: /\bwant to\b/gi, s: "wanna" }, { r: /\bgoing to\b/gi, s: "gonna" }, { r: /\bwhat do you\b/gi, s: "whatcha" }];
    let base = (originalSound && originalSound !== texto) ? originalSound : texto.toLowerCase();
    REGRAS.forEach(regra => base = base.replace(regra.r, `<span class="connected-match">${regra.s}</span>`));
    return `🗣️ Som: ${base}`;
}

function applySmartChunking(text) {
    const commonChunks = [/\b(i am|i'm|it is|it's|you are|you're)\b/gi, /\b(want to|wanna|going to|gonna|have to)\b/gi];
    let processed = text;
    commonChunks.forEach(regex => processed = processed.replace(regex, (m) => m.replace(/ /g, "_")));
    let words = processed.split(' '); let finalBlocks = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i].includes('_')) finalBlocks.push(words[i].replace(/_/g, " "));
        else if (words[i + 1]) { finalBlocks.push(words[i] + " " + words[i + 1]); i++; }
        else finalBlocks.push(words[i]);
    }
    return finalBlocks;
}

function getCorGramatical(texto) {
    const t = texto.toLowerCase();
    if (LIB.auxiliares.some(w => t.includes(w))) return 'border-bottom: 4px solid var(--auxiliary);';
    if (LIB.pronomes.some(w => t.includes(w))) return 'border-bottom: 4px solid var(--pronoun);';
    if (LIB.verbos.some(w => t.includes(w))) return 'border-bottom: 4px solid var(--verb);';
    return 'border-bottom: 4px solid #444;';
}

function handleEnter(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('userInput').value.trim().toLowerCase().replace(/[?.,!]/g, "");
        const item = getCurrentItem();
        if (item && input === item.pt.toLowerCase().replace(/[?.,!]/g, "")) finalizarSucesso(item, 20, false);
        else { triggerErrorEffect(); registrarErro(); }
    }
}

function getCurrentItem() {
    const txt = document.getElementById('blockDisplay').innerText.replace(/\n/g, " ");
    const listaParaBusca = Array.isArray(frases) ? frases : [];
    return listaParaBusca.find(f => f.en === txt) || filaSRS.find(f => f.en === txt);
}

function proximaFrase() {
    indexAtual++;
    document.getElementById('userInput').value = '';
    document.getElementById('heardText').innerHTML = '';
    render();
}

function falar(t) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
}

function falarAtual() { falar(document.getElementById('blockDisplay').innerText); }

function triggerErrorEffect() {
    const container = document.getElementById('mainContainer');
    if (container) { container.style.animation = "shake 0.3s"; setTimeout(() => container.style.animation = "", 300); }
    playFeedback('error');
}

function setNivel(lvl) {
    nivelAtivo = lvl; indexAtual = 0;
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${lvl}`).classList.add('active');
    render();
}

function updateAnalytics() {
    let p = 0, v = 0, a = 0;
    const listaAnalytics = Array.isArray(frases) ? frases : [];
    listaAnalytics.forEach(f => {
        const words = f.en.toLowerCase().split(' ');
        words.forEach(w => {
            if (LIB.pronomes.includes(w)) p++;
            if (LIB.verbos.includes(w)) v++;
            if (LIB.adjetivos.includes(w)) a++;
        });
    });
    if (document.getElementById('count-pronouns')) document.getElementById('count-pronouns').innerText = p;
    if (document.getElementById('count-verbs')) document.getElementById('count-verbs').innerText = v;
    if (document.getElementById('count-adjectives')) document.getElementById('count-adjectives').innerText = a;
}

async function analisarDinamico() {
    const en = document.getElementById('newEn').value;
    if (!en) return;
    let tense = /\b(will|going to|'ll)\b/i.test(en) ? "FUTURE" : (/\b(ed|did|was|were|went|had)\b/i.test(en) ? "PAST" : "PRESENT");
    let type = en.includes("?") ? "QUESTION" : (/\b(not|n't|never)\b/i.test(en) ? "NEGATIVE" : "AFFIRMATIVE");
    analiseAtual = { tense, type };
    ['PAST', 'PRESENT', 'FUTURE'].forEach(t => {
        const el = document.getElementById(`tag-${t}`);
        if (el) el.style.opacity = tense === t ? "1" : "0.2";
    });
    clearTimeout(timeoutTraducao);
    timeoutTraducao = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(en)}&langpair=en|pt-BR`);
            const data = await res.json();
            document.getElementById('newPt').value = data.responseData.translatedText;
            document.getElementById('translationPreview').innerText = "Tradução Sugerida: " + data.responseData.translatedText;
        } catch (e) { }
    }, 800);
}

// FUNÇÃO DE SALVAMENTO CORRIGIDA PARA CELULAR E RENDER
async function saveNewPhrase() {
    const en = document.getElementById('newEn').value;
    const pt = document.getElementById('newPt').value;
    const soundsLike = document.getElementById('manualSounds').value;
    const level = document.getElementById('newLevel').value;

    if (!en || !pt) return alert("Preencha os campos!");

    const novaFrase = {
        en: en.trim(),
        pt: pt.trim(),
        meta: {
            level: level,
            tense: analiseAtual.tense || "PRESENT",
            type: analiseAtual.type || "AFFIRMATIVE",
            soundsLike: soundsLike || en
        }
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(novaFrase)
        });

        if (res.ok) {
            alert("✨ Frase Salva no MongoDB!");
            location.reload();
        } else {
            const errorData = await res.json();
            alert("Erro: " + errorData.error);
        }
    } catch (e) {
        alert("Erro ao conectar ao servidor! Verifique sua conexão.");
    }
}

async function fetchFrases() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();

        // CORREÇÃO CRÍTICA: Verifica se os dados recebidos são de fato um Array
        if (Array.isArray(data)) {
            frases = data;
        } else {
            console.error("Servidor não retornou uma lista. Usando padrão.");
            frases = defaultFrases();
        }
    } catch (e) {
        console.error("Erro na busca:", e);
        frases = defaultFrases();
    }
    render();
}

function defaultFrases() {
    return [{ en: "I want to learn", pt: "Eu quero aprender", meta: { level: "BEGINNER", tense: "PRESENT", type: "AFFIRMATIVE", soundsLike: "ai uana lêrn" } }];
}

function showXpBonus(amount, isPareto) {
    const div = document.createElement('div');
    div.style = `position: fixed; top: 50%; left: 50%; color: ${isPareto ? '#ffcc00' : '#00ff88'}; font-weight: 900; z-index: 1000; pointer-events: none; transform: translate(-50%, -50%);`;
    div.innerText = `+${amount} XP ${isPareto ? '🔥 PARETO' : ''}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

function playFeedback(type) {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const osc = context.createOscillator(); const gain = context.createGain();
        osc.connect(gain); gain.connect(context.destination);
        osc.frequency.setValueAtTime(type === 'success' ? 580 : 120, context.currentTime);
        gain.gain.setValueAtTime(0.05, context.currentTime);
        osc.start(); osc.stop(context.currentTime + 0.15);
    } catch (e) { }
}

window.onload = fetchFrases;