const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS corrigée
const allowedOrigins = [
    'https://caleb-irri.webflow.io',
    'https://www.calebirri.com',  // Ajoutez votre domaine futur
];

app.use(cors({
    origin: function(origin, callback) {
        // Permettre les requêtes sans origine (comme les appels API directs)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Origine bloquée par CORS:', origin);
            callback(null, true); // Temporaire: autorise toutes les origines pour tester
            // callback(new Error('CORS non autorisé'));
        }
    },
    credentials: true,  // Important pour les cookies/sessions
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
}));

app.use(express.json());

// Dossier pour les données
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

// Middleware pour logger les requêtes (debug)
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

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
            engagements: [],
            createdAt: new Date().toISOString()
        };
        
        jscs.push(newJSC);
        await fs.writeFile(JSCS_FILE, JSON.stringify(jscs, null, 2));
        res.status(201).json(newJSC);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/engage', async (req, res) => {
    try {
        const { jscId, seuil } = req.body;
        
        const jscs = JSON.parse(await fs.readFile(JSCS_FILE, 'utf8'));
        const jscIndex = jscs.findIndex(j => j.id === jscId);
        
        if (jscIndex === -1) {
            return res.status(404).json({ error: 'JSC non trouvé' });
        }
        
        if (!jscs[jscIndex].engagements) {
            jscs[jscIndex].engagements = [];
        }
        
        jscs[jscIndex].engagements.push({
            id: crypto.randomBytes(16).toString('hex'),
            seuil,
            timestamp: new Date().toISOString(),
            ip: req.ip
        });
        
        await fs.writeFile(JSCS_FILE, JSON.stringify(jscs, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { pseudo, email, password } = req.body;
        const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
        
        if (users.find(u => u.pseudo === pseudo)) {
            return res.status(400).json({ error: 'Pseudo déjà utilisé' });
        }
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }
        
        // Version simplifiée sans email pour tester
        const hashedPassword = await bcrypt.hash(password, 10);
        
        users.push({
            id: crypto.randomBytes(16).toString('hex'),
            pseudo,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        });
        
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        res.json({ message: 'Inscription réussie' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { pseudo, password } = req.body;
        const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
        
        const user = users.find(u => u.pseudo === pseudo);
        if (!user) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        
        res.json({ 
            success: true, 
            user: { pseudo: user.pseudo, email: user.email, id: user.id }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/check-auth', async (req, res) => {
    // Version simplifiée - à améliorer avec des tokens JWT
    res.json({ user: null });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'JenSuisClic API fonctionne !' });
});

// Route OPTIONS pour CORS preflight
app.options('*', cors());

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    initDataFiles();
});