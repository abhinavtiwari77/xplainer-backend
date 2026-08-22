const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const explainRoutes = require('./routes/explainRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // Fallback to allow all if not set, or specifically set for dev
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static audio files
app.use(express.static(path.join(__dirname, 'audio')));

// Explicit routes for serving generated files
app.get('/:chatId/merged/:filename', (req, res) => {
    const { chatId, filename } = req.params;
    const filePath = path.join(__dirname, 'audio', chatId, 'merged', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }
    
    res.sendFile(filePath);
});

app.get('/:chatId/json/:filename', (req, res) => {
    const { chatId, filename } = req.params;
    const filePath = path.join(__dirname, 'audio', chatId, 'json', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'JSON file not found' });
    }
    
    res.sendFile(filePath);
});

app.get('/:chatId/images/:filename', (req, res) => {
    const { chatId, filename } = req.params;
    const filePath = path.join(__dirname, 'audio', chatId, 'images', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Image file not found' });
    }
    
    res.sendFile(filePath);
});

// API Routes
app.use('/api', explainRoutes);

// Test Routes (for debugging deployment issues)
app.use('/test', testRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'ExplainerAI Backend is running' });
});

// Debug endpoint to check file structure
app.get('/debug/:chatId', (req, res) => {
    const { chatId } = req.params;
    const chatDir = path.join(__dirname, 'audio', chatId);
    
    const result = { chatId, exists: false, structure: {} };
    
    if (fs.existsSync(chatDir)) {
        result.exists = true;
        
        // Check each subdirectory
        const subdirs = ['merged', 'json', 'images', 'parts'];
        subdirs.forEach(subdir => {
            const subdirPath = path.join(chatDir, subdir);
            result.structure[subdir] = {
                exists: fs.existsSync(subdirPath),
                files: []
            };
            
            if (fs.existsSync(subdirPath)) {
                try {
                    result.structure[subdir].files = fs.readdirSync(subdirPath);
                } catch (err) {
                    result.structure[subdir].error = err.message;
                }
            }
        });
    }
    
    res.json(result);
});

module.exports = app;
