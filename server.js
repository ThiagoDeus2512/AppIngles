const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Adicionado: Google AI

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Gemini - Adicionado verificação de segurança
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "SEM_CHAVE");

// Configuração de armazenamento temporário para o áudio da IA
const upload = multer({ storage: multer.memoryStorage() });

// --- CONFIGURAÇÃO DO MONGODB ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://Admin:Familia2512@aula.o5oekbk.mongodb.net/?appName=Aula";

mongoose.connect(MONGO_URI)
    .then(() => console.log("\n\x1b[32m🍃 Conectado ao MongoDB Atlas com sucesso!\x1b[0m"))
    .catch(err => {
        console.error("❌ Erro fatal na conexão ao MongoDB:");
        console.error(err);
    });

// --- ESQUEMA DE DADOS (MODELO) ---
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

// --- MIDDLEWARE ---
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// --- ROTAS DA API ---

/**
 * ROTA ATUALIZADA: IA Voice Analysis com GEMINI 1.5 FLASH
 * Adicionado suporte robusto a múltiplos formatos de áudio (WebM/Ogg/Opus)
 */
app.post('/api/analyze-voice', upload.single('audio'), async (req, res) => {
    try {
        const { expectedText } = req.body;
        const audioFile = req.file;

        if (!audioFile) return res.status(400).json({ error: "Áudio não recebido pelo servidor." });
        if (!process.env.GEMINI_API_KEY) {
            console.error("⚠️ ERRO: GEMINI_API_KEY ausente.");
            return res.status(500).json({ error: "Configuração de IA pendente." });
        }

        console.log(`\n\x1b[35m[GEMINI AI ENGINE]\x1b[0m Analisando: "${expectedText}"`);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // NORMALIZAÇÃO DE MIME TYPE: 
        // Navegadores às vezes enviam application/octet-stream. O Gemini precisa saber que é áudio.
        let detectedMime = audioFile.mimetype;
        if (detectedMime === 'application/octet-stream' || !detectedMime) {
            detectedMime = 'audio/webm';
        }

        const part = {
            inlineData: {
                data: audioFile.buffer.toString("base64"),
                mimeType: detectedMime
            }
        };

        const prompt = `Você é um professor nativo de inglês. Analise a pronúncia do usuário.
        Frase esperada: "${expectedText}".
        Compare o áudio e responda em Português:
        1. Feedback da precisão (curto e amigável).
        2. Liste palavras específicas que precisam de correção se houver.
        3. Termine com uma nota de 0 a 100 no formato: "Nota: X/100".`;

        const result = await model.generateContent([prompt, part]);
        const response = await result.response;
        const feedbackText = response.text();

        res.json({
            status: "success",
            feedback: feedbackText
        });

    } catch (err) {
        console.error("❌ Erro na análise do Gemini:", err.message);
        res.status(500).json({
            error: "Falha na análise da IA.",
            details: err.message
        });
    }
});

app.get('/api/frases', async (req, res) => {
    try {
        const frases = await Frase.find().sort({ createdAt: -1 });
        res.json(frases);
    } catch (err) {
        console.error("Erro GET /api/frases:", err);
        res.status(500).json({ error: "Erro ao buscar frases no banco." });
    }
});

app.post('/api/frases', async (req, res) => {
    try {
        const { en, pt, meta } = req.body;
        if (!en || !pt || !meta) return res.status(400).json({ error: "Dados incompletos." });

        const novaFrase = new Frase({ en: en.trim(), pt: pt.trim(), meta });
        await novaFrase.save();

        const isPareto = /get|have|take|do|make|go|can|will|want|need/i.test(novaFrase.en);
        console.log(`\n\x1b[36m[NOVA FRASE NO MONGODB]\x1b[0m`);
        console.log(`Level: ${meta.level} | Pareto: ${isPareto ? '🔥 SIM' : 'NÃO'}`);
        res.status(201).json(novaFrase);
    } catch (err) {
        console.error("Erro POST /api/frases:", err);
        res.status(500).json({ error: "Erro ao salvar no MongoDB." });
    }
});

app.delete('/api/frases/:id', async (req, res) => {
    try {
        const result = await Frase.findByIdAndDelete(req.params.id) ||
            await Frase.deleteOne({ id: req.params.id });

        if (result.deletedCount === 0 && !result._id) {
            return res.status(404).json({ error: "Frase não encontrada." });
        }

        console.log(`\n\x1b[31m[FRASE REMOVIDA]\x1b[0m ID: ${req.params.id}`);
        res.json({ message: "Frase removida com sucesso." });
    } catch (err) {
        console.error("Erro DELETE /api/frases:", err);
        res.status(500).json({ error: "Erro ao deletar do banco." });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const data = await Frase.find();
        const stats = {
            total: data.length,
            levels: {
                beginner: data.filter(f => f.meta.level === 'BEGINNER').length,
                intermediate: data.filter(f => f.meta.level === 'INTERMEDIATE').length,
                advanced: data.filter(f => f.meta.level === 'ADVANCED').length,
            },
            paretoCount: data.filter(f => /get|have|take|do|make|go|can|will/i.test(f.en)).length
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Erro ao compilar analytics." });
    }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n\x1b[32m================================================`);
    console.log(`🚀 LIFE ENGLISH ULTRA ENGINE ONLINE (CLOUD MODE)`);
    console.log(`📡 PORTA: ${PORT}`);
    console.log(`🧠 GEMINI AI INTEGRATED: Ready for Speech Analysis`);
    console.log(`================================================\x1b[0m\n`);
});