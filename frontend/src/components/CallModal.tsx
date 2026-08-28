"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CallSession,
  endCall,
  streamChat,
} from "@/lib/api";

import {
  createSequentialPrefetchQueue,
  takeSpeakableSegments,
} from "@/lib/voiceStreaming";

type Props = {
  session: CallSession;
  onClose: () => void;
};

type VoiceState =
  | "idle"
  | "listening"
  | "user-speaking"
  | "thinking"
  | "speaking"
  | "muted"
  | "error";

type VoiceTurn = {
  role: "user" | "assistant";
  content: string;
};

/*
 * Hands-free voice tuning.
 *
 * These values are deliberately kept here
 * so we can tune them easily after testing
 * with your actual microphone/environment.
 */
const SILENCE_TO_SEND_MS = 850;
const MIN_VOICED_MS = 180;
const MAX_UTTERANCE_MS = 30_000;

const MIN_START_RMS = 0.012;
const MIN_CONTINUE_RMS = 0.008;

const START_THRESHOLD_MULTIPLIER = 2.4;
const CONTINUE_THRESHOLD_MULTIPLIER = 1.5;

const MAX_START_THRESHOLD = 0.06;
const MAX_CONTINUE_THRESHOLD = 0.035;

/*
 * MediaRecorder gives us one chunk every 250ms.
 * Keep roughly one second of audio before detected
 * speech so the first syllable is not chopped off.
 */
const RECORDING_TIMESLICE_MS = 250;

const LISTEN_AFTER_AI_DELAY_MS = 180;


function formatTime(total: number) {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");

  const seconds = (total % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}


export function CallModal({
  session,
  onClose,
}: Props) {
  const [seconds, setSeconds] =
    useState(0);

  const [camera, setCamera] =
    useState(
      session.mode === "video"
    );

  const [ending, setEnding] =
    useState(false);

  const [
    voiceState,
    setVoiceState,
  ] =
    useState<VoiceState>(
      "idle"
    );

  const [
    voiceError,
    setVoiceError,
  ] =
    useState<string | null>(
      null
    );

  const [
    latestTranscript,
    setLatestTranscript,
  ] =
    useState("");

  const [muted, setMuted] =
    useState(false);

  /*
   * Keep voice conversation history in a ref.
   *
   * This avoids stale React closures during the
   * automatic listen → think → speak → listen loop.
   */
  const historyRef =
    useRef<VoiceTurn[]>([]);

  const callActiveRef =
    useRef(true);

  const endingRef =
    useRef(false);

  const mutedRef =
    useRef(false);

  const processingRef =
    useRef(false);

  const startingListeningRef =
    useRef(false);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const audioChunksRef =
    useRef<Blob[]>([]);

  const shouldProcessRecordingRef =
    useRef(false);

  const speechDetectedRef =
    useRef(false);

  const audioContextRef =
    useRef<AudioContext | null>(
      null
    );

  const audioSourceRef =
    useRef<AudioBufferSourceNode | null>(
      null
    );

  const analyserRef =
    useRef<AnalyserNode | null>(
      null
    );

  const micSourceRef =
    useRef<MediaStreamAudioSourceNode | null>(
      null
    );

  const vadFrameRef =
    useRef<number | null>(
      null
    );

  const listenTimerRef =
    useRef<number | null>(
      null
    );

  const currentRequestRef =
    useRef<AbortController | null>(
      null
    );

  const isVideo =
    session.mode === "video";

  const apiBase =
    process.env
      .NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000";


  /*
   * Call timer.
   */
  useEffect(() => {
    const timer =
      window.setInterval(() => {
        setSeconds(
          (value) => value + 1
        );
      }, 1000);

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, []);


  /*
   * Hands-free voice initialization.
   *
   * The moment the Voice Call modal opens,
   * we start preparing the microphone.
   *
   * No second MIC click is required.
   */
  useEffect(() => {
    callActiveRef.current = true;
    endingRef.current = false;

    if (!isVideo) {
      void startListeningTurn();
    }

    return () => {
      callActiveRef.current =
        false;

      endingRef.current = true;

      cancelListenTimer();

      currentRequestRef.current?.abort();

      currentRequestRef.current =
        null;

      releaseMicrophone();

      stopCurrentAudio();

      const context =
        audioContextRef.current;

      audioContextRef.current =
        null;

      if (
        context &&
        context.state !== "closed"
      ) {
        void context.close();
      }
    };
  }, [isVideo]);


  const label = useMemo(
    () =>
      isVideo
        ? "AI Virat Kohli video session"
        : "AI Virat Kohli voice session",
    [isVideo]
  );


  const statusText =
    useMemo(() => {
      if (isVideo) {
        return session.demo
          ? "Demo connected"
          : "Connected";
      }

      if (
        voiceState ===
        "listening"
      ) {
        return "Listening...";
      }

      if (
        voiceState ===
        "user-speaking"
      ) {
        return "Hearing you...";
      }

      if (
        voiceState ===
        "thinking"
      ) {
        return "Thinking...";
      }

      if (
        voiceState ===
        "speaking"
      ) {
        return "AI Virat is speaking...";
      }

      if (
        voiceState ===
        "muted"
      ) {
        return "Muted";
      }

      if (
        voiceState ===
        "error"
      ) {
        return "Voice error";
      }

      return "Connecting microphone...";
    }, [
      isVideo,
      session.demo,
      voiceState,
    ]);


  function cancelListenTimer() {
    if (
      listenTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        listenTimerRef.current
      );

      listenTimerRef.current =
        null;
    }
  }


  function scheduleListening(
    delay =
      LISTEN_AFTER_AI_DELAY_MS
  ) {
    cancelListenTimer();

    if (
      !callActiveRef.current ||
      endingRef.current ||
      mutedRef.current ||
      processingRef.current
    ) {
      return;
    }

    listenTimerRef.current =
      window.setTimeout(() => {
        listenTimerRef.current =
          null;

        void startListeningTurn();
      }, delay);
  }


  function getAudioContext() {
    if (
      !audioContextRef.current ||
      audioContextRef.current
        .state === "closed"
    ) {
      audioContextRef.current =
        new AudioContext();

      /*
       * Nodes from an old AudioContext
       * cannot be reused.
       */
      analyserRef.current =
        null;

      micSourceRef.current =
        null;
    }

    return audioContextRef.current;
  }


  async function unlockAudio() {
    const context =
      getAudioContext();

    if (
      context.state ===
      "suspended"
    ) {
      await context.resume();
    }

    return context;
  }


  function stopCurrentAudio() {
    const source =
      audioSourceRef.current;

    if (!source) {
      return;
    }

    /*
     * Remove the callback first.
     *
     * Otherwise manually stopping audio
     * could accidentally trigger another
     * automatic microphone turn.
     */
    source.onended = null;

    audioSourceRef.current =
      null;

    try {
      source.stop();
    } catch {
      // Already finished.
    }

    try {
      source.disconnect();
    } catch {
      // Already disconnected.
    }
  }


  function stopVad() {
    if (
      vadFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        vadFrameRef.current
      );

      vadFrameRef.current =
        null;
    }
  }


  function setMicrophoneEnabled(
    enabled: boolean
  ) {
    const stream =
      streamRef.current;

    if (!stream) {
      return;
    }

    stream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled = enabled;
      });
  }


  function releaseMicrophone() {
    shouldProcessRecordingRef.current =
      false;

    speechDetectedRef.current =
      false;

    stopVad();

    const recorder =
      mediaRecorderRef.current;

    mediaRecorderRef.current =
      null;

    if (
      recorder &&
      recorder.state !==
      "inactive"
    ) {
      /*
       * Prevent recorder cleanup from
       * starting another AI request.
       */
      recorder.onstop = null;

      try {
        recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }

    if (
      micSourceRef.current
    ) {
      try {
        micSourceRef.current.disconnect();
      } catch {
        // Already disconnected.
      }

      micSourceRef.current =
        null;
    }

    analyserRef.current =
      null;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current =
        null;
    }
  }


  async function ensureMicrophone() {
    let stream =
      streamRef.current;

    const existingTrack =
      stream
        ?.getAudioTracks()
        .find(
          (track) =>
            track.readyState ===
            "live"
        );

    if (!stream || !existingTrack) {
      stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          });

      if (
        !callActiveRef.current ||
        endingRef.current
      ) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        throw new Error(
          "Call ended."
        );
      }

      streamRef.current =
        stream;
    }

    const context =
      getAudioContext();

    if (
      !micSourceRef.current ||
      !analyserRef.current
    ) {
      const source =
        context
          .createMediaStreamSource(
            stream
          );

      const analyser =
        context.createAnalyser();

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant =
        0.15;

      source.connect(analyser);

      micSourceRef.current =
        source;

      analyserRef.current =
        analyser;
    }

    return stream;
  }


  async function readApiError(
    response: Response
  ) {
    try {
      const data =
        await response.json();

      if (
        typeof data.detail ===
        "string"
      ) {
        return data.detail;
      }

      if (
        typeof data.message ===
        "string"
      ) {
        return data.message;
      }

      return `Request failed (${response.status})`;
    } catch {
      return `Request failed (${response.status})`;
    }
  }


  async function sendAudioToWhisper(
    audioBlob: Blob,
    extension: string,
    signal: AbortSignal
  ) {
    setVoiceState(
      "thinking"
    );

    setVoiceError(null);

    const formData =
      new FormData();

    formData.append(
      "audio",
      audioBlob,
      `voice-call.${extension}`
    );

    const response =
      await fetch(
        `${apiBase}/api/stt`,
        {
          method: "POST",
          body: formData,
          signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response
        )
      );
    }

    const data =
      await response.json();

    const text =
      typeof data.text ===
        "string"
        ? data.text.trim()
        : "";

    if (!text) {
      throw new Error(
        "No speech was detected."
      );
    }

    return text;
  }

  async function streamVoiceReply(
    transcript: string,
    signal: AbortSignal
  ) {
    let fullReply = "";
    let sentenceBuffer = "";

    /*
     * This is the important latency change.
     *
     * Qwen continues generating while Fish
     * prepares and plays completed sentences.
     *
     * Preparation:
     * sentence 1 -> Fish
     * sentence 2 -> Fish while sentence 1 plays
     *
     * Playback:
     * sentence 1 -> sentence 2 -> sentence 3
     */
    const queue =
      createSequentialPrefetchQueue<
        string,
        AudioBuffer
      >(
        async (sentence) => {
          return await prepareSpeechSegment(
            sentence,
            signal
          );
        },

        async (audioBuffer) => {
          await playPreparedAudio(
            audioBuffer
          );
        }
      );

    function queueSentence(
      sentence: string
    ) {
      const cleaned =
        sentence.trim();

      if (!cleaned) {
        return;
      }

      console.log(
        "[voice] TTS queued:",
        cleaned
      );

      /*
       * This returns immediately.
       *
       * We do NOT wait for Fish here,
       * so Qwen can keep streaming.
       */
      queue.enqueue(
        cleaned
      );
    }

    console.log(
      "[voice] Qwen stream started"
    );

    await streamChat(
      transcript,
      historyRef.current.slice(-6),
      {
        onMeta: (
          provider,
          knowledgeUsed
        ) => {
          console.log(
            "[voice] Qwen stream meta:",
            {
              provider,
              knowledgeUsed,
            }
          );
        },

        onToken: (token) => {
          fullReply += token;
          sentenceBuffer += token;

          const result =
            takeSpeakableSegments(
              sentenceBuffer,
              false
            );

          sentenceBuffer =
            result.remainder;

          for (
            const sentence of
            result.segments
          ) {
            console.log(
              "[voice] sentence ready:",
              sentence
            );

            /*
             * THIS is where Fish now
             * starts before Qwen has
             * finished the reply.
             */
            queueSentence(
              sentence
            );
          }
        },
      },
      {
        channel: "voice",
        signal,
      }
    );

    /*
     * Flush any final text that Qwen
     * produced without punctuation.
     */
    const finalResult =
      takeSpeakableSegments(
        sentenceBuffer,
        true
      );

    for (
      const sentence of
      finalResult.segments
    ) {
      console.log(
        "[voice] final sentence ready:",
        sentence
      );

      queueSentence(
        sentence
      );
    }

    const reply =
      fullReply.trim();

    if (!reply) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    console.log(
      "[voice] Qwen stream finished"
    );

    /*
     * Qwen may be finished while Fish
     * sentence 2/3 is still playing.
     *
     * Wait only for the remaining
     * queued audio here.
     */
    console.log(
      "[voice] waiting for audio queue"
    );

    await queue.finish();

    console.log(
      "[voice] audio queue finished"
    );

    return reply;
  }

  async function sendTranscriptToAI(
    transcript: string,
    signal: AbortSignal
  ) {
    const response =
      await fetch(
        `${apiBase}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message:
              transcript,

            /*
             * Keep voice context small
             * and consistent with the
             * optimized backend.
             */
            history:
              historyRef.current.slice(
                -6
              ),
          }),
          signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response
        )
      );
    }

    const data =
      await response.json();

    const reply =
      typeof data.reply ===
        "string"
        ? data.reply.trim()
        : "";

    if (!reply) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    return reply;
  }

  async function prepareSpeechSegment(
    text: string,
    signal: AbortSignal
  ): Promise<AudioBuffer> {
    console.log(
      "[voice] preparing Fish sentence:",
      text
    );

    const response =
      await fetch(
        `${apiBase}/api/tts`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            text,
          }),
          signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response
        )
      );
    }

    const context =
      await unlockAudio();

    const audioData =
      await response.arrayBuffer();

    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      throw new Error(
        "Call ended."
      );
    }

    const audioBuffer =
      await context.decodeAudioData(
        audioData
      );

    console.log(
      "[voice] Fish sentence ready:",
      text
    );

    return audioBuffer;
  }


  async function playPreparedAudio(
    audioBuffer: AudioBuffer
  ): Promise<void> {
    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      return;
    }

    const context =
      await unlockAudio();

    if (
      context.state !== "running"
    ) {
      throw new Error(
        "Browser audio is paused. Press RETRY once to enable call audio."
      );
    }

    /*
     * While AI speech is playing,
     * prevent it from hearing itself.
     */
    setMicrophoneEnabled(
      false
    );

    setVoiceState(
      "speaking"
    );

    return await new Promise<void>(
      (resolve, reject) => {
        const source =
          context.createBufferSource();

        source.buffer =
          audioBuffer;

        source.connect(
          context.destination
        );

        audioSourceRef.current =
          source;

        source.onended = () => {
          if (
            audioSourceRef.current ===
            source
          ) {
            audioSourceRef.current =
              null;
          }

          try {
            source.disconnect();
          } catch {
            // Already disconnected.
          }

          resolve();
        };

        try {
          source.start(0);
        } catch (error) {
          reject(error);
        }
      }
    );
  }

  async function speakText(
    text: string,
    signal: AbortSignal
  ) {
    const response =
      await fetch(
        `${apiBase}/api/tts`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            text,
          }),
          signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response
        )
      );
    }

    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      return;
    }

    const context =
      await unlockAudio();

    if (
      context.state !==
      "running"
    ) {
      throw new Error(
        "Browser audio is paused. Press RETRY once to enable call audio."
      );
    }

    stopCurrentAudio();

    const audioData =
      await response.arrayBuffer();

    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      return;
    }

    const audioBuffer =
      await context
        .decodeAudioData(
          audioData
        );

    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      return;
    }

    const source =
      context
        .createBufferSource();

    source.buffer =
      audioBuffer;

    source.connect(
      context.destination
    );

    audioSourceRef.current =
      source;

    /*
     * The microphone stays disabled
     * while AI audio plays.
     *
     * This prevents the AI from
     * hearing its own Fish Audio
     * response through the speakers.
     */
    setMicrophoneEnabled(
      false
    );

    setVoiceState(
      "speaking"
    );

    source.onended = () => {
      if (
        audioSourceRef.current !==
        source
      ) {
        return;
      }

      audioSourceRef.current =
        null;

      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }

      processingRef.current =
        false;

      if (
        !callActiveRef.current ||
        endingRef.current
      ) {
        return;
      }

      if (
        mutedRef.current
      ) {
        setVoiceState(
          "muted"
        );

        return;
      }

      /*
       * AI finished speaking.
       * Automatically listen again.
       */
      scheduleListening();
    };

    source.start(0);
  }


  async function processRecording(
    audioBlob: Blob,
    extension: string
  ) {
    if (
      !callActiveRef.current ||
      endingRef.current
    ) {
      processingRef.current =
        false;

      return;
    }

    const controller =
      new AbortController();

    currentRequestRef.current =
      controller;

    try {
      console.log(
        "[voice] sending audio to Whisper"
      );

      const transcript =
        await sendAudioToWhisper(
          audioBlob,
          extension,
          controller.signal
        );

      if (
        !callActiveRef.current
      ) {
        return;
      }

      console.log(
        "[voice] transcript:",
        transcript
      );

      setLatestTranscript(
        transcript
      );

      console.log(
        "[voice] sending transcript to AI"
      );

      const reply =
        await streamVoiceReply(
          transcript,
          controller.signal
        );

      if (
        !callActiveRef.current
      ) {
        return;
      }

      console.log(
        "[voice] AI reply:",
        reply
      );

      /*
       * Update history synchronously
       * in the ref so the next automatic
       * voice turn immediately sees it.
       */
      const nextHistory: VoiceTurn[] = [
        ...historyRef.current,
        {
          role: "user",
          content: transcript,
        },
        {
          role: "assistant",
          content: reply,
        },
      ];

      historyRef.current =
        nextHistory.slice(-6);

      /*
       * streamVoiceReply() has already
       * generated AND played all Fish
       * sentence audio by this point.
       */
      console.log(
        "[voice] streamed voice reply complete"
      );

      currentRequestRef.current =
        null;

      processingRef.current =
        false;

      if (
        !callActiveRef.current ||
        endingRef.current
      ) {
        return;
      }

      if (
        mutedRef.current
      ) {
        setVoiceState(
          "muted"
        );

        return;
      }

      /*
       * Entire queued reply has finished.
       * Start hands-free listening again.
       */
      scheduleListening();

      currentRequestRef.current =
        null;

      /*
       * Do NOT set processing=false here.
       *
       * The turn is still active while
       * Fish Audio is speaking.
       *
       * source.onended handles that.
       */
    } catch (error) {
      currentRequestRef.current =
        null;

      if (
        !callActiveRef.current ||
        endingRef.current
      ) {
        processingRef.current =
          false;

        return;
      }

      if (
        error instanceof DOMException &&
        error.name ===
        "AbortError"
      ) {
        processingRef.current =
          false;

        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong during the call.";

      /*
       * VAD should prevent almost all
       * empty recordings, but Whisper can
       * occasionally reject one anyway.
       *
       * Don't expose an ugly error.
       * Just listen again automatically.
       */
      if (
        message
          .toLowerCase()
          .includes(
            "no speech was detected"
          )
      ) {
        console.log(
          "[voice] Whisper found no speech; listening again"
        );

        processingRef.current =
          false;

        setVoiceError(null);

        if (
          mutedRef.current
        ) {
          setVoiceState(
            "muted"
          );
        } else {
          scheduleListening(
            150
          );
        }

        return;
      }

      console.error(
        "Voice call error:",
        error
      );

      processingRef.current =
        false;

      setVoiceState(
        "error"
      );

      setVoiceError(
        message
      );
    }
  }


  function stopCurrentTurn(
    shouldProcess: boolean
  ) {
    stopVad();

    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state !==
      "recording"
    ) {
      return;
    }

    shouldProcessRecordingRef.current =
      shouldProcess;

    if (shouldProcess) {
      processingRef.current =
        true;

      setVoiceState(
        "thinking"
      );
    }

    try {
      recorder.stop();
    } catch (error) {
      console.error(
        "Recorder stop error:",
        error
      );
    }
  }


  function cancelListeningTurn() {
    shouldProcessRecordingRef.current =
      false;

    speechDetectedRef.current =
      false;

    stopVad();

    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state ===
      "recording"
    ) {
      try {
        recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }
  }


  function startVoiceActivityDetection(
    recorder: MediaRecorder
  ) {
    stopVad();

    const analyser =
      analyserRef.current;

    if (!analyser) {
      throw new Error(
        "Microphone analyser is not available."
      );
    }

    const samples =
      new Float32Array(
        analyser.fftSize
      );

    let speechDetected =
      false;

    let speechStartedAt =
      0;

    let lastVoiceAt =
      0;

    let voicedMs = 0;

    let previousFrameAt =
      performance.now();

    /*
     * Starting noise-floor estimate.
     * It adapts while the user is silent.
     */
    let noiseFloor =
      0.006;

    speechDetectedRef.current =
      false;

    const tick = () => {
      if (
        !callActiveRef.current ||
        endingRef.current ||
        mutedRef.current ||
        mediaRecorderRef.current !==
        recorder ||
        recorder.state !==
        "recording"
      ) {
        vadFrameRef.current =
          null;

        return;
      }

      const now =
        performance.now();

      const frameDuration =
        Math.min(
          now -
          previousFrameAt,
          100
        );

      previousFrameAt =
        now;

      analyser
        .getFloatTimeDomainData(
          samples
        );

      let sumSquares = 0;

      for (
        let i = 0;
        i < samples.length;
        i += 1
      ) {
        const sample =
          samples[i];

        sumSquares +=
          sample * sample;
      }

      const rms =
        Math.sqrt(
          sumSquares /
          samples.length
        );

      if (!speechDetected) {
        /*
         * Adapt background-noise level
         * while the user is silent.
         *
         * Ignore unusually loud spikes
         * so one click doesn't permanently
         * raise the threshold.
         */
        if (rms < 0.05) {
          noiseFloor =
            noiseFloor *
            0.96 +
            rms * 0.04;
        }

        const startThreshold =
          Math.min(
            MAX_START_THRESHOLD,
            Math.max(
              MIN_START_RMS,
              noiseFloor *
              START_THRESHOLD_MULTIPLIER
            )
          );

        if (
          rms >=
          startThreshold
        ) {
          speechDetected =
            true;

          speechDetectedRef.current =
            true;

          speechStartedAt =
            now;

          lastVoiceAt =
            now;

          voicedMs +=
            frameDuration;

          console.log(
            "[voice] speech detected"
          );

          setVoiceState(
            "user-speaking"
          );
        }
      } else {
        const continueThreshold =
          Math.min(
            MAX_CONTINUE_THRESHOLD,
            Math.max(
              MIN_CONTINUE_RMS,
              noiseFloor *
              CONTINUE_THRESHOLD_MULTIPLIER
            )
          );

        if (
          rms >=
          continueThreshold
        ) {
          lastVoiceAt =
            now;

          voicedMs +=
            frameDuration;
        }

        const silenceDuration =
          now - lastVoiceAt;

        const utteranceDuration =
          now -
          speechStartedAt;

        /*
         * Safety limit so one extremely
         * long turn cannot record forever.
         */
        if (
          utteranceDuration >=
          MAX_UTTERANCE_MS
        ) {
          console.log(
            "[voice] max utterance reached; submitting"
          );

          stopCurrentTurn(
            true
          );

          return;
        }

        if (
          silenceDuration >=
          SILENCE_TO_SEND_MS
        ) {
          if (
            voicedMs >=
            MIN_VOICED_MS
          ) {
            console.log(
              "[voice] silence detected; submitting turn"
            );

            stopCurrentTurn(
              true
            );

            return;
          }

          /*
           * Very short noise/click.
           *
           * Reset instead of sending
           * garbage to Whisper.
           */
          speechDetected =
            false;

          speechDetectedRef.current =
            false;

          speechStartedAt =
            0;

          lastVoiceAt =
            0;

          voicedMs = 0;

          setVoiceState(
            "listening"
          );
        }
      }

      vadFrameRef.current =
        requestAnimationFrame(
          tick
        );
    };

    vadFrameRef.current =
      requestAnimationFrame(
        tick
      );
  }


  async function startListeningTurn() {
    if (
      isVideo ||
      !callActiveRef.current ||
      endingRef.current ||
      mutedRef.current ||
      processingRef.current ||
      startingListeningRef.current
    ) {
      return;
    }

    const existingRecorder =
      mediaRecorderRef.current;

    if (
      existingRecorder &&
      existingRecorder.state ===
      "recording"
    ) {
      return;
    }

    startingListeningRef.current =
      true;

    try {
      setVoiceError(null);

      const stream =
        await ensureMicrophone();

      if (
        !callActiveRef.current ||
        endingRef.current ||
        mutedRef.current
      ) {
        return;
      }

      const context =
        await unlockAudio();

      /*
       * If autoplay policy blocks the first
       * automatic audio setup, RETRY gives
       * the browser a direct user gesture.
       */
      if (
        context.state !==
        "running"
      ) {
        throw new Error(
          "Browser audio is paused. Press RETRY once to enable the call."
        );
      }

      setMicrophoneEnabled(
        true
      );

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      const mimeType =
        supportedTypes.find(
          (type) =>
            MediaRecorder
              .isTypeSupported(
                type
              )
        );

      const recorder =
        mimeType
          ? new MediaRecorder(
            stream,
            {
              mimeType,
            }
          )
          : new MediaRecorder(
            stream
          );

      mediaRecorderRef.current =
        recorder;

      audioChunksRef.current =
        [];

      speechDetectedRef.current =
        false;

      shouldProcessRecordingRef.current =
        false;

      recorder.ondataavailable = (event) => {
        if (event.data.size <= 0) {
          return;
        }

        /*
         * Keep every chunk from this MediaRecorder session.
         *
         * IMPORTANT:
         * The first WebM chunk contains the EBML/container
         * header that FFmpeg needs. Removing early chunks
         * makes the resulting WebM invalid.
         */
        audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopVad();

        const shouldProcess =
          shouldProcessRecordingRef.current;

        shouldProcessRecordingRef.current =
          false;

        const finalMimeType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const extension =
          finalMimeType.includes(
            "mp4"
          )
            ? "m4a"
            : "webm";

        const audioBlob =
          new Blob(
            audioChunksRef.current,
            {
              type:
                finalMimeType,
            }
          );

        audioChunksRef.current =
          [];

        speechDetectedRef.current =
          false;

        if (
          mediaRecorderRef.current ===
          recorder
        ) {
          mediaRecorderRef.current =
            null;
        }

        /*
         * Stop collecting the mic while
         * Whisper/Qwen/Fish are working.
         *
         * We keep the MediaStream alive,
         * but disable the audio track.
         */
        setMicrophoneEnabled(
          false
        );

        if (
          shouldProcess &&
          audioBlob.size > 0 &&
          callActiveRef.current &&
          !endingRef.current
        ) {
          void processRecording(
            audioBlob,
            extension
          );

          return;
        }

        processingRef.current =
          false;

        if (
          callActiveRef.current &&
          !endingRef.current &&
          !mutedRef.current
        ) {
          scheduleListening(
            100
          );
        }
      };

      recorder.onerror = (
        event
      ) => {
        console.error(
          "MediaRecorder error:",
          event
        );

        stopVad();

        processingRef.current =
          false;

        setVoiceState(
          "error"
        );

        setVoiceError(
          "The microphone recording stopped unexpectedly. Press RETRY."
        );
      };

      recorder.start(
        RECORDING_TIMESLICE_MS
      );

      setVoiceState(
        "listening"
      );

      startVoiceActivityDetection(
        recorder
      );

      console.log(
        "[voice] hands-free listening started"
      );
    } catch (error) {
      if (
        !callActiveRef.current ||
        endingRef.current
      ) {
        return;
      }

      console.error(
        "Microphone startup error:",
        error
      );

      processingRef.current =
        false;

      setVoiceState(
        "error"
      );

      setVoiceError(
        error instanceof Error
          ? error.message
          : "Microphone permission was denied or the microphone could not be opened."
      );
    } finally {
      startingListeningRef.current =
        false;
    }
  }


  async function handleVoiceControl() {
    /*
     * Error mode becomes RETRY.
     *
     * This is also useful if the browser
     * requires a direct interaction before
     * allowing Web Audio playback.
     */
    if (
      voiceState ===
      "error"
    ) {
      mutedRef.current =
        false;

      setMuted(false);

      setVoiceError(null);

      try {
        await unlockAudio();
      } catch {
        // startListeningTurn will display
        // a useful error if needed.
      }

      await startListeningTurn();

      return;
    }

    /*
     * UNMUTE
     */
    if (mutedRef.current) {
      mutedRef.current =
        false;

      setMuted(false);

      setVoiceError(null);

      setMicrophoneEnabled(
        true
      );

      try {
        await unlockAudio();
      } catch {
        // Handled below if listening fails.
      }

      if (
        !processingRef.current &&
        !audioSourceRef.current
      ) {
        await startListeningTurn();
      }

      return;
    }

    /*
     * MUTE
     */
    mutedRef.current =
      true;

    setMuted(true);

    cancelListenTimer();

    cancelListeningTurn();

    setMicrophoneEnabled(
      false
    );

    if (
      voiceState !==
      "thinking" &&
      voiceState !==
      "speaking"
    ) {
      setVoiceState(
        "muted"
      );
    }
  }


  async function leave() {
    if (
      endingRef.current
    ) {
      return;
    }

    endingRef.current =
      true;

    callActiveRef.current =
      false;

    setEnding(true);

    cancelListenTimer();

    currentRequestRef.current?.abort();

    currentRequestRef.current =
      null;

    processingRef.current =
      false;

    releaseMicrophone();

    stopCurrentAudio();

    const context =
      audioContextRef.current;

    audioContextRef.current =
      null;

    if (
      context &&
      context.state !==
      "closed"
    ) {
      try {
        await context.close();
      } catch {
        // Already closing/closed.
      }
    }

    try {
      if (
        session.conversation_id
      ) {
        await endCall(
          session.conversation_id
        );
      }
    } catch {
      /*
       * Close locally even if provider
       * cleanup fails.
       */
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
      onPointerDown={() => {
        /*
         * Any normal interaction with
         * the call also helps satisfy
         * browser audio-unlock policies.
         */
        if (!isVideo) {
          void unlockAudio();
        }
      }}
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
            src={
              session.conversation_url
            }
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
              }).map(
                (_, i) => (
                  <span
                    key={i}
                    style={{
                      animationDelay: `${i * 45
                        }ms`,
                    }}
                  />
                )
              )}
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
            {formatTime(
              seconds
            )}
          </div>
        </div>

        <div className="call-bottom">
          {!isVideo &&
            latestTranscript && (
              <p className="demo-note">
                You:{" "}
                {
                  latestTranscript
                }
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
                className={`round-control ${muted
                  ? "active"
                  : ""
                  }`}
                onClick={() => {
                  void handleVoiceControl();
                }}
                disabled={ending}
                aria-pressed={
                  muted
                }
              >
                {voiceState ===
                  "error"
                  ? "RETRY"
                  : muted
                    ? "UNMUTE"
                    : "MUTE"}
              </button>
            )}

            {isVideo && (
              <button
                className={`round-control ${!camera
                  ? "active"
                  : ""
                  }`}
                onClick={() => {
                  setCamera(
                    !camera
                  );
                }}
              >
                {camera
                  ? "CAM"
                  : "OFF"}
              </button>
            )}

            <button
              className="end-control"
              onClick={() => {
                void leave();
              }}
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