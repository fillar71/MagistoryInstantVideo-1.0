
import React, { useState, useEffect, useRef } from 'react';
import type { Segment, AudioClip } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { DownloadIcon, ExportIcon } from './icons';
import { estimateWordTimings } from '../utils/media';
import { useAuth } from '../contexts/AuthContext'; // Import context

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  segments: Segment[];
  audioTracks?: AudioClip[]; 
}

type ExportStatus = 'idle' | 'preparing' | 'sending' | 'rendering' | 'uploading' | 'complete' | 'error';
type ExportQuality = '360p' | '720p' | '1080p';

const RENDER_URL = process.env.RENDER_URL || 'http://localhost:3002';

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, title, segments, audioTracks = [] }) => {
    const [status, setStatus] = useState<ExportStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [quality, setQuality] = useState<ExportQuality>('720p');
    
    const { session } = useAuth(); // Get session for token
    const pollIntervalRef = useRef<any>(null);

    // Reset status when modal re-opens
    useEffect(() => {
        if (isOpen && status === 'complete') {
            // Optional: reset
        }
    }, [isOpen]);

    const convertBlobUrlToBase64 = async (blobUrl: string): Promise<string> => {
        try {
            if (!blobUrl.startsWith('blob:')) return blobUrl;
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return blobUrl; 
        }
    };

    const preparePayload = async () => {
        setStatusText("Preparing audio and subtitles...");
        
        const processedSegments = JSON.parse(JSON.stringify(segments));
        const processedAudioTracks = JSON.parse(JSON.stringify(audioTracks));

        for (const segment of processedSegments) {
            for (const clip of segment.media) {
                clip.url = await convertBlobUrlToBase64(clip.url);
            }
            if (segment.audioUrl) {
                segment.audioUrl = await convertBlobUrlToBase64(segment.audioUrl);
            }
            if (segment.narration_text && (!segment.wordTimings || segment.wordTimings.length === 0)) {
                segment.wordTimings = estimateWordTimings(segment.narration_text, segment.duration);
            }
        }

        for (const track of processedAudioTracks) {
            track.url = await convertBlobUrlToBase64(track.url);
        }

        let width = 1280;
        let height = 720;
        if (quality === '360p') { width = 640; height = 360; }
        if (quality === '1080p') { width = 1920; height = 1080; }

        return {
            title,
            segments: processedSegments,
            audioTracks: processedAudioTracks,
            resolution: { width, height }
        };
    };

    const handleStartExport = async () => {
        setStatus('preparing');
        setError('');
        setVideoUrl(null);
        
        const sanitizedUrl = RENDER_URL.replace(/\/$/, '');

        try {
            const payload = await preparePayload();
            setStatus('sending');
            setStatusText("Uploading project to server...");

            const headers: any = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(`${sanitizedUrl}/render`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Render server rejected request.");
            }

            const { jobId } = await response.json();
            setStatus('rendering');
            setStatusText("Rendering video & burning subtitles...");
            
            pollIntervalRef.current = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${sanitizedUrl}/status/${jobId}`);
                    const statusData = await statusRes.json();
                    
                    if (statusData.status === 'completed' && statusData.videoUrl) {
                        clearInterval(pollIntervalRef.current);
                        setVideoUrl(statusData.videoUrl);
                        setStatus('complete');
                    } else if (statusData.status === 'uploading') {
                        setStatus('uploading');
                        setStatusText("Uploading video to cloud storage...");
                    } else if (statusData.status === 'error') {
                        throw new Error(statusData.error || "Rendering failed.");
                    }
                } catch (pollErr: any) {
                     clearInterval(pollIntervalRef.current);
                     setError(pollErr.message);
                     setStatus('error');
                }
            }, 3000); 

        } catch (err: any) {
            setError(err.message || "Export process failed.");
            setStatus('error');
        }
    };

    const handleClose = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={handleClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6 border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-300">Export Final Video</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                {status === 'idle' && (
                    <div className="space-y-6">
                         <div className="bg-gray-900/50 p-4 rounded-lg">
                             <label className="text-xs text-gray-500 font-bold block mb-3 uppercase">Export Quality</label>
                             <div className="flex gap-2">
                                {(['360p', '720p', '1080p'] as ExportQuality[]).map(q => (
                                    <button key={q} onClick={() => setQuality(q)}
                                        className={`flex-1 py-2 rounded font-bold border transition-all ${quality === q ? 'bg-purple-600 border-purple-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                    >
                                        {q}
                                    </button>
                                ))}
                             </div>
                         </div>
                        <button onClick={handleStartExport} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-xl transition-all active:scale-95">
                            Render Now (5 Credits)
                        </button>
                    </div>
                )}

                {(status === 'preparing' || status === 'sending' || status === 'rendering' || status === 'uploading') && (
                    <div className="text-center py-12">
                        <div className="flex justify-center mb-6"><LoadingSpinner /></div>
                        <p className="text-white font-semibold">{statusText}</p>
                        <p className="text-xs text-gray-500 mt-2 animate-pulse">This usually takes 1-3 minutes</p>
                    </div>
                )}
                
                {status === 'complete' && videoUrl && (
                     <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <DownloadIcon className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Video Ready!</h3>
                        <p className="text-sm text-gray-400 mb-6">Your video is hosted securely on the cloud.</p>
                        
                        <div className="space-y-3">
                            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold shadow-lg flex items-center justify-center gap-2">
                                <DownloadIcon className="w-5 h-5" /> Download / Watch
                            </a>
                            <button 
                                onClick={handleStartExport}
                                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <ExportIcon className="w-4 h-4" /> Render Again
                            </button>
                        </div>
                     </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-4">
                        <div className="bg-red-900/20 p-4 rounded-lg mb-6 border border-red-500/30">
                            <h3 className="text-red-400 font-bold mb-2">Export Failed</h3>
                            <p className="text-red-200 text-xs">{error}</p>
                        </div>
                        <button onClick={handleStartExport} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold">Retry</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExportModal;
