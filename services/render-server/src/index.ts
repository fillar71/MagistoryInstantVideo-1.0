
import express from 'express';
import cors from 'cors';
import { renderVideo } from './renderer';
import { verifyUserAndDeductCredits } from './auth';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';

(process as any).on('uncaughtException', (err: any) => {
    console.error('CRITICAL RENDER SERVER ERROR:', err);
});

const app = express();
app.set('trust proxy', 1); // Trust Fly.io proxy

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
    next();
});

const healthHandler = (req: any, res: any) => {
    res.status(200).send('Render Server Online');
};

app.get('/', healthHandler);
app.get('/health', healthHandler);

// Allow CORS from anywhere (Frontend will call this)
app.use(cors({ 
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json({ limit: '100mb' }) as any);

// Fly.io sets PORT environment variable, default to 8080 if missing
const PORT = parseInt(process.env.PORT || '8080');
const TEMP_DIR = path.join(os.tmpdir(), 'magistory-render');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
} else {
    console.warn("⚠️ CLOUDINARY_CLOUD_NAME not set. Uploads will fail.");
}

try {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
} catch (err) {
    console.error("Temp Dir Error:", err);
}

const jobs = new Map<string, { 
    status: 'processing' | 'uploading' | 'completed' | 'error', 
    videoUrl?: string, 
    error?: string, 
    createdAt: number 
}>();

// Cleanup job
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
        if (now - job.createdAt > 1800000) { // 30 mins
            jobs.delete(id);
        }
    }
}, 1800000);

app.post('/render', async (req, res) => {
    try {
        // --- AUTH & CREDIT CHECK ---
        const authHeader = req.headers.authorization;
        const cost = 5; 
        
        await verifyUserAndDeductCredits(authHeader, cost);
        // ---------------------------

        const jobId = uuidv4();
        console.log(`Job Started: ${jobId}`);
        jobs.set(jobId, { status: 'processing', createdAt: Date.now() });
        
        // Start processing asynchronously
        renderVideo(req.body, TEMP_DIR)
            .then(async (outputPath) => {
                console.log(`Render complete for ${jobId}. Starting upload...`);
                jobs.set(jobId, { status: 'uploading', createdAt: Date.now() });

                try {
                    const result = await cloudinary.uploader.upload(outputPath, {
                        resource_type: 'video',
                        folder: 'magistory_renders',
                    });

                    console.log(`Upload success: ${result.secure_url}`);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

                    jobs.set(jobId, { 
                        status: 'completed', 
                        videoUrl: result.secure_url, 
                        createdAt: Date.now() 
                    });

                } catch (uploadErr: any) {
                    console.error("Upload Error:", uploadErr);
                    jobs.set(jobId, { status: 'error', error: "Upload failed: " + uploadErr.message, createdAt: Date.now() });
                }
            })
            .catch((err) => {
                console.error(`Job Failed ${jobId}:`, err);
                jobs.set(jobId, { status: 'error', error: err.message, createdAt: Date.now() });
            });

        res.json({ jobId });
    } catch (error: any) {
        console.error("Request Blocked:", error.message);
        res.status(403).json({ error: error.message });
    }
});

app.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Not Found' });
    res.json({ status: job.status, error: job.error, videoUrl: job.videoUrl });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Render Server Live on port ${PORT}`);
    console.log(`   Temp Dir: ${TEMP_DIR}`);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const shutdown = () => {
    console.log('SIGTERM received: closing HTTP server');
    server.close(() => (process as any).exit(0));
};

(process as any).on('SIGTERM', shutdown);
(process as any).on('SIGINT', shutdown);
