import fs from "fs";

import { exec } from "child_process";
import FormData from "form-data";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const client = new SpeechClient();

const transcribeAudioAPI = async (audioChunk) => {

    try {

        const audio = {
            content: audioChunk,
        };

        const config = {
            encoding: 'LINEAR16', // Change as needed, e.g., 'FLAC', 'MP3', etc.
            sampleRateHertz: 16000, // Change as needed
            languageCode: 'en-US', // Change as needed
        };

        const request = {
            audio: audio,
            config: config,
        };

        // Perform the transcription request
        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        console.log('Transcription:', transcription);
        return transcription;

    } catch (error) {
        console.error('Error during transcription:', error);
        throw error; // Rethrow the error for further handling
    }

}

export default transcribeAudioAPI;