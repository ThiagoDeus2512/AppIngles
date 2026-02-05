const API_URL = "http://localhost:3000/api/frases";
let frases = [];
let xp = parseInt(localStorage.getItem('dev_xp')) || 0;
let indexAtual = 0;
let nivelAtivo = 'BEGINNER';
let analiseAtual = {};
let timeLeft = 15;
let timerFunc;
let timeoutTraducao;
let filaSRS = JSON.parse(localStorage.getItem('dev_srs_queue_v2')) || [];

const PARETO_LIST = [
    'get', 'have', 'take', 'do', 'make', 'go', 'can', 'will', 'would', 'should',
    'want', 'need', 'like', 'think', 'know', 'say', 'tell', 'look', 'come', 'give',
    'time', 'way', 'new', 'good', 'some', 'about', 'just', 'more', 'then', 'now',
    'could', 'where', 'how', 'who', 'why', 'help', 'sorry', 'please', 'thanks'
];

function isParetoPhrase(text) {
    const words = text.toLowerCase().split(/\s+/);
    const matches = words.filter(word => PARETO_LIST.includes(word.replace(/[?.,!]/g, "")));
    return matches.length >= 2;
}

const LIB = {
    pronomes: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'this', 'that'],
    auxiliares: ['do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'must', 'am', 'is', 'are', 'was', 'were', 'have', 'has', 'had'],
    verbos: ['go', 'want', 'like', 'play', 'work', 'see', 'take', 'get', 'know', 'speak', 'study', 'believe', 'understand'],
    adjetivos: ['good', 'bad', 'happy', 'sad', 'beautiful', 'big', 'small', 'hot', 'cold', 'new', 'old', 'easy', 'hard', 'important', 'ready']
};

// --- TÉCNICA: REVELAR RESPOSTA (NOVO) ---
function revelarResposta(item) {
    const displayPronuncia = document.getElementById('pronunciationDisplay');
    // Mantém a dica de som e adiciona a tradução em destaque
    displayPronuncia.innerHTML += `
        <div style="margin-top: 10px; color: #00ff88; font-weight: bold; font-size: 1.1rem; border-top: 1px solid #333; pt-2">
            🇧🇷 ${item.pt}
        </div>
    `;
}

// --- TÉCNICA: PRONÚNCIA DINÂMICA ---
const REGRAS_PRONUNCIA = [
    { r: /\bdid you\b/gi, s: "did-ju" },
    { r: /\bwant to\b/gi, s: "wanna" },
    { r: /\bgoing to\b/gi, s: "gonna" },
    { r: /\bwhat do you\b/gi, s: "whatcha" }
];

function gerarPronunciaDinamica(texto, originalSound) {
    let base = (originalSound && originalSound !== texto) ? originalSound : texto.toLowerCase();
    let temp = base;
    REGRAS_PRONUNCIA.forEach(regra => {
        if (regra.r.test(temp)) {
            temp = temp.replace(regra.r, `<span class="connected-match">${regra.s}</span>`);
        }
    });
    return `🗣️ Som: ${temp}`;
}

// --- TÉCNICA: SHADOWING VISUAL ---
function gerarFeedbackShadowing(original, falado) {
    const origArr = original.toLowerCase().replace(/[?.,!]/g, "").split(/\s+/);
    const falArr = falado.toLowerCase().replace(/[?.,!]/g, "").split(/\s+/);
    let html = "";
    let acertos = 0;
    origArr.forEach((word, i) => {
        if (falArr[i] === word) {
            html += `<span class="word-correct">${word}</span> `;
            acertos++;
        } else if (falArr[i]) {
            html += `<span class="word-error">${falArr[i]}</span> <span style="color: var(--primary);">(${word})</span> `;
        } else {
            html += `<span class="word-missed">(${word})</span> `;
        }
    });
    return { html, precisao: (acertos / origArr.length) * 100 };
}

// --- TÉCNICA: SMART CHUNKING ---
function applySmartChunking(text) {
    const commonChunks = [
        /\b(i am|i'm|it is|it's|you are|you're|they are|they're|we are|we're)\b/gi,
        /\b(want to|wanna|going to|gonna|have to|has to|need to|did you|do you|will you|would you)\b/gi,
        /\b(i don't|i didn't|it doesn't|she doesn't)\b/gi
    ];
    let processed = text;
    commonChunks.forEach(regex => { processed = processed.replace(regex, (match) => match.replace(/ /g, "_")); });
    let words = processed.split(' ');
    let finalBlocks = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i].includes('_')) { finalBlocks.push(words[i].replace(/_/g, " ")); }
        else if (nivelAtivo === 'ADVANCED') {
            if (words[i + 1] && words[i + 2]) { finalBlocks.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`); i += 2; }
            else { finalBlocks.push(words[i]); }
        } else if (words[i + 1] && !words[i + 1].includes('_')) {
            finalBlocks.push(words[i] + " " + words[i + 1]); i++;
        } else { finalBlocks.push(words[i]); }
    }
    return finalBlocks;
}

// --- RENDERIZAÇÃO ---
function render() {
    const filtradas = frases.filter(f => f.meta.level === nivelAtivo);
    document.getElementById('xpDisplay').innerText = xp;
    updateAnalytics();
    renderSRS();
    let item = (filaSRS.length > 0 && Math.random() > 0.6) ?
        filaSRS[Math.floor(Math.random() * filaSRS.length)] :
        (filtradas[indexAtual] || filtradas[0]);
    if (!item) return;
    const paretoActive = isParetoPhrase(item.en);
    const container = document.getElementById('mainContainer');
    const tenseBadge = document.getElementById('tenseBadge');
    if (paretoActive) {
        container.classList.add('pareto-active');
        tenseBadge.classList.add('badge-pareto');
        tenseBadge.innerText = item.meta.tense + " • 80/20";
    } else {
        container.classList.remove('pareto-active');
        tenseBadge.classList.remove('badge-pareto');
        tenseBadge.innerText = item.meta.tense;
    }
    document.getElementById('typeBadge').innerText = item.meta.type;
    document.getElementById('pronunciationDisplay').innerHTML = gerarPronunciaDinamica(item.en, item.meta.soundsLike);
    const display = document.getElementById('blockDisplay');
    display.innerHTML = '';
    applySmartChunking(item.en).forEach(text => {
        const div = document.createElement('div');
        div.className = 'chunk';
        div.innerText = text;
        div.style = getCorGramatical(text);
        display.appendChild(div);
    });
    falar(item.en);
    startTimer();
}

// --- ANALYTICS ---
function updateAnalytics() {
    let p = 0, v = 0, a = 0;
    frases.forEach(f => {
        const words = f.en.toLowerCase().split(' ');
        words.forEach(w => {
            if (LIB.pronomes.includes(w)) p++;
            if (LIB.verbos.includes(w)) v++;
            if (LIB.adjetivos.includes(w)) a++;
        });
    });
    document.getElementById('count-pronouns').innerText = p;
    document.getElementById('count-verbs').innerText = v;
    document.getElementById('count-adjectives').innerText = a;
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
        div.style = "background: #000; padding: 10px; border-radius: 12px; margin-bottom: 8px; border-left: 3px solid var(--error);";
        div.innerHTML = `<div style="color: #fff; font-size: 0.85rem; font-weight: bold;">${item.en}</div><div style="color: #888; font-size: 0.75rem;">${item.pt}</div>`;
        list.appendChild(div);
    });
}

function testarPronuncia() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return alert("Reconhecimento de voz não suportado.");
    const rec = new Speech();
    rec.lang = 'en-US';
    rec.onstart = () => document.getElementById('wave').classList.add('active');
    rec.onend = () => document.getElementById('wave').classList.remove('active');
    rec.onresult = (e) => {
        const talk = e.results[0][0].transcript;
        const textoOriginal = document.getElementById('blockDisplay').innerText.replace(/\n/g, " ");
        const feedback = gerarFeedbackShadowing(textoOriginal, talk);
        const item = getCurrentItem();
        document.getElementById('heardText').innerHTML = feedback.html;
        if (feedback.precisao >= 70) {
            playFeedback('success');
            revelarResposta(item); // REVELA TRADUÇÃO
            const paretoActive = isParetoPhrase(textoOriginal);
            const bonus = Math.floor((50 + (timeLeft * 5)) * (paretoActive ? 2 : 1));
            xp += bonus;
            localStorage.setItem('dev_xp', xp);
            document.getElementById('xpDisplay').innerText = xp;
            showXpBonus(bonus, paretoActive);
            setTimeout(proximaFrase, 2500); // Mais tempo para ler
        } else {
            triggerErrorEffect();
            registrarErro();
        }
    };
    rec.start();
}

function getCorGramatical(texto) {
    const t = texto.toLowerCase().split(' ');
    if (t.some(w => LIB.auxiliares.includes(w))) return 'border-bottom: 4px solid var(--auxiliary);';
    if (t.some(w => LIB.pronomes.includes(w))) return 'border-bottom: 4px solid var(--pronoun);';
    if (t.some(w => LIB.verbos.includes(w))) return 'border-bottom: 4px solid var(--verb);';
    if (t.some(w => LIB.adjetivos.includes(w))) return 'border-bottom: 4px solid var(--adjective);';
    return 'border-bottom: 4px solid #444;';
}

function startTimer() {
    clearInterval(timerFunc);
    timeLeft = 15;
    document.getElementById('timerDisplay').innerText = timeLeft;
    timerFunc = setInterval(() => {
        timeLeft--;
        document.getElementById('timerDisplay').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerFunc);
            triggerErrorEffect();
            registrarErro();
            proximaFrase();
        }
    }, 1000);
}

function registrarErro() {
    const item = getCurrentItem();
    if (!item) return;
    if (!filaSRS.find(x => x.en === item.en)) {
        filaSRS.push({ ...item, mastery: 0 });
        localStorage.setItem('dev_srs_queue_v2', JSON.stringify(filaSRS));
    }
    renderSRS();
}

function getCurrentItem() {
    const txt = document.getElementById('blockDisplay').innerText.replace(/\n/g, " ");
    return frases.find(f => f.en === txt) || filaSRS.find(f => f.en === txt);
}

function handleEnter(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('userInput').value.trim().toLowerCase().replace(/[?.,!]/g, "");
        const item = getCurrentItem();
        if (item && input === item.pt.toLowerCase().replace(/[?.,!]/g, "")) {
            playFeedback('success');
            revelarResposta(item); // REVELA TRADUÇÃO
            const paretoActive = isParetoPhrase(item.en);
            const bonus = (10 + timeLeft) * (paretoActive ? 2 : 1);
            xp += bonus;
            localStorage.setItem('dev_xp', xp);
            document.getElementById('xpDisplay').innerText = xp;
            showXpBonus(bonus, paretoActive);
            setTimeout(proximaFrase, 2500); // Mais tempo para ler
        } else {
            triggerErrorEffect();
            registrarErro();
        }
    }
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
    u.lang = 'en-US'; u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

function falarAtual() { falar(document.getElementById('blockDisplay').innerText); }

function triggerErrorEffect() {
    const container = document.getElementById('mainContainer');
    container.style.animation = "shake 0.3s";
    playFeedback('error');
    setTimeout(() => container.style.animation = "", 300);
}

function setNivel(lvl) {
    nivelAtivo = lvl; indexAtual = 0;
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${lvl}`).classList.add('active');
    render();
}

async function saveNewPhrase() {
    const en = document.getElementById('newEn').value;
    const pt = document.getElementById('newPt').value;
    const soundsLike = document.getElementById('manualSounds').value;
    if (!en || !pt) return alert("Preencha inglês e português!");
    const novaFrase = {
        en, pt,
        meta: {
            level: document.getElementById('newLevel').value,
            tense: analiseAtual.tense || "PRESENT",
            type: analiseAtual.type || "AFFIRMATIVE",
            soundsLike: soundsLike || en
        }
    };
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaFrase)
        });
        if (res.ok) { alert("Salvo com sucesso!"); location.reload(); }
    } catch (e) { alert("Servidor offline!"); }
}

async function analisarDinamico() {
    const en = document.getElementById('newEn').value;
    if (!en) return;
    let tense = /\b(will|going to|'ll)\b/i.test(en) ? "FUTURE" : (/\b(ed|did|was|were|went|had)\b/i.test(en) ? "PAST" : "PRESENT");
    let type = en.includes("?") ? "QUESTION" : (/\b(not|n't|never)\b/i.test(en) ? "NEGATIVE" : "AFFIRMATIVE");
    analiseAtual = { tense, type };
    document.getElementById('tag-PAST').style.opacity = tense === "PAST" ? "1" : "0.3";
    document.getElementById('tag-PRESENT').style.opacity = tense === "PRESENT" ? "1" : "0.3";
    document.getElementById('tag-FUTURE').style.opacity = tense === "FUTURE" ? "1" : "0.3";
    clearTimeout(timeoutTraducao);
    timeoutTraducao = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(en)}&langpair=en|pt-BR`);
            const data = await res.json();
            document.getElementById('newPt').value = data.responseData.translatedText;
        } catch (e) { console.error("Erro Tradutor"); }
    }, 800);
}

async function gerarFraseViaAPI() {
    try {
        const res = await fetch('https://api.adviceslip.com/advice');
        const data = await res.json();
        document.getElementById('newEn').value = data.slip.advice;
        analisarDinamico();
    } catch (e) { console.error("Erro API"); }
}

async function fetchFrases() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        frases = data.length > 0 ? data : defaultFrases();
        render();
    } catch (e) { frases = defaultFrases(); render(); }
}

function defaultFrases() {
    return [
        { en: "I want to study", pt: "Eu quero estudar", meta: { level: "BEGINNER", tense: "PRESENT", type: "AFFIRMATIVE", soundsLike: "ai uana estãdi" } },
        { en: "Did you go?", pt: "Você foi?", meta: { level: "BEGINNER", tense: "PAST", type: "QUESTION", soundsLike: "did-ju gou" } }
    ];
}

function showXpBonus(amount, isPareto) {
    const div = document.createElement('div');
    div.className = 'xp-float animate-xp ' + (isPareto ? 'xp-pareto' : 'xp-normal');
    div.innerText = `+${amount} XP ${isPareto ? '🔥 PARETO' : ''}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

function playFeedback(type) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain); gain.connect(context.destination);
    osc.frequency.setValueAtTime(type === 'success' ? 587 : 110, context.currentTime);
    gain.gain.setValueAtTime(0.05, context.currentTime);
    osc.start(); osc.stop(context.currentTime + 0.15);
}

window.onload = fetchFrases;