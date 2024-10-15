import { BlobServiceClient } from '@azure/storage-blob';

const AZURE_STORAGE_CONNECTION_STRING = process.env.azureStorageString;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'voiceblogify_audio';

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

export { deleteBlob, uploadBuffer, downloadBlob }

// Example Usage
(async () => {
    const userUUID = 'your-unique-uuid'; // Replace with actual user UUID
    const buffer = Buffer.from('your-audio-data'); // Replace with your actual buffer data
    const fileName = 'audio-file.wav'; // The name for the uploaded file

    // Upload the buffer
    const fileUrl = await uploadBuffer(userUUID, buffer, fileName);
    console.log(`File URL: ${fileUrl}`);

    // Download the buffer
    const downloadedBuffer = await downloadBlob(userUUID, fileName);
    console.log('Downloaded buffer:', downloadedBuffer);

    // Delete the blob
    await deleteBlob(userUUID, fileName);
})();
