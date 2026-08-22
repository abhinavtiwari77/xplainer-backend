// Test file to verify Azure deployment and file serving
const express = require('express');
const fs = require('fs');
const path = require('path');

const testRoutes = express.Router();

// Test endpoint to create a sample file and verify it can be served
testRoutes.get('/create-test-file', async (req, res) => {
    try {
        const testChatId = 'test_' + Date.now();
        const audioDir = path.resolve('./audio', testChatId, 'merged');
        
        // Create directories
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        
        // Create a test file
        const testContent = 'This is a test file created at ' + new Date().toISOString();
        const testFilePath = path.join(audioDir, 'test.txt');
        fs.writeFileSync(testFilePath, testContent);
        
        // Verify file exists
        const exists = fs.existsSync(testFilePath);
        
        const baseUrl = process.env.BASE_URL || process.env.WEBSITE_HOSTNAME 
            ? `https://${process.env.WEBSITE_HOSTNAME}` 
            : 'http://localhost:3000';
        
        const publicUrl = `${baseUrl}/${testChatId}/merged/test.txt`;
        
        res.json({
            success: true,
            testChatId,
            filePath: testFilePath,
            fileExists: exists,
            publicUrl: publicUrl,
            message: 'Test file created. Try accessing: ' + publicUrl
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = testRoutes;