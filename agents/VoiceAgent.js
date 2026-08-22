const sdk = require("microsoft-cognitiveservices-speech-sdk");
const BaseAgent = require('./BaseAgent');

class VoiceAgent extends BaseAgent {
    constructor() {
        super();
        this.speechKey = process.env.SPEECH_KEY;
        this.speechRegion = process.env.SPEECH_REGION;
        this.speechVoice = process.env.SPEECH_VOICE;
    }

    async process({ text, outputFile }) {
        return new Promise((resolve, reject) => {
            try {
                const speechConfig = sdk.SpeechConfig.fromSubscription(this.speechKey, this.speechRegion);
                const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFile);
                
                if (this.speechVoice) {
                    speechConfig.speechSynthesisVoiceName = this.speechVoice;
                }
                
                const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
                
                synthesizer.speakTextAsync(text,
                    function (result) {
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            console.log(`VoiceAgent: Audio generated for ${outputFile}`);
                            synthesizer.close();
                            resolve(result);
                        } else {
                            console.error("VoiceAgent: Canceled, " + result.errorDetails);
                            synthesizer.close();
                            reject(new Error(result.errorDetails));
                        }
                    },
                    function (err) {
                        console.error("VoiceAgent: Error - " + err);
                        synthesizer.close();
                        reject(err);
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = VoiceAgent;
