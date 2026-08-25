"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CallSession, endCall } from "@/lib/api";

type Props = {
  session: CallSession;
  onClose: () => void;
};

type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type VoiceTurn = {
  role: "user" | "assistant";
  content: string;
};

function formatTime(total: number) {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");

  const seconds = (total % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function CallModal({ session, onClose }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [camera, setCamera] = useState(session.mode === "video");
  const [ending, setEnding] = useState(false);

  const [voiceState, setVoiceState] =
    useState<VoiceState>("idle");

  const [voiceError, setVoiceError] =
    useState<string | null>(null);

  const [latestTranscript, setLatestTranscript] =
    useState("");

  const [history, setHistory] =
    useState<VoiceTurn[]>([]);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const audioChunksRef =
    useRef<Blob[]>([]);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const audioSourceRef =
    useRef<AudioBufferSourceNode | null>(null);

  const shouldProcessRecordingRef =
    useRef(false);

  const isVideo = session.mode === "video";

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupMicrophone();
      stopCurrentAudio();

      /*
       * Do not close the AudioContext here.
       *
       * During development React/Next can remount components,
       * and an async Whisper/Qwen/Fish request may still be
       * finishing. The context is closed deliberately in leave().
       */
    };
  }, []);

  const label = useMemo(
    () =>
      isVideo
        ? "AI Virat Kohli video session"
        : "AI Virat Kohli voice session",
    [isVideo]
  );

  const statusText = useMemo(() => {
    if (isVideo) {
      return session.demo
        ? "Demo connected"
        : "Connected";
    }

    if (voiceState === "listening") {
      return "Listening...";
    }

    if (voiceState === "thinking") {
      return "Thinking...";
    }

    if (voiceState === "speaking") {
      return "AI Virat is speaking...";
    }

    if (voiceState === "error") {
      return "Voice error";
    }

    return "Ready to talk";
  }, [isVideo, session.demo, voiceState]);

  function cleanupMicrophone() {
    shouldProcessRecordingRef.current = false;

    const recorder = mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    }

    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }
  }

  function stopCurrentAudio() {
    const source = audioSourceRef.current;

    if (!source) {
      return;
    }

    try {
      source.stop();
    } catch {
      // Source may already have finished.
    }

    try {
      source.disconnect();
    } catch {
      // Source may already be disconnected.
    }

    audioSourceRef.current = null;
  }

  function getAudioContext() {
    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current =
        new AudioContext();
    }

    return audioContextRef.current;
  }

  async function unlockAudio() {
    const context = getAudioContext();

    if (context.state === "suspended") {
      await context.resume();
    }
  }

  async function speakText(text: string) {
    const response = await fetch(
      `${apiBase}/api/tts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
        }),
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        errorText ||
        "Voice generation failed."
      );
    }

    const context = getAudioContext();

    if (context.state === "suspended") {
      await context.resume();
    }

    stopCurrentAudio();

    const audioData =
      await response.arrayBuffer();

    const audioBuffer =
      await context.decodeAudioData(
        audioData
      );

    const source =
      context.createBufferSource();

    source.buffer = audioBuffer;
    source.connect(context.destination);

    audioSourceRef.current = source;

    source.onended = () => {
      if (
        audioSourceRef.current === source
      ) {
        audioSourceRef.current = null;
      }

      setVoiceState("idle");
    };

    setVoiceState("speaking");

    source.start(0);
  }

  async function sendAudioToWhisper(
    audioBlob: Blob,
    extension: string
  ) {
    setVoiceState("thinking");
    setVoiceError(null);

    const formData = new FormData();

    formData.append(
      "audio",
      audioBlob,
      `voice-call.${extension}`
    );

    const response = await fetch(
      `${apiBase}/api/stt`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        errorText ||
        "Speech recognition failed."
      );
    }

    const data = await response.json();

    return data.text as string;
  }

  async function sendTranscriptToAI(
    transcript: string
  ) {
    const response = await fetch(
      `${apiBase}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          message: transcript,
          history,
        }),
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        errorText ||
        "AI response failed."
      );
    }

    const data = await response.json();

    return data.reply as string;
  }

  async function processRecording(
    audioBlob: Blob,
    extension: string
  ) {
    try {
      setVoiceError(null);
      setVoiceState("thinking");

      console.log("[voice] sending audio to Whisper");

      const transcript =
        await sendAudioToWhisper(
          audioBlob,
          extension
        );

      console.log(
        "[voice] transcript:",
        transcript
      );

      setLatestTranscript(transcript);

      console.log("[voice] sending transcript to AI");

      const reply =
        await sendTranscriptToAI(
          transcript
        );

      console.log(
        "[voice] AI reply:",
        reply
      );

      setHistory((previous) => [
        ...previous,
        {
          role: "user",
          content: transcript,
        },
        {
          role: "assistant",
          content: reply,
        },
      ]);

      console.log("[voice] requesting Fish Audio");

      await speakText(reply);

      console.log("[voice] Fish audio started");
    } catch (error) {
      console.error(
        "Voice call error:",
        error
      );

      setVoiceState("error");

      setVoiceError(
        error instanceof Error
          ? error.message
          : "Something went wrong during the call."
      );
    }
  }

  async function startListening() {
    try {
      setVoiceError(null);
      setLatestTranscript("");

      stopCurrentAudio();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      const mimeType =
        supportedTypes.find((type) =>
          MediaRecorder.isTypeSupported(type)
        );

      const recorder = mimeType
        ? new MediaRecorder(stream, {
          mimeType,
        })
        : new MediaRecorder(stream);

      mediaRecorderRef.current =
        recorder;

      audioChunksRef.current = [];

      recorder.ondataavailable = (
        event
      ) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onstop = () => {
        const shouldProcess =
          shouldProcessRecordingRef.current;

        shouldProcessRecordingRef.current =
          false;

        const finalMimeType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const extension =
          finalMimeType.includes("mp4")
            ? "m4a"
            : "webm";

        const audioBlob = new Blob(
          audioChunksRef.current,
          {
            type: finalMimeType,
          }
        );

        stream
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        streamRef.current = null;
        mediaRecorderRef.current = null;

        if (
          shouldProcess &&
          audioBlob.size > 0
        ) {
          void processRecording(
            audioBlob,
            extension
          );
        }
      };

      shouldProcessRecordingRef.current =
        false;

      recorder.start();

      setVoiceState("listening");
    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      setVoiceState("error");

      setVoiceError(
        "Microphone permission was denied or the microphone could not be opened."
      );
    }
  }

  function stopListening() {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state === "recording"
    ) {
      shouldProcessRecordingRef.current =
        true;

      setVoiceState("thinking");

      recorder.stop();
    }
  }

  async function handleMic() {
    if (
      voiceState === "listening"
    ) {
      stopListening();
      return;
    }

    if (voiceState !== "idle") {
      return;
    }

    try {
      /*
       * This happens directly from the user's
       * MIC click, which unlocks browser audio.
       */
      await unlockAudio();

      await startListening();
    } catch (error) {
      console.error(
        "Audio setup error:",
        error
      );

      setVoiceState("error");

      setVoiceError(
        "Audio could not start. Please allow microphone and audio access."
      );
    }
  }

  async function leave() {
    if (ending) {
      return;
    }

    setEnding(true);

    cleanupMicrophone();
    stopCurrentAudio();

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // Context may already be closed.
      }

      audioContextRef.current = null;
    }

    try {
      if (session.conversation_id) {
        await endCall(
          session.conversation_id
        );
      }
    } catch {
      // Close locally even if provider cleanup fails.
    } finally {
      onClose();
    }
  }

  return (
    <div
      className="call-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={`call-shell ${isVideo
            ? "call-shell--video"
            : "call-shell--voice"
          }`}
      >
        {session.conversation_url &&
          !session.demo ? (
          <iframe
            className="tavus-frame"
            src={session.conversation_url}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            title="AI Virat Kohli conversation"
          />
        ) : (
          <div className="demo-call-stage">
            <div className="call-glow call-glow--blue" />
            <div className="call-glow call-glow--red" />

            {isVideo ? (
              <div
                className="demo-video-person"
                aria-label="Temporary authorized avatar placeholder"
              >
                <div className="avatar-head" />
                <div className="avatar-body" />

                <div className="avatar-badge">
                  18
                </div>
              </div>
            ) : (
              <div
                className={`voice-orb voice-orb--${voiceState}`}
              >
                <span>18</span>
              </div>
            )}

            <div
              className="wave"
              aria-hidden="true"
            >
              {Array.from({
                length: 24,
              }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    animationDelay: `${i * 45
                      }ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="call-topbar">
          <div>
            <div className="call-eyebrow">
              AI VIRAT KOHLI
            </div>

            <div className="call-status">
              <span className="online-dot" />
              {statusText}
            </div>
          </div>

          <div className="call-time">
            {formatTime(seconds)}
          </div>
        </div>

        <div className="call-bottom">
          {!isVideo &&
            latestTranscript && (
              <p className="demo-note">
                You: {latestTranscript}
              </p>
            )}

          {!isVideo &&
            voiceError && (
              <p className="demo-note">
                {voiceError}
              </p>
            )}

          <div className="call-controls">
            {!isVideo && (
              <button
                className={`round-control ${voiceState ===
                    "listening"
                    ? "active"
                    : ""
                  }`}
                onClick={() => {
                  void handleMic();
                }}
                disabled={
                  voiceState ===
                  "thinking" ||
                  voiceState ===
                  "speaking"
                }
              >
                {voiceState ===
                  "listening"
                  ? "STOP"
                  : "MIC"}
              </button>
            )}

            {isVideo && (
              <button
                className={`round-control ${!camera
                    ? "active"
                    : ""
                  }`}
                onClick={() => {
                  setCamera(!camera);
                }}
              >
                {camera
                  ? "CAM"
                  : "OFF"}
              </button>
            )}

            <button
              className="end-control"
              onClick={leave}
              disabled={ending}
            >
              {ending
                ? "ENDING"
                : "END"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}