import fs from "fs";

import { exec } from "child_process";
import FormData from "form-data";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNK_DURATION = 150; // 2.5 minutes in seconds
const MAX_RETRIES = 3; // Maximum retry attempts for each chunk

// Helper function to split audio into chunks of specified duration
const splitAudio = (audioPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -i ${audioPath} -f segment -segment_time ${CHUNK_DURATION} -c copy ${outputDir}/chunk_%03d.mp3`;
        exec(command, (error) => {
            if (error) {
                console.error("Error splitting audio file:", error.message);
                return reject("Failed to split audio file.");
            }
            resolve();
        });
    });
};

// Function to transcribe a single chunk with retry logic
const transcribeChunk = async (chunkPath, retries = 0) => {
    try {
        const formData = new FormData();
        formData.append('model', 'whisper-1');
        formData.append('file', fs.createReadStream(chunkPath), {
            filename: path.basename(chunkPath),
            contentType: 'audio/mpeg',
        });

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.openAi}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message || "Transcription failed");
        }

        const result = await response.json();
        console.log(`Transcription Successful for ${chunkPath}`);
        return result.text;
    } catch (error) {
        console.error(`Error during transcription of ${chunkPath}:`, error.message);

        // Retry logic if max retries not exceeded
        if (retries < MAX_RETRIES) {
            console.log(`Retrying chunk: ${path.basename(chunkPath)} (Attempt ${retries + 1}/${MAX_RETRIES})`);
            return await transcribeChunk(chunkPath, retries + 1);
        } else {
            console.error(`Chunk failed after ${MAX_RETRIES} attempts. Skipping: ${chunkPath}`);
            // Remove the chunk file after maximum retries
            fs.unlinkSync(chunkPath);
            throw new Error(`Failed to transcribe chunk: ${path.basename(chunkPath)} after ${MAX_RETRIES} retries.`);
        }
    }
};

// Main function to transcribe audio with parallel chunk processing
const speechToText = async (audioPath) => {
    const outputDir = path.join(__dirname, "chunks");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir); // Create output directory if it doesn't exist

    console.log(`Splitting audio file into 2.5-minute chunks...`);

    try {
        // Step 1: Split the audio into 2.5-minute chunks
        await splitAudio(audioPath, outputDir);

        // Step 2: Transcribe each chunk in parallel
        const chunkFiles = fs.readdirSync(outputDir).filter(file => file.endsWith(".mp3"));

        console.log("Starting parallel transcription for each chunk...");

        // Process chunks in parallel using custom promise handler for retries
        const transcriptionResults = await Promise.allSettled(
            chunkFiles.map(chunkFile => transcribeChunk(path.join(outputDir, chunkFile)))
        );

        // Step 3: Filter out failed transcriptions and combine successful ones
        const successfulTranscriptions = transcriptionResults
            .filter(result => result.status === "fulfilled")
            .map(result => result.value);

        const combinedText = successfulTranscriptions.join(" ");
        console.log("Final Transcription Text:", combinedText);

        return combinedText;
    } catch (error) {
        console.error("Error during the speech-to-text process:", error.message);
        throw new Error("Failed to transcribe the entire audio file.");
    } finally {
        // Clean up: Remove temporary chunk files
        fs.rmdirSync(outputDir, { recursive: true });
        console.log("Temporary files cleaned up.");
    }
};

export default speechToText;
