import path from 'path';


import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);



import { SpeechClient } from '@google-cloud/speech';
import { logError } from '../../utils/logger.js';


const client = new SpeechClient({
    credentials: {
        api_key: 'YOUR_API_KEY',
    },
}
);

const transcribeAudioAPI = async (audioChunk, userSelectedLanguage) => {
    try {
        const audio = {
            content: audioChunk.toString('base64'),
        };

        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: userSelectedLanguage || 'en-US',
        };

        const request = {
            audio: audio,
            config: config,
        };

        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');


        return transcription;

    } catch (error) {
        logError(error, path.basename(__filename), transcribeAudioAPI);
        throw error;
    }
};


export default transcribeAudioAPI;