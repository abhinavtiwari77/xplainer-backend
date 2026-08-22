const TextAgent = require('../agents/TextAgent');
const VoiceAgent = require('../agents/VoiceAgent');
const ImageAgent = require('../agents/ImageAgent');
const AudioProcessor = require('../services/AudioProcessor');
const path = require('path');
const fs = require('fs');

const logToFile = (msg) => {
    const logPath = path.resolve(__dirname, '../debug_temp.txt');
    fs.appendFileSync(logPath, new Date().toISOString() + ': ' + msg + '\n');
};

const textAgent = new TextAgent();
const voiceAgent = new VoiceAgent();
const imageAgent = new ImageAgent();

exports.explain = async (req, res) => {
    const { prompt, chatID } = req.body;

    if (!prompt || !chatID) {
        return res.status(400).json({ error: 'Missing "prompt" or "chatID" in request body' });
    }

    // Set headers for NDJSON streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
        res.write(JSON.stringify(data) + '\n');
    };

    try {
        // 1. Get Explanation Steps from TextAgent
        console.log(`[${chatID}] Generating explanation text...`);
        sendEvent({ type: 'progress', message: 'Generating explanation text...', progress: 10 });

        logToFile(`[${chatID}] Generating explanation...`);
        const explanationData = await textAgent.process(prompt);

        let steps = explanationData.steps || explanationData;
        if (!Array.isArray(steps)) {
            // Handle edge case where it might not be an array
            console.warn("Unexpected explanation format:", explanationData);
            logToFile("Unexpected explanation format: " + JSON.stringify(explanationData));
            steps = [];
        }

        console.log(`[${chatID}] Explanation generated with ${steps.length} steps.`);
        logToFile(`[${chatID}] Explanation generated with ${steps.length} steps.`);

        // DEBUG: Log first step to see if imagePrompt exists
        if (steps.length > 0) {
            logToFile("DEBUG: First step content: " + JSON.stringify(steps[0]));
            const stepsWithImages = steps.filter(s => s.imagePrompt).length;
            logToFile(`DEBUG: ${stepsWithImages}/${steps.length} steps have 'imagePrompt'.`);
        } else {
            logToFile("DEBUG: No steps generated!");
        }

        // 2. Prepare Directories
        const { audioDir } = AudioProcessor.prepareSession(chatID);

        // 3. Generate Audio & Images for each step SEQUENTIALLY to avoid Rate Limits
        logToFile(`[${chatID}] Generating audio and images sequentially...`);
        console.log(`[${chatID}] Starting media generation for ${steps.length} steps...`);
        sendEvent({ type: 'progress', message: 'Starting media generation...', progress: 20 });

        const processingResults = [];

        for (let index = 0; index < steps.length; index++) {
            const step = steps[index];
            const outputFile = path.resolve(audioDir, `${index}.wav`);
            const progressMsg = `Processing step ${index + 1}/${steps.length}`;

            logToFile(`[${chatID}] ${progressMsg}`);
            console.log(`[${chatID}] ${progressMsg}`);

            // Calculate progress percentage (20% to 90%)
            const currentProgress = 20 + Math.round(((index) / steps.length) * 70);
            sendEvent({ type: 'progress', message: progressMsg, step: index + 1, total: steps.length, progress: currentProgress });

            try {
                // Generate Voice
                console.log(`[${chatID}] Generating audio for step ${index + 1}...`);
                await voiceAgent.process({ text: step.speak, outputFile });

                // Generate Image (if needed)
                let imageUrl = null;
                if (step.imagePrompt) {
                    try {
                        console.log(`[${chatID}] Generating image for step ${index + 1}...`);
                        sendEvent({ type: 'progress', message: `Generating image for slide ${index + 1}...`, progress: currentProgress }); // Update specialized message

                        logToFile(`[${chatID}] Generating image for step ${index}...`);
                        const tempUrl = await imageAgent.generateImage(step.imagePrompt);

                        if (tempUrl) {
                            const filename = `img_${index}.png`;
                            imageUrl = await AudioProcessor.saveImage(tempUrl, chatID, filename);
                            logToFile(`[${chatID}] Image saved: ${imageUrl}`);
                        } else {
                            logToFile(`[${chatID}] No image URL returned for step ${index}`);
                        }
                    } catch (imgErr) {
                        logToFile(`[${chatID}] Error generating image for step ${index}: ${imgErr.message}`);
                    }
                }

                let finalContent = step.writeOnWhiteBoard;
                if (imageUrl) {
                    finalContent += `\n\n![Generated Image](${imageUrl})`;
                }

                processingResults.push({
                    index,
                    success: true,
                    filePath: outputFile,
                    content: finalContent
                });

            } catch (error) {
                logToFile(`[${chatID}] Error processing step ${index}: ${error.message}`);
                processingResults.push({ index, success: false, error });
            }
        }

        /* 
        // OLD PARALLEL LOGIC REMOVED
        const processingPromises = steps.map(async (step, index) => {
            const outputFile = path.resolve(audioDir, `${index}.wav`);
            
            // Parallelize voice and image generation for this step
            const voicePromise = voiceAgent.process({ text: step.speak, outputFile });
            
            let imagePromise = Promise.resolve(null);
            if (step.imagePrompt) {
                imagePromise = imageAgent.generateImage(step.imagePrompt)
                    .then(async (url) => {
                        if (url) {
                            const filename = `img_${index}.png`;
                            return await AudioProcessor.saveImage(url, chatID, filename);
                        }
                        return null;
                    })
                    .catch(err => {
                        console.error(`Error generating image for step ${index}:`, err);
                        return null;
                    });
            }

            try {
                const [voiceResult, imageUrl] = await Promise.all([voicePromise, imagePromise]);
                
                let finalContent = step.writeOnWhiteBoard;
                if (imageUrl) {
                    finalContent += `\n\n![Generated Image](${imageUrl})`;
                }

                return { 
                    index, 
                    success: true, 
                    filePath: outputFile, 
                    content: finalContent
                };
            } catch (error) {
                console.error(`Error processing step ${index}:`, error);
                return { index, success: false, error };
            }
        });

        const results = await Promise.allSettled(processingPromises);
        */
        const results = processingResults.map(r => ({ status: 'fulfilled', value: r })); // Mock Promise.allSettled structure for compatibility

        // 4. Process Results & Calculate Durations
        const successfulFiles = [];
        const finalJsonData = [];

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                const { index, filePath, content } = result.value;
                const duration = await AudioProcessor.getDuration(filePath);

                successfulFiles.push({ index, filePath });
                finalJsonData.push({
                    index, // temporary for sorting
                    time: duration,
                    content: content
                });
            }
        }

        // Sort to ensure order matches original steps
        successfulFiles.sort((a, b) => a.index - b.index);
        finalJsonData.sort((a, b) => a.index - b.index);

        // Remove index from final JSON
        const cleanedJsonData = finalJsonData.map(({ time, content }) => ({ time, content }));

        // 5. Save JSON
        await AudioProcessor.saveJson(chatID, cleanedJsonData);

        // 6. Merge Audio Files
        if (successfulFiles.length > 0) {
            await AudioProcessor.mergeFiles(successfulFiles, chatID);
        } else {
            console.warn(`[${chatID}] No audio files generated successfully.`);
        }

        // 7. Send Response
        console.log(`[${chatID}] Process complete.`);
        sendEvent({ type: 'complete', success: true, message: "Explanation generation completed.", progress: 100 });
        res.end();

    } catch (error) {
        console.error("Controller Error:", error);
        logToFile("Controller Error: " + error.stack);
        // If headers sent, we write error event, else json
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error processing explanation.' });
        } else {
            sendEvent({ type: 'error', message: 'Internal server error processing explanation.' });
            res.end();
        }
    }
};
