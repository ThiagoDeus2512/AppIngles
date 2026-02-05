const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const BACKUP_FILE = path.join(__dirname, 'data_backup.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- INICIALIZADOR DE SEGURANÇA ---
const initDB = () => {
    if (!fs.existsSync(DATA_FILE)) {
        // Se não existir, cria com algumas frases iniciais para não vir vazio
        const initialData = [
            {
                en: "I have to go now",
                pt: "Eu tenho que ir agora",
                meta: { level: "BEGINNER", tense: "PRESENT", type: "AFFIRMATIVE", soundsLike: "ai häv-tuh gou nau" },
                id: 1,
                createdAt: new Date().toISOString()
            }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log("📂 Banco de dados data.json criado com sucesso.");
    }
};
initDB();

// --- ROTAS DA API ---

// 1. Buscar todas as frases
app.get('/api/frases', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const frases = JSON.parse(data);
        res.json(frases);
    } catch (err) {
        console.error("❌ Erro ao ler arquivo:", err);
        res.status(500).json({ error: "Erro ao ler as frases." });
    }
});

// 2. Salvar nova frase com Backup Automático
app.post('/api/frases', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const frases = JSON.parse(data);

        const novaFrase = {
            ...req.body,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };

        frases.push(novaFrase);

        // Salva o arquivo principal
        fs.writeFileSync(DATA_FILE, JSON.stringify(frases, null, 2));

        // Cria um backup de segurança
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(frases, null, 2));

        console.log(`\n✨ NOVA FRASE CADASTRADA ✨`);
        console.log(`🇺🇸 EN: ${novaFrase.en}`);
        console.log(`🇧🇷 PT: ${novaFrase.pt}`);
        console.log(`📊 Total no Banco: ${frases.length}`);

        res.status(201).json(novaFrase);
    } catch (err) {
        console.error("❌ Erro ao salvar:", err);
        res.status(500).json({ error: "Erro ao salvar a frase." });
    }
});

// 3. Rota de Stats (Aprimorada para refletir a estrutura do App)
app.get('/api/stats', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const stats = {
            total: data.length,
            beginner: data.filter(f => f.meta.level === 'BEGINNER').length,
            intermediate: data.filter(f => f.meta.level === 'INTERMEDIATE').length,
            advanced: data.filter(f => f.meta.level === 'ADVANCED').length,
            paretoCount: data.filter(f => {
                const words = f.en.toLowerCase().split(' ');
                return words.some(w => ['get', 'have', 'do', 'make', 'go', 'can', 'will'].includes(w));
            }).length
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Erro ao calcular estatísticas." });
    }
});

// Inicialização
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`🚀 LIFE ENGLISH ULTRA - PARETO ENGINE ACTIVE`);
    console.log(`📡 API: http://localhost:${PORT}/api/frases`);
    console.log(`🌐 APP: http://localhost:${PORT}/index.html`);
    console.log(`📂 DATA: ${DATA_FILE}`);
    console.log(`================================================\n`);
    console.log(`💡 Dica: Mantenha este terminal aberto para salvar suas frases.`);
});