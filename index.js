const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { AzureOpenAI } = require("openai");
const mm = require('music-metadata');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("ffmpeg-static")
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const dotenv = require('dotenv');
dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath)

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const port = 3000;
const client = new AzureOpenAI({
  endpoint: process.env.OPENAI_ENDPOINT,
  apiKey: process.env.OPENAI_APIKEY,
  apiVersion: "2024-12-01-preview",
  deployment: "gpt-5-mini",
});

app.use(express.static(path.join(__dirname, 'audio')));


app.use(express.json());

let SPEECH_KEY = process.env.SPEECH_KEY;
let SPEECH_REGION = process.env.SPEECH_REGION;

// Helper function to generate audio using Azure TTS

function generateAzureAudio(text, outputFile) {
    return new Promise((resolve, reject) => {
        try {
            // Configure Azure Speech Service
            const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
            const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFile);
            
            // Set voice (you can change this to any Azure voice)
            speechConfig.speechSynthesisVoiceName = process.env.SPEECH_VOICE;
            
            // Create the speech synthesizer
            const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
            
            // Start synthesis
            synthesizer.speakTextAsync(text,
                function (result) {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        console.log(`Azure TTS synthesis completed for: ${outputFile}`);
                        synthesizer.close();
                        resolve(result);
                    } else {
                        console.error("Speech synthesis canceled, " + result.errorDetails);
                        synthesizer.close();
                        reject(new Error(result.errorDetails));
                    }
                },
                function (err) {
                    console.error("Azure TTS error: " + err);
                    synthesizer.close();
                    reject(err);
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

async function generateAudioResponseParallel(jsonString, chatID) {
    // let data = JSON.parse(jsonString);

    let data;
    try {
        let parsedData = JSON.parse(jsonString);
        if (parsedData && parsedData.hasOwnProperty('steps')) {
            data = parsedData.steps;
        } else {
            data = parsedData;
        }
    } catch (error) {
        console.error('Invalid JSON string:', error);
        throw new Error('Invalid JSON format. Please provide a valid JSON string.');
    }

    console.log("Starting Azure TTS audio generation for", data.length, "items...");
 
    
    // Create audio files directory if it doesn't exist
    const audioDir = path.resolve(`./audio/${chatID}/parts`);
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    } else {
        fs.rmdirSync(audioDir, { recursive: true }); 
        fs.mkdirSync(audioDir, { recursive: true });
    }

    console.log(data)
    
    // Create promises for all audio generations
    const audioPromises = data.map(async (item, index) => {
        try {
            const speechText = item.speak;
            const speechFile = path.resolve(audioDir, `${index}.wav`);
            
            console.log(`Generating Azure TTS audio for index ${index}...`);
            
            // Use Azure TTS instead of Groq
            await generateAzureAudio(speechText, speechFile);
            
            console.log(`Speech file ${index}.wav saved successfully.`);
            return { index, success: true, filePath: speechFile, content: item.writeOnWhiteBoard };
            
        } catch (error) {
            console.error(`Error generating speech file for index ${index}:`, error);
            return { index, success: false, error };
        }
    });
    
    // Wait for all audio files to be generated
    const results = await Promise.allSettled(audioPromises);
    console.log("Azure TTS audio generation completed:", results);
    
    // Calculate durations and prepare JSON data
    const jsonData = [];
    const successfulFiles = [];
    
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
            try {
                const { index, filePath, content } = result.value;
                
                // Get audio duration using music-metadata
                const metadata = await mm.parseFile(filePath);
                const durationMs = Math.round(metadata.format.duration * 1000);
                
                jsonData.push({
                    index,
                    time: durationMs,
                    content: content,
                    filePath: filePath
                });
                
                successfulFiles.push({ index, filePath });
                
                console.log(`Duration for clip ${index}: ${durationMs}ms`);
                
            } catch (error) {
                console.error(`Error getting duration for clip ${result.value.index}:`, error);
            }
        }
    }
    
    // Sort jsonData by original index to maintain order
    jsonData.sort((a, b) => a.index - b.index);
    successfulFiles.sort((a, b) => a.index - b.index);
    
    // Create JSON directory if it doesn't exist
    const jsonDir = path.resolve(`./audio/${chatID}/json`);
    if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    // Prepare final JSON data (without index and filePath)
    const finalJsonData = jsonData.map(({ time, content }) => ({ time, content }));
    
    // Save JSON data to file
    const jsonFilePath = path.resolve(jsonDir, 'j1.json');
    await fs.promises.writeFile(jsonFilePath, JSON.stringify(finalJsonData, null, 2));
    
    console.log(`JSON data saved to ${jsonFilePath}`);
    console.log("Generated JSON:", JSON.stringify(finalJsonData, null, 2));
    
    // Merge audio files if there are successful files
    if (successfulFiles.length > 0) {
        await mergeAudioFiles(successfulFiles, chatID);
    } else {
        console.log("No audio files to merge.");
    }

    return {success: true, message: "Audio generation and merging completed successfully."};
}

async function mergeAudioFiles(successfulFiles, chatID) {
    return new Promise((resolve, reject) => {
        try {
            // Create merged directory if it doesn't exist
            const mergedDir = path.resolve(`./audio/${chatID}/merged`);
            if (!fs.existsSync(mergedDir)) {
                fs.mkdirSync(mergedDir, { recursive: true });
            }
            
            const outputPath = path.resolve(mergedDir, 'output.wav');
            
            console.log("Starting audio merge process...");
            console.log("Files to merge:", successfulFiles.map(f => f.filePath));
            
            // Method 1: Using concat filter (more reliable)
            const inputs = successfulFiles.map(file => `[${file.index}:0]`).join('');
            const filterComplex = `${inputs}concat=n=${successfulFiles.length}:v=0:a=1[out]`;
            
            let command = ffmpeg();
            
            // Add all input files
            successfulFiles.forEach(file => {
                command = command.input(file.filePath);
            });
            
            command
                .complexFilter(filterComplex)
                .outputOptions('-map', '[out]')
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log('FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    console.log('Processing: ' + progress.percent + '% done');
                })
                .on('end', () => {
                    console.log('Audio merge complete!');
                    console.log(`Merged audio saved to: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('Error during audio merge:', err.message);
                    
                    // Fallback to simpler method
                    console.log('Trying fallback method...');
                    mergeAudioFilesFallback(successfulFiles, chatID)
                        .then(resolve)
                        .catch(reject);
                })
                .run();
                
        } catch (error) {
            console.error('Error setting up audio merge:', error);
            reject(error);
        }
    });
}

// Fallback method using file concatenation
async function mergeAudioFilesFallback(successfulFiles, chatID) {
    return new Promise((resolve, reject) => {
        try {
            const mergedDir = path.resolve(`./audio/${chatID}/merged`);
            if (!fs.existsSync(mergedDir)) {
                fs.mkdirSync(mergedDir, { recursive: true });
            }
            
            const outputPath = path.resolve(mergedDir, 'output.wav');
            const listFile = path.resolve(mergedDir, 'filelist.txt');
            
            // Generate file list content with absolute paths
            const fileContent = successfulFiles.map(file => {
                const absolutePath = path.resolve(file.filePath);
                return `file '${absolutePath.replace(/\\/g, '/')}'`;
            }).join('\n');
            
            fs.writeFileSync(listFile, fileContent);
            console.log('Created filelist.txt:', fileContent);
            
            ffmpeg()
                .input(listFile)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(['-c', 'copy'])
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log('FFmpeg fallback command:', commandLine);
                })
                .on('progress', (progress) => {
                    console.log('Processing: ' + progress.percent + '% done');
                })
                .on('end', () => {
                    console.log('Audio merge complete (fallback method)!');
                    console.log(`Merged audio saved to: ${outputPath}`);
                    
                    // Cleanup filelist
                    try {
                        fs.unlinkSync(listFile);
                    } catch (cleanupError) {
                        console.warn('Warning: Could not cleanup filelist:', cleanupError.message);
                    }
                    
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('Error during fallback audio merge:', err.message);
                    
                    // Cleanup filelist on error
                    try {
                        fs.unlinkSync(listFile);
                    } catch (cleanupError) {
                        console.warn('Warning: Could not cleanup filelist:', cleanupError.message);
                    }
                    
                    reject(err);
                })
                .run();
                
        } catch (error) {
            console.error('Error setting up fallback audio merge:', error);
            reject(error);
        }
    });
}


const explainRoutes = require('./routes/explainRoutes');
app.use('/api', explainRoutes);

// app.post('/api/explain', ... ) - OLD LOGIC REMOVED

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
