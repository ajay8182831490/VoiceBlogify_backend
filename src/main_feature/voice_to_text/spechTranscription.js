import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
import { logError } from "../../utils/logger.js";
import { config } from "dotenv";
config();
// import fs from 'fs/promises';

// import sdk from "microsoft-cognitiveservices-speech-sdk";
// const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azurekey, 'eastus');
/*const transcribeAudioAPI = async (filePath, userSelectedLanguage) => {
    try {
        // Check if the file exists
        await fs.access(filePath);
        console.log(filePath)


        // Log the file path and check its existence
        console.log(`File exists: ${filePath}`);

        // Check if the file is readable
        const stats = await fs.stat(filePath);
        console.log(`File size: ${stats.size} bytes`);

        const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azurekey, 'eastus');
        speechConfig.speechRecognitionLanguage = userSelectedLanguage;

        //const audioConfig = sdk.AudioConfig.fromWavFileInput(filePath);
        let audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFile(filePath));
        const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        return new Promise((resolve, reject) => {
            speechRecognizer.recognizeOnceAsync(result => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        console.log(`RECOGNIZED: Text=${result.text}`);
                        resolve(result.text);
                        break;
                    case sdk.ResultReason.NoMatch:
                        console.log("NOMATCH: Speech could not be recognized.");
                        resolve(null);
                        break;
                    case sdk.ResultReason.Canceled:
                        const cancellation = sdk.CancellationDetails.fromResult(result);
                        console.log(`CANCELED: Reason=${cancellation.reason}`);
                        if (cancellation.reason == sdk.CancellationReason.Error) {
                            console.log(`CANCELED: ErrorCode=${cancellation.errorCode}`);
                            console.log(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
                        }
                        resolve(null);
                        break;
                }
                speechRecognizer.close();
            });
        });
    } catch (error) {
        console.error(`Error in transcribing audio: ${error.message}`);
        return null; // Handle the error as needed
    }
};
export default transcribeAudioAPI;*/


import fs from 'fs/promises';
import sdk from "microsoft-cognitiveservices-speech-sdk";

const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azureKey, 'eastus');

export async function fromFile(audioFilePath) {
    let speechRecognizer;
    let fullTranscription = '';

    try {
        const audioData = await fs.readFile(audioFilePath);
        const audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
        speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        return new Promise((resolve, reject) => {
            // Event handler for recognized speech
            speechRecognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    fullTranscription += e.result.text + ' ';
                }
            };

            // Event handler for canceled recognition
            speechRecognizer.canceled = (s, e) => {
                console.error('Recognition canceled:', e.errorDetails);
                stopAndCleanup();
                reject(new Error(`Recognition canceled: ${e.errorDetails}`));
            };

            // Event handler for when the session stops
            speechRecognizer.sessionStopped = (s, e) => {
                console.log('Session stopped. Full Transcription:', fullTranscription.trim());
                stopAndCleanup();
                resolve(fullTranscription.trim());
            };

            // Helper function to stop recognition and cleanup
            const stopAndCleanup = () => {
                if (speechRecognizer) {
                    speechRecognizer.stopContinuousRecognitionAsync(
                        () => {
                            speechRecognizer.close();
                            speechRecognizer = null;
                        },
                        (err) => {
                            console.error('Error stopping recognition:', err);
                            speechRecognizer.close();
                            speechRecognizer = null;
                        }
                    );
                }
            };

            // Set a timeout to force stop if recognition takes too long
            const timeout = setTimeout(() => {
                console.log('Recognition timeout - forcing stop');
                stopAndCleanup();
                resolve(fullTranscription.trim());
            }, 3000000); // 30 second timeout

            // Start the recognition process
            speechRecognizer.startContinuousRecognitionAsync(
                () => {
                    console.log("Recognition started successfully for:", audioFilePath);
                },
                (error) => {
                    console.error("Error starting recognition:", error);
                    clearTimeout(timeout);
                    stopAndCleanup();
                    reject(error);
                }
            );
        });

    } catch (error) {
        console.error('Error during transcription setup:', error);
        if (speechRecognizer) {
            speechRecognizer.close();
        }
        throw error;
    }
}







