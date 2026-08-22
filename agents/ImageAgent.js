const { AzureOpenAI } = require("openai");
const BaseAgent = require('./BaseAgent');
const fs = require('fs');
const path = require('path');

const theme = "light"

const logToFile = (msg) => {
    try {
        const logPath = path.resolve(__dirname, '../debug_temp.txt');
        fs.appendFileSync(logPath, new Date().toISOString() + ': ' + msg + '\n');
    } catch (e) { }
};

class ImageAgent extends BaseAgent {
    constructor() {
        super();
        this.client = new AzureOpenAI({
            endpoint: "https://ayush-mkc5tt9q-swedencentral.cognitiveservices.azure.com/",
            apiKey: "D8r4e8kQUiBC4M1AvnZ8kMcAEGCCxtclOkQOpHtn1UDTFijZjiWbJQQJ99CAACfhMk5XJ3w3AAAAACOGgKY5", // Placeholder as per user instruction, ideally from env
            apiVersion: "2025-04-01-preview",
            deployment: "FLUX-1.1-pro",
        });
    }

    async generateImage(imagePrompt) {
        try {
            let finalPrompt = imagePrompt;

            // Handle structured JSON prompt
            if (typeof imagePrompt === 'object' && imagePrompt !== null) {
                const { prompt, artStylePreset, artStylePrompt, stylePrompt } = imagePrompt;

                // Construct a rich prompt string for the model
                // FLUX/DALL-E models benefit from explicitly combined descriptions
                finalPrompt = `${prompt}. \n\nStyle: ${artStylePreset}. ${artStylePrompt}. \n\nVibe: ${stylePrompt}. \n\n(Important: Ensure the image looks good on a ${theme} background. Minimal text.)`;

                logToFile(`[ImageAgent] Processed Structured Prompt: "${finalPrompt}"`);
            } else {
                logToFile(`[ImageAgent] Received String Prompt: "${imagePrompt}"`);
            }

            console.log(`[ImageAgent] Generating image for: "${finalPrompt}"`);

            const results = await this.client.images.generate({
                prompt: finalPrompt,
                model: "dall-e-3", // Deployment name might be needed here or in client config depending on SDK version
                n: 1,
                size: "1024x1024"
            });

            logToFile("[ImageAgent] Generation call returned.");
            logToFile("[ImageAgent] Full Response: " + JSON.stringify(results, null, 2));

            if (results.data && results.data[0]) {
                if (results.data[0].url) {
                    logToFile("[ImageAgent] URL received: " + results.data[0].url);
                    return results.data[0].url;
                } else if (results.data[0].b64_json) {
                    logToFile("[ImageAgent] Received b64_json.");
                    // For now, return the b64 string directly - the controller might need to handle saving it
                    // Or better, serve it as a data URI if it's small, but these are large.
                    // Let's assume we return a data URI for now, or save it locally.
                    // Given the existing AudioProcessor saves URLs, let's keep it simple:
                    // We will return a special object or just the data URI.
                    // Actually, let's return it as a data URI string.
                    return `data:image/jpeg;base64,${results.data[0].b64_json}`;
                }
            }

            logToFile("[ImageAgent] No image URL or b64 data in response");
            throw new Error("No image URL in response");
        } catch (error) {
            logToFile("[ImageAgent] Critical Error: " + error.message);
            console.error("ImageAgent Error:", error);
            // Return null or throw? Let's return null to allow partial success
            return null;
        }
    }
}

module.exports = ImageAgent;
