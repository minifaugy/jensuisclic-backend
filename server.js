const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Dossier pour les données (Render utilise un système de fichiers temporaire)
const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JSCS_FILE = path.join(DATA_DIR, 'jscs.json');

// Initialisation des fichiers
async function initDataFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        if (!await fileExists(USERS_FILE)) {
            await fs.writeFile(USERS_FILE, JSON.stringify([]));
        }
        if (!await fileExists(JSCS_FILE)) {
            await fs.writeFile(JSCS_FILE, JSON.stringify([]));
        }
    } catch (error) {
        console.error('Erreur initialisation:', error);
    }
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Routes API
app.get('/api/jscs', async (req, res) => {
    try {
        const jscs = JSON.parse(await fs.readFile(JSCS_FILE, 'utf8'));
        res.json(jscs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/jscs', async (req, res) => {
    try {
        const { title, date, description, location, seuils, creator } = req.body;
        const jscs = JSON.parse(await fs.readFile(JSCS_FILE, 'utf8'));
        
        const newJSC = {
            id: crypto.randomBytes(16).toString('hex'),
            title,
            date,
            description,
            location,
            seuils: seuils.sort((a,b) => a-b),
            creator,
            createdAt: new Date().toISOString()
        };
        
        jscs.push(newJSC);
        await fs.writeFile(JSCS_FILE, JSON.stringify(jscs, null, 2));
        res.status(201).json(newJSC);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route de test
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'JenSuisClic API fonctionne !' });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    initDataFiles();
});