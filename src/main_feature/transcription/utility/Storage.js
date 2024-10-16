import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs'

const AZURE_STORAGE_CONNECTION_STRING = process.env.azureStorageString;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'audiorecord';

// Function to upload a buffer to Azure Blob Storage
async function uploadBuffer(userUUID, buffer, fileName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(`${userUUID}/${fileName}`);

    // Upload the buffer directly
    await blockBlobClient.upload(buffer, buffer.length);
    console.log(`Buffer uploaded: ${fileName}`);

    // Generate a URL for the uploaded file
    const fileUrl = blockBlobClient.url;
    return fileUrl; // Return the URL
}

// Function to download a blob from Azure Blob Storage
async function downloadBlob(userUUID, fileName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(`${userUUID}/${fileName}`);

    const downloadBlockBlobResponse = await blockBlobClient.download(0); // Start download from the beginning
    const downloadedBuffer = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);

    console.log(`Downloaded blob: ${fileName}`);
    await fs.writeFileSync("ajay.mp3", downloadedBuffer);
    return downloadedBuffer; // Return the buffer
}

// Function to delete a blob from Azure Blob Storage
async function deleteBlob(userUUID, fileName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(`${userUUID}/${fileName}`);

    await blockBlobClient.delete();
    console.log(`Blob deleted: ${fileName}`);
}

// Helper function to convert a Readable stream to a buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (chunk) => chunks.push(chunk));
        readableStream.on('error', reject);
        readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

const userId = 'c22cf815-aad7-43a1-ba62-b9f56f4a2d49'
const fileName = 'outputc22cf815aad743a1ba62b9f56f4a2d4917290538272505c8d0c01e2ab422ba749adb48e0048e9.mp3'
//await deleteBlob(userId, fileName)


export { deleteBlob, uploadBuffer, downloadBlob }


