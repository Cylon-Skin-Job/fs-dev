import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchServer } from '../lib/runtime-transport';

type RecorderState = 'checking_permission' | 'permission_needed' | 'permission_denied' | 'recording' | 'processing';

interface UseAudioCaptureOptions {
  maxDuration?: number;
  signal?: AbortSignal;
  onTranscribe: (text: string) => void;
  onClose: () => void;
}

interface UseAudioCaptureReturn {
  recorderState: RecorderState;
  timeLeft: number;
  audioLevel: number;
  errorMessage: string | null;
  requestPermissionAndRecord: () => void;
  stopRecording: (cancelled?: boolean) => void;
  handleCancel: () => void;
  handleRetry: () => void;
  circumference: number;
  maxDuration: number;
}

const DEFAULT_MAX_DURATION = 60;

/**
 * Find the best microphone device - prefers built-in Mac microphone over Continuity (iPhone)
 */
async function getBuiltInMicrophoneDeviceId(signal?: AbortSignal): Promise<string | undefined> {
  let tempStream: MediaStream | undefined;
  try {
    tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (signal?.aborted) return undefined;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    const builtInPatterns = [
      /macbook.*microphone/i,
      /macbook.*air.*microphone/i,
      /macbook.*pro.*microphone/i,
      /imac.*microphone/i,
      /mac.*studio.*microphone/i,
      /mac.*mini.*microphone/i,
      /built.in.*microphone/i,
      /internal.*microphone/i,
    ];

    const continuityPatterns = [
      /iphone/i,
      /ipad/i,
      /continuity/i,
      /belkin/i,
    ];

    for (const device of audioInputs) {
      const label = device.label.toLowerCase();
      const isBuiltIn = builtInPatterns.some(p => p.test(label));
      const isContinuity = continuityPatterns.some(p => p.test(label));
      if (isBuiltIn && !isContinuity) {
        console.log('[VoiceRecorder] Using built-in microphone:', device.label);
        return device.deviceId;
      }
    }

    for (const device of audioInputs) {
      const label = device.label.toLowerCase();
      const isContinuity = continuityPatterns.some(p => p.test(label));
      if (!isContinuity) {
        console.log('[VoiceRecorder] Using external microphone:', device.label);
        return device.deviceId;
      }
    }

    console.log('[VoiceRecorder] No built-in mic found, using system default');
    return undefined;
  } catch (error) {
    console.warn('[VoiceRecorder] Could not enumerate devices:', error);
    return undefined;
  } finally {
    tempStream?.getTracks().forEach(track => track.stop());
  }
}

export function useAudioCapture({
  maxDuration = DEFAULT_MAX_DURATION,
  onTranscribe,
  onClose,
  signal,
}: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const [recorderState, setRecorderState] = useState<RecorderState>('checking_permission');
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationRef = useRef<number | null>(null);
  const permissionCheckedRef = useRef(false);
  const cancelledRef = useRef(false);
  const callbacks = useRef({ onClose, onTranscribe });
  callbacks.current = { onClose, onTranscribe };
  const remainingTime = useRef(timeLeft);
  remainingTime.current = timeLeft;

  const stopRecording = useCallback((cancelled = false) => {
    if (cancelled) cancelledRef.current = true;
    // CRITICAL order: timer → animation → MediaRecorder → tracks → AudioContext
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);

    if (cancelled) {
      callbacks.current.onClose();
    }
  }, []);

  const sendForTranscription = useCallback(async (audioBlob: Blob) => {
    if (cancelledRef.current || signal?.aborted) return;
    setRecorderState('processing');

    // Defensive: reject empty or near-empty recordings client-side so the
    // user gets a clear message instead of a cryptic server error.
    if (audioBlob.size < 1024) {
      console.warn('[VoiceRecorder] Audio blob too small:', audioBlob.size, 'bytes');
      setRecorderState('permission_denied');
      setErrorMessage('Recording appears to be silent or too short. Please try again.');
      return;
    }

    console.log('[VoiceRecorder] Sending audio for transcription:', audioBlob.size, 'bytes');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', 'auto');
      formData.append('duration', String(maxDuration - remainingTime.current));

      const response = await fetchServer('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal,
      });

      if (cancelledRef.current || signal?.aborted) return;
      if (!response.ok) {
        const errText = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(errText);
      }

      const result = await response.json();

      if (cancelledRef.current || signal?.aborted) return;
      if (result.success && result.text) {
        callbacks.current.onTranscribe(result.text);
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
    } catch (error) {
      if (cancelledRef.current || signal?.aborted) return;
      console.error('Transcription error:', error);
      setRecorderState('permission_denied');
      setErrorMessage('Transcription failed. Please try again.');
    }
  }, [maxDuration, signal]);

  const startRecording = useCallback(async () => {
    if (cancelledRef.current || signal?.aborted) return;
    try {
      setRecorderState('recording');
      setTimeLeft(maxDuration);
      setAudioLevel(0);
      chunksRef.current = [];

      const deviceId = await getBuiltInMicrophoneDeviceId(signal);
      if (cancelledRef.current || signal?.aborted) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
      if (cancelledRef.current || signal?.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;

      audioContextRef.current = new AudioContext();

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (cancelledRef.current || signal?.aborted || !audioContextRef.current) return;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current || !streamRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const voiceBins = dataArray.slice(0, 20);
        const average = voiceBins.reduce((a, b) => a + b) / voiceBins.length;
        const normalizedLevel = Math.min(average / 80, 1);
        setAudioLevel(normalizedLevel);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      try {
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      } catch (error) {
        if (cancelledRef.current || signal?.aborted) return;
        console.error('Failed to start recording:', error);
        setRecorderState('permission_denied');
        setErrorMessage('Could not access microphone. Please check permissions.');
        return;
      }

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (cancelledRef.current || signal?.aborted) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await sendForTranscription(blob);
      };

      mediaRecorderRef.current.start(100);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      if (cancelledRef.current || signal?.aborted) return;
      console.error('Failed to start recording:', error);
      setRecorderState('permission_denied');
      setErrorMessage('Could not access microphone. Please check permissions.');
    }
  }, [maxDuration, sendForTranscription, stopRecording, signal]);

  const checkExistingPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });

        if (cancelledRef.current || signal?.aborted) return;
        if (result.state === 'granted') {
          startRecording();
          return;
        } else if (result.state === 'prompt') {
          setRecorderState('permission_needed');
          return;
        } else {
          setRecorderState('permission_denied');
          return;
        }
      }
      setRecorderState('permission_needed');
    } catch {
      if (cancelledRef.current || signal?.aborted) return;
      setRecorderState('permission_needed');
    }
  }, [startRecording, signal]);

  const requestPermissionAndRecord = useCallback(async () => {
    setErrorMessage(null);
    try {
      await startRecording();
    } catch (error) {
      console.error('Permission error:', error);
      setRecorderState('permission_denied');
      setErrorMessage('Microphone access was denied. Please enable it in your browser settings.');
    }
  }, [startRecording, signal]);

  const handleCancel = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setRecorderState('permission_needed');
  }, []);

  // Check permission on mount (runs exactly once via ref guard)
  useEffect(() => {
    if (permissionCheckedRef.current) return;
    permissionCheckedRef.current = true;
    checkExistingPermission();
  }, [checkExistingPermission]);

  // Cancellation and retirement stop preparation without invoking a rebound completion.
  useEffect(() => {
    cancelledRef.current = false;
    const cancel = () => stopRecording(true);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    return () => { signal?.removeEventListener('abort', cancel); cancelledRef.current = true; stopRecording(); };
  }, [signal, stopRecording]);

  // Keyboard shortcut: Enter to stop recording and submit (capture phase)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recorderState === 'recording' && e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        stopRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recorderState, stopRecording]);

  return {
    recorderState,
    timeLeft,
    audioLevel,
    errorMessage,
    requestPermissionAndRecord,
    stopRecording,
    handleCancel,
    handleRetry,
    circumference: 2 * Math.PI * 45,
    maxDuration,
  };
}
