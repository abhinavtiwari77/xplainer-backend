const ImageAgent = require('./agents/ImageAgent');
const path = require('path');
const fs = require('fs');

async function testImageGeneration() {
    console.log("Starting Image Generation Test...");
    const agent = new ImageAgent();
    
    try {
        const prompt = "A cute cartoon robot explaining quantum physics on a blackboard";
        console.log(`Sending prompt: "${prompt}"`);
        
        const url = await agent.generateImage(prompt);
        
        if (url) {
            console.log("SUCCESS: Image URL received:", url);
            
            // Try downloading it to verify it's accessible
            console.log("Attempting to fetch image content...");
            const response = await fetch(url);
            if (response.ok) {
                console.log("SUCCESS: Image content fetched successfully.");
            } else {
                console.error("FAILURE: Could not fetch image content. Status:", response.status);
            }

        } else {
            console.error("FAILURE: No image URL returned.");
        }
    } catch (error) {
        console.error("CRITICAL ERROR:", error);
    }
}

testImageGeneration();
