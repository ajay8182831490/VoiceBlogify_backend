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


export async function fromFile(audioFilePath, chunkIndex) {
    let speechRecognizer;
    let fullTranscription = '';
    let recognitionStarted = false;

    try {
        const audioData = await fs.readFile(audioFilePath);
        const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.azureKey, 'eastus');
        speechConfig.speechRecognitionLanguage = "en-US";

        // Add these settings to make recognition more robust
        speechConfig.setProperty("MaxRetryCount", "3");
        speechConfig.enableAudioLogging(); // Helps with debugging

        const audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
        speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        return new Promise((resolve, reject) => {
            let isCompleted = false;
            let hasError = false;

            // Recognition started event
            speechRecognizer.recognizing = (s, e) => {
                if (!recognitionStarted) {
                    recognitionStarted = true;
                    console.log(`Recognition actively processing chunk ${chunkIndex}`);
                }
            };

            speechRecognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    fullTranscription += e.result.text + ' ';
                    console.log(`Chunk ${chunkIndex} progress: ${fullTranscription.length} chars`);
                } else if (e.result.reason === sdk.ResultReason.NoMatch) {
                    console.warn(`Chunk ${chunkIndex} no match. Details: ${sdk.NoMatchReason[e.result.noMatchReason]}`);
                }
            };

            speechRecognizer.canceled = (s, e) => {
                if (!isCompleted) {
                    hasError = true;
                    const errorMessage = e.errorDetails || 'Unknown error';
                    const errorCode = e.errorCode || 'Unknown code';

                    console.error(`Chunk ${chunkIndex} canceled. Error code: ${errorCode}, Details: ${errorMessage}`);

                    // If we have partial transcription and it's not a critical error, we might want to return it
                    if (fullTranscription.length > 0 && e.errorCode !== sdk.CancellationErrorCode.AuthenticationFailure) {
                        console.warn(`Returning partial transcription for chunk ${chunkIndex}`);
                        stopRecognition();
                        resolve(fullTranscription.trim());
                    } else {
                        stopRecognition();
                        reject(new Error(`Recognition canceled: ${errorMessage} (Code: ${errorCode})`));
                    }
                }
            };

            speechRecognizer.sessionStopped = (s, e) => {
                if (!isCompleted && !hasError) {
                    console.log(`Chunk ${chunkIndex} completed successfully. Length: ${fullTranscription.length}`);
                    stopRecognition();
                    resolve(fullTranscription.trim());
                }
            };

            const stopRecognition = async () => {
                if (speechRecognizer && !isCompleted) {
                    isCompleted = true;
                    try {
                        await new Promise((resolveStop, rejectStop) => {
                            const stopTimeout = setTimeout(() => {
                                console.warn(`Force closing recognition for chunk ${chunkIndex}`);
                                speechRecognizer.close();
                                resolveStop();
                            }, 5000); // Force stop after 5 seconds

                            speechRecognizer.stopContinuousRecognitionAsync(
                                () => {
                                    clearTimeout(stopTimeout);
                                    speechRecognizer.close();
                                    resolveStop();
                                },
                                (err) => {
                                    clearTimeout(stopTimeout);
                                    console.error(`Error stopping chunk ${chunkIndex}:`, err);
                                    speechRecognizer.close();
                                    rejectStop(err);
                                }
                            );
                        });
                    } catch (err) {
                        console.error(`Cleanup error for chunk ${chunkIndex}:`, err);
                    } finally {
                        speechRecognizer = null;
                    }
                }
            };

            // Shorter timeout and more detailed timeout handling
            const timeout = setTimeout(() => {
                if (!isCompleted) {
                    console.log(`Timeout for chunk ${chunkIndex}. Transcription length: ${fullTranscription.length}`);
                    if (fullTranscription.length > 0) {
                        stopRecognition();
                        resolve(fullTranscription.trim());
                    } else {
                        stopRecognition();
                        reject(new Error(`Timeout: No transcription received for chunk ${chunkIndex}`));
                    }
                }
            }, 180000); // Reduced to 180 seconds

            // Start recognition with better error handling
            try {
                speechRecognizer.startContinuousRecognitionAsync(
                    () => {
                        console.log(`Started recognition for chunk ${chunkIndex}`);
                    },
                    (error) => {
                        if (!isCompleted) {
                            console.error(`Start error for chunk ${chunkIndex}:`, error);
                            clearTimeout(timeout);
                            stopRecognition();
                            reject(new Error(`Failed to start recognition: ${error.message || error}`));
                        }
                    }
                );
            } catch (error) {
                clearTimeout(timeout);
                stopRecognition();
                reject(new Error(`Failed to initialize recognition: ${error.message || error}`));
            }
        });
    } catch (error) {
        console.error(`Setup error for chunk ${chunkIndex}:`, error);
        if (speechRecognizer) {
            speechRecognizer.close();
        }
        throw error;
    }
}






