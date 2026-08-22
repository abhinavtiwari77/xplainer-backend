const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("ffmpeg-static")

ffmpeg.setFfmpegPath(ffmpegPath)

class AudioProcessor {
    constructor() {
        this.baseDir = path.resolve('./audio');
    }

    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // Prepare directories for a chat session
    prepareSession(chatID) {
        const audioDir = path.resolve(this.baseDir, `${chatID}/parts`);

        // Clean up existing parts if any, or create new
        if (fs.existsSync(audioDir)) {
            try {
                fs.rmSync(audioDir, { recursive: true, force: true });
            } catch (e) {
                console.warn(`AudioProcessor: Could not remove existing directory ${audioDir}`, e);
            }
        }
        this.ensureDir(audioDir);

        const jsonDir = path.resolve(this.baseDir, `${chatID}/json`);
        this.ensureDir(jsonDir);

        const mergedDir = path.resolve(this.baseDir, `${chatID}/merged`);
        this.ensureDir(mergedDir);

        return { audioDir, jsonDir, mergedDir };
    }

    async getDuration(filePath) {
        try {
            const metadata = await mm.parseFile(filePath);
            return Math.round(metadata.format.duration * 1000);
        } catch (error) {
            console.error(`AudioProcessor: Error getting duration for ${filePath}`, error);
            return 0;
        }
    }

    async saveJson(chatID, data) {
        try {
            const jsonDir = path.resolve(this.baseDir, `${chatID}/json`);
            this.ensureDir(jsonDir);
            const jsonFilePath = path.resolve(jsonDir, 'j1.json');
            await fs.promises.writeFile(jsonFilePath, JSON.stringify(data, null, 2));
            console.log(`AudioProcessor: JSON saved to ${jsonFilePath}`);
            
            // Verify file was created
            if (fs.existsSync(jsonFilePath)) {
                console.log(`AudioProcessor: JSON file verified at ${jsonFilePath}`);
            } else {
                console.error(`AudioProcessor: JSON file NOT found after save attempt at ${jsonFilePath}`);
            }
        } catch (error) {
            console.error(`AudioProcessor: Error saving JSON for ${chatID}:`, error);
            throw error;
        }
    }

    async saveImage(urlOrData, chatID, filename) {
        try {
            const imagesDir = path.resolve(this.baseDir, `${chatID}/images`);
            this.ensureDir(imagesDir);
            const filePath = path.resolve(imagesDir, filename);

            if (urlOrData.startsWith('data:image')) {
                // Handle Base64 Data URI
                const base64Data = urlOrData.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                await fs.promises.writeFile(filePath, buffer);
                console.log(`AudioProcessor: Base64 Image saved to ${filePath}`);
            } else {
                // Handle HTTP URL
                const response = await fetch(urlOrData);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                await fs.promises.writeFile(filePath, buffer);
                console.log(`AudioProcessor: Remote Image saved to ${filePath}`);
            }

            // Return public URL using environment variable or fallback
            const baseUrl = process.env.BASE_URL || process.env.WEBSITE_HOSTNAME 
                ? `https://${process.env.WEBSITE_HOSTNAME}` 
                : 'https://xplainerai-arabbabpbzhxemdr.eastasia-01.azurewebsites.net';
            
            return `${baseUrl}/${chatID}/images/${filename}`;
        } catch (error) {
            console.error("AudioProcessor: Error saving image:", error);
            return null;
        }
    }

    async mergeFiles(successfulFiles, chatID) {
        return new Promise((resolve, reject) => {
            const mergedDir = path.resolve(this.baseDir, `${chatID}/merged`);
            this.ensureDir(mergedDir);
            const outputPath = path.resolve(mergedDir, 'output.wav');

            console.log(`AudioProcessor: Starting merge for ${chatID}...`);
            console.log(`AudioProcessor: Output path: ${outputPath}`);

            // Sort files by index just in case
            successfulFiles.sort((a, b) => a.index - b.index);

            const filterComplex = successfulFiles.map((f, i) => `[${i}:0]`).join('') +
                `concat=n=${successfulFiles.length}:v=0:a=1[out]`;

            let command = ffmpeg();
            successfulFiles.forEach(file => {
                console.log(`AudioProcessor: Adding input file: ${file.filePath}`);
                command = command.input(file.filePath);
            });

            command
                .complexFilter(filterComplex)
                .outputOptions('-map', '[out]')
                .output(outputPath)
                .on('end', () => {
                    console.log(`AudioProcessor: Merge complete for ${chatID}`);
                    
                    // Verify file was created
                    if (fs.existsSync(outputPath)) {
                        console.log(`AudioProcessor: Merged audio file verified at ${outputPath}`);
                        resolve(outputPath);
                    } else {
                        console.error(`AudioProcessor: Merged audio file NOT found after merge at ${outputPath}`);
                        reject(new Error('Merged audio file not found after completion'));
                    }
                })
                .on('error', (err) => {
                    console.error(`AudioProcessor: Merge error for ${chatID}, trying fallback...`, err);
                    this.mergeFilesFallback(successfulFiles, outputPath)
                        .then(resolve)
                        .catch(reject);
                })
                .run();
        });
    }

    async mergeFilesFallback(successfulFiles, outputPath) {
        return new Promise((resolve, reject) => {
            try {
                const listFile = path.resolve(path.dirname(outputPath), 'filelist.txt');

                // Escape paths for ffmpeg concat demuxer
                const fileContent = successfulFiles.map(file => {
                    return `file '${file.filePath.replace(/\\/g, '/')}'`;
                }).join('\n');

                fs.writeFileSync(listFile, fileContent);

                ffmpeg()
                    .input(listFile)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions(['-c', 'copy'])
                    .output(outputPath)
                    .on('end', () => {
                        console.log('AudioProcessor: Fallback merge complete.');
                        try { fs.unlinkSync(listFile); } catch (e) { }
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        console.error('AudioProcessor: Fallback merge error:', err);
                        try { fs.unlinkSync(listFile); } catch (e) { }
                        reject(err);
                    })
                    .run();

            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = new AudioProcessor(); // Export singleton
