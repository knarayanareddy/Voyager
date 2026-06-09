import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Sparkles, FileAudio, Check } from 'lucide-react';
import { DatabaseActions } from '../../context/DatabaseContext';
import { genAudioId } from '../../utils/id';

interface AudioRecorderProps {
  screenOn: boolean;
  actions: DatabaseActions;
  currentPageId: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ screenOn, actions, currentPageId }) => {
  const [recording, setRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // Removed audioChunks state

  
  // Waveform rendering
  const [waveform, setWaveform] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Playback state
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [playbackBlob, setPlaybackBlob] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Transcription state
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');

  // Handle timer
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
        // Add random bar heights to the waveform simulation
        setWaveform(prev => [...prev, Math.random() * 80 + 20]);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  // Clean up playback URL
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      // Removed setAudioChunks
      setWaveform([]);
      setSeconds(0);
      setPlaybackUrl('');
      setPlaybackBlob(null);
      setTranscription('');

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          // Removed setAudioChunks
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        const objectUrl = URL.createObjectURL(audioBlob);
        setPlaybackBlob(audioBlob);
        setPlaybackUrl(objectUrl);
      };

      recorder.start(200); // collect data every 200ms
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access denied or unavailable.');
    }
  };

  // Necessary to collect last chunks
  const stopRecording = useCallback(() => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);

      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
    }
  }, [mediaRecorder, recording, audioStream]);

  // Stop recording on screen off
  useEffect(() => {
    if (!screenOn && recording) {
      stopRecording();
    }
  }, [screenOn, recording, stopRecording]);

  const togglePlayback = () => {
    if (!audioRef.current || !playbackUrl) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const triggerTranscription = () => {
    setTranscribing(true);
    // Simulate Whisper transcription loading
    setTimeout(() => {
      setTranscribing(false);
      setTranscription(
        "Discussing local-first data persistence inside Voyager. We successfully implemented binary Blobs in IndexedDB, preventing state bloat and ensuring privacy for audio notes and stylus sketches."
      );
    }, 2000);
  };

  const saveAudioNote = async () => {
    if (!playbackBlob) return;

    const noteId = genAudioId();
    const name = `Audio Note ${new Date().toLocaleDateString()}`;

    // Save audio note metadata and blob to IndexedDB via actions
    await actions.addAudioNote(
      {
        id: noteId,
        name: name,
        url: '', // will be populated dynamically
        duration: seconds,
        transcription: transcription || '',
        transcriptionStatus: transcription ? 'done' : 'idle',
        createdAt: new Date().toISOString(),
        waveform: waveform,
        cropStart: 0,
        cropEnd: seconds,
        pageId: currentPageId
      },
      playbackBlob
    );

    // Also add to media attachments so it shows up in media tab
    await actions.addMedia(playbackBlob, 'audio', name, currentPageId);

    // Reset
    setPlaybackUrl('');
    setPlaybackBlob(null);
    setWaveform([]);
    setSeconds(0);
    setTranscription('');
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-neutral-900">
      
      {/* Audio Playback Element */}
      {playbackUrl && (
        <audio
          ref={audioRef}
          src={playbackUrl}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {/* Main Display: Waveform & Details */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 bg-neutral-950 rounded-2xl p-6 border border-neutral-800 shadow-inner">
        {recording ? (
          <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center text-red-500 animate-pulse">
            <Mic className="w-6 h-6" />
          </div>
        ) : playbackUrl ? (
          <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-500">
            <FileAudio className="w-6 h-6" />
          </div>
        ) : (
          <div className="text-neutral-500 flex flex-col items-center gap-2">
            <Mic className="w-10 h-10 text-neutral-600" />
            <span className="text-xs">Tap record button to begin</span>
          </div>
        )}

        {/* Counter */}
        {(recording || seconds > 0) && (
          <div className="text-2xl font-bold font-mono tracking-wider text-neutral-200">
            {formatTime(seconds)}
          </div>
        )}

        {/* Animated Waveform HUD */}
        {waveform.length > 0 && (
          <div className="w-full h-16 flex items-center justify-center gap-[3px] overflow-x-auto px-4 max-w-[280px]">
            {waveform.slice(-30).map((height, idx) => (
              <div
                key={idx}
                className={`w-[4px] rounded-full transition-all duration-300 ${
                  recording ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        )}

        {/* Real-Time simulated Whisper Transcription */}
        {transcribing && (
          <div className="w-full flex flex-col items-center gap-1 text-xs text-neutral-400">
            <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
            <span className="animate-pulse">Whisper transcribing...</span>
          </div>
        )}

        {transcription && (
          <div className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 italic leading-relaxed text-center shadow">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
              Whisper Transcript
            </span>
            "{transcription}"
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-28 flex flex-col justify-end gap-3 mt-3">
        {!playbackUrl ? (
          /* Recording Button */
          <div className="flex items-center justify-center">
            {recording ? (
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-neutral-900 cursor-pointer"
              >
                <Square className="w-6 h-6 fill-red-500 text-red-500" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-600 hover:bg-red-500 active:scale-95 cursor-pointer shadow-lg"
              >
                <Mic className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        ) : (
          /* Playback / Edit / Save */
          <div className="flex flex-col gap-2.5">
            {/* Playback action bar */}
            {!transcription && !transcribing && (
              <div className="flex justify-center">
                <button
                  onClick={triggerTranscription}
                  className="flex items-center gap-1.5 bg-neutral-950 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-bold hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Transcribe with Whisper AI
                </button>
              </div>
            )}

            <div className="flex items-center justify-between px-6">
              <button
                onClick={() => {
                  setPlaybackUrl('');
                  setPlaybackBlob(null);
                  setWaveform([]);
                  setSeconds(0);
                  setTranscription('');
                }}
                className="flex items-center gap-1.5 bg-neutral-900 text-red-400 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              
              <button
                onClick={togglePlayback}
                className="flex items-center gap-1.5 bg-neutral-900 text-blue-400 border border-neutral-800 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
              >
                {playing ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Play
                  </>
                )}
              </button>

              <button
                onClick={saveAudioNote}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500 shadow-md active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
