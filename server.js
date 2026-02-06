require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("\n\x1b[34m[SISTEMA]\x1b[0m Verificando configuração...");

// --- SEGURANÇA: Verificação de Chaves ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Erro: GEMINI_API_KEY não encontrada no .env");
}
if (!process.env.MONGO_URI) {
    console.warn("⚠️ Aviso: MONGO_URI não encontrada no .env, usando fallback.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const upload = multer({ storage: multer.memoryStorage() });

// --- MONGODB ---
// Prioriza sempre o que está no .env por segurança
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("\x1b[32m🍃 Conectado ao MongoDB Atlas!\x1b[0m"))
    .catch(err => console.error("❌ Erro MongoDB:", err.message));

// --- MODELO ---
const FraseSchema = new mongoose.Schema({
    en: { type: String, required: true },
    pt: { type: String, required: true },
    meta: {
        level: { type: String, default: 'BEGINNER' },
        tense: { type: String, default: 'PRESENT' },
        type: { type: String, default: 'AFFIRMATIVE' },
        soundsLike: String
    },
    id: { type: Number, default: () => Date.now() },
    createdAt: { type: Date, default: Date.now }
});
const Frase = mongoose.model('Frase', FraseSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- ROTAS DA API ---

app.post('/api/analyze-voice', upload.single('audio'), async (req, res) => {
    try {
        const { expectedText } = req.body;
        const audioFile = req.file;

        if (!audioFile) return res.status(400).json({ error: "Áudio não recebido." });

        console.log(`\x1b[35m[GEMINI AI]\x1b[0m Analisando áudio para: "${expectedText}"`);

        // 🔥 O prefixo "models/" ajuda a evitar o erro 404 em algumas versões do SDK
        const model = genAI.getGenerativeModel({
            model: "models/gemini-1.5-flash"
        });

        const audioData = {
            inlineData: {
                data: audioFile.buffer.toString("base64"),
                mimeType: "audio/webm" // Forçamos webm que é o padrão do seu script.js
            }
        };

        const prompt = `Você é um professor nativo de inglês. Analise a pronúncia do usuário para a frase: "${expectedText}". 
        Responda em Português de forma curta:
        1. Avalie a clareza da pronúncia.
        2. Liste palavras específicas que ele errou (se houver).
        3. Dê uma nota final como "Nota: X/100".`;

        const result = await model.generateContent([prompt, audioData]);
        const response = await result.response;
        const text = response.text();

        console.log("✅ Análise concluída com sucesso.");
        res.json({ status: "success", feedback: text });

    } catch (err) {
        console.error("❌ Erro na API Gemini:", err.message);
        res.status(500).json({ error: "IA indisponível.", details: err.message });
    }
});

// --- CRUD Frases ---
app.get('/api/frases', async (req, res) => {
    try {
        const frases = await Frase.find().sort({ createdAt: -1 });
        res.json(frases);
    } catch (err) { res.status(500).json({ error: "Erro ao buscar frases." }); }
});

app.post('/api/frases', async (req, res) => {
    try {
        const { en, pt, meta } = req.body;
        const novaFrase = new Frase({ en: en.trim(), pt: pt.trim(), meta });
        await novaFrase.save();
        res.status(201).json(novaFrase);
    } catch (err) { res.status(500).json({ error: "Erro ao salvar." }); }
});

app.delete('/api/frases/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Frase.findOneAndDelete({
            $or: [
                { _id: mongoose.isValidObjectId(id) ? id : null },
                { id: isNaN(id) ? null : Number(id) }
            ]
        });
        res.json({ message: "Frase removida." });
    } catch (err) { res.status(500).json({ error: "Erro ao deletar." }); }
});

app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n\x1b[32m🚀 SERVER ONLINE | PORTA: ${PORT}\x1b[0m\n`);
});