import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
import { logError } from "../../utils/logger.js";
import { config } from "dotenv";
config();
// import fs from 'fs/promises';

// import sdk from "microsoft-cognitiveservices-speech-sdk";
// const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azurekey, 'eastus');
const transcribeAudioAPI = async (filePath, userSelectedLanguage) => {
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
export default transcribeAudioAPI;


import fs from 'fs/promises';
import sdk from "microsoft-cognitiveservices-speech-sdk";

const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azurekey, 'eastus');

export async function fromFile(audioFilePath) {
    let speechRecognizer;
    let fullTranscription = '';

    console.log("Inside the transcription");

    return new Promise(async (resolve, reject) => {
        try {
            const audioData = await fs.readFile(audioFilePath);
            const audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
            speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            // Event handler for recognized speech
            speechRecognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    console.log(e.result.text);
                    fullTranscription += e.result.text + ' '; // Append recognized text
                }
            };

            // Event handler for canceled recognition
            speechRecognizer.canceled = (s, e) => {
                console.error('Recognition canceled:', e.result.reason);
                speechRecognizer.close();
                reject(new Error('Recognition canceled: ' + e.result.reason));
            };

            // Event handler for when the session stops
            speechRecognizer.sessionStopped = (s, e) => {
                console.log('Session stopped. Full Transcription:', fullTranscription.trim());
                // Close the recognizer and resolve the promise
                speechRecognizer.close();
                resolve(fullTranscription.trim()); // Resolve with full transcription
            };

            // Start the recognition process asynchronously
            speechRecognizer.startContinuousRecognitionAsync(
                () => {
                    console.log("Recognition started successfully.");
                },
                (error) => {
                    console.error("Error starting recognition:", error);
                    speechRecognizer.close();
                    reject(error);
                }
            );

        } catch (error) {
            console.error('Error during transcription:', error);
            reject(error); // Reject if there is an error during setup
        } finally {
            // Wait for the transcription to complete before deleting the file
            try {
                await fs.access(audioFilePath);
                await fs.unlink(audioFilePath);
                console.log(`Deleted audio file: ${audioFilePath}`);
            } catch (unlinkError) {
                console.error('Error deleting audio file:', unlinkError);
            }
        }
    });
}







