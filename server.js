const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DO MONGODB ---
// Prioriza a variável do Render (process.env.MONGO_URI) para funcionar no celular
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
// Configuração de CORS reforçada para aceitar conexões de celulares/browsers móveis
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// --- ROTAS DA API ---

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
        const result = await Frase.deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) return res.status(404).json({ error: "Frase não encontrada." });
        res.json({ message: "Frase removida com sucesso." });
    } catch (err) {
        res.status(500).json({ error: "Erro ao deletar." });
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

// --- CORREÇÃO FINAL PARA NODE V24 ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Escutando em 0.0.0.0 para garantir que o Render consiga rotear o tráfego externo (celular)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n\x1b[32m================================================`);
    console.log(`🚀 LIFE ENGLISH ULTRA ENGINE ONLINE (CLOUD MODE)`);
    console.log(`📡 PORTA: ${PORT}`);
    console.log(`================================================\x1b[0m\n`);
});