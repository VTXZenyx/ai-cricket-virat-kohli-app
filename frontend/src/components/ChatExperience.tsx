"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ChatTurn,
  Provider,
  requestSpeech,
  streamChat,
} from "@/lib/api";


const starters = [
  "Set my game-day mindset",
  "Push me harder today",
  "Help me raise my standards",
  "Give me the discipline to stay consistent",
];


type Props = {
  initialPrompt?: string;
  onBack: () => void;
  onVoice: () => void;
  onVideo: () => void;
};


export function ChatExperience({
  initialPrompt = "",
  onBack,
  onVoice,
  onVideo,
}: Props) {
  const [
    messages,
    setMessages,
  ] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content:
        "You're in. Tell me what we're working on today — your game, your standards, your confidence, or something outside cricket.",
    },
  ]);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    provider,
    setProvider,
  ] = useState<Provider | null>(
    null
  );

  const [
    knowledgeUsed,
    setKnowledgeUsed,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const sentInitial =
    useRef(false);


  useEffect(() => {
    if (
      initialPrompt &&
      !sentInitial.current
    ) {
      sentInitial.current = true;

      void submit(
        initialPrompt
      );
    }
  }, [initialPrompt]);


  async function submit(
    raw?: string
  ) {
    const message =
      (raw ?? input).trim();

    if (
      !message ||
      sending
    ) {
      return;
    }

    /*
     * Keep the frontend history
     * consistent with the backend:
     * latest 6 messages.
     */
    const history =
      messages.slice(-6);

    /*
     * Add the user's message AND an empty
     * assistant message immediately.
     *
     * Streaming tokens will fill this
     * assistant message live.
     */
    setMessages(
      (current) => [
        ...current,
        {
          role: "user",
          content: message,
        },
        {
          role: "assistant",
          content: "",
        },
      ]
    );

    setInput("");
    setSending(true);
    setError(null);
    setKnowledgeUsed(0);

    try {
      await streamChat(
        message,
        history,
        {
          onMeta: (
            nextProvider,
            nextKnowledgeUsed
          ) => {
            setProvider(
              nextProvider
            );

            setKnowledgeUsed(
              nextKnowledgeUsed
            );
          },

          onToken: (
            token
          ) => {
            setMessages(
              (current) => {
                if (
                  current.length ===
                  0
                ) {
                  return current;
                }

                const next =
                  [...current];

                const lastIndex =
                  next.length - 1;

                const last =
                  next[lastIndex];

                if (
                  last.role !==
                  "assistant"
                ) {
                  return current;
                }

                next[lastIndex] = {
                  ...last,

                  content:
                    last.content +
                    token,
                };

                return next;
              }
            );
          },
        }
      );
    } catch (err) {
      /*
       * If streaming failed before any text
       * arrived, remove the empty assistant
       * placeholder.
       */
      setMessages(
        (current) => {
          const last =
            current[
            current.length - 1
            ];

          if (
            last?.role ===
            "assistant" &&
            !last.content
          ) {
            return current.slice(
              0,
              -1
            );
          }

          return current;
        }
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }


  async function speak(
    text: string
  ) {
    try {
      if (
        audioRef.current
      ) {
        audioRef.current.pause();
      }

      const result =
        await requestSpeech(
          text
        );

      if (result.audioUrl) {
        const audio =
          new Audio(
            result.audioUrl
          );

        audioRef.current =
          audio;

        await audio.play();

        return;
      }

      if (
        "speechSynthesis" in
        window
      ) {
        window
          .speechSynthesis
          .cancel();

        const utterance =
          new SpeechSynthesisUtterance(
            text
          );

        utterance.rate =
          0.98;

        utterance.pitch =
          0.92;

        window
          .speechSynthesis
          .speak(
            utterance
          );
      }
    } catch {
      /*
       * Optional voice playback
       * should never break chat.
       */
    }
  }


  function onSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    void submit();
  }


  return (
    <div className="chat-view">
      <div className="chat-toolbar">
        <button
          type="button"
          onClick={onBack}
        >
          ← Home
        </button>

        <div>
          <strong>
            AI Virat Kohli
          </strong>

          <span>
            fan-made mentor •
            online
          </span>
        </div>

        <div className="chat-call-actions">
          <button
            onClick={onVoice}
          >
            Voice
          </button>

          <button
            onClick={onVideo}
          >
            Video
          </button>
        </div>
      </div>

      <div
        className="messages"
        aria-live="polite"
      >
        {messages.map(
          (
            message,
            index
          ) => {
            const isLatest =
              index ===
              messages.length -
              1;

            const isStreaming =
              sending &&
              isLatest &&
              message.role ===
              "assistant";

            const isWaiting =
              isStreaming &&
              !message.content;

            return (
              <div
                key={`${message.role}-${index}`}
                className={`message-row message-row--${message.role}`}
              >
                {message.role ===
                  "assistant" && (
                    <div className="message-avatar">
                      18
                    </div>
                  )}

                <div
                  className={`bubble bubble--${message.role} ${isWaiting
                      ? "typing"
                      : ""
                    }`}
                >
                  {isWaiting ? (
                    <>
                      <span />
                      <span />
                      <span />
                    </>
                  ) : (
                    <>
                      {message.content
                        .split("\n")
                        .map(
                          (
                            line,
                            lineIndex
                          ) => (
                            <p
                              key={
                                lineIndex
                              }
                            >
                              {line || (
                                <>
                                  &nbsp;
                                </>
                              )}
                            </p>
                          )
                        )}

                      {message.role ===
                        "assistant" &&
                        message.content.trim() &&
                        !isStreaming && (
                          <button
                            className="listen-button"
                            onClick={() =>
                              void speak(
                                message.content
                              )
                            }
                          >
                            ▶ Listen
                          </button>
                        )}
                    </>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {messages.length <= 2 && (
        <div className="starters">
          {starters.map(
            (starter) => (
              <button
                key={starter}
                onClick={() =>
                  void submit(
                    starter
                  )
                }
              >
                {starter}
              </button>
            )
          )}
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <form
        className="composer"
        onSubmit={onSubmit}
      >
        <textarea
          value={input}
          onChange={(
            event
          ) =>
            setInput(
              event.target.value
            )
          }
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
              "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();

              void submit();
            }
          }}
          placeholder="Say it with intent…"
          rows={1}
          aria-label="Message AI Virat Kohli"
        />

        <button
          type="submit"
          className="send-button"
          disabled={
            sending ||
            !input.trim()
          }
          aria-label="Send message"
        >
          ↗
        </button>
      </form>

      <div className="chat-meta">
        <span>
          {provider ===
            "ollama"
            ? "Qwen3:8b • local"
            : provider ===
              "openai"
              ? "OpenAI connected"
              : provider ===
                "demo"
                ? "Demo mode"
                : "Ready"}
        </span>

        <span>
          {knowledgeUsed > 0
            ? `${knowledgeUsed} knowledge records used`
            : "Supabase context optional"}
        </span>
      </div>
    </div>
  );
}