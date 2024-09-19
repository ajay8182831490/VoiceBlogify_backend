

export function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, { path: ffprobe.path }, (err, metadata) => {
            if (err) {
                return reject(err);
            }
            const duration = metadata.format.duration;
            resolve(duration);
        });
    });
}
export function validateFileSize(filePath, maxSize) {
    const stats = fs.statSync(filePath);
    return stats.size <= maxSize;
}
export function isValidAudioFile(filePath) {
    const validExtensions = ['.mp3', '.wav', '.aac'];
    const ext = path.extname(filePath).toLowerCase();
    return validExtensions.includes(ext);
}
export function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .noVideo()
            .audioCodec('aac')
            .save(audioPath)
            .on('end', resolve)
            .on('error', reject);
    });
}
export async function downloadFile(url, outputPath) {
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    }

    const fileStream = fs.createWriteStream(outputPath);
    const fileSize = parseInt(res.headers.get('content-length'), 10);

    if (fileSize > MAX_FILE_SIZE) {
        throw new Error('File size exceeds the maximum allowed size');
    }

    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}
