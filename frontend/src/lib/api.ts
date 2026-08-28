export type Role =
  | "user"
  | "assistant";

export type ChatTurn = {
  role: Role;
  content: string;
};

export type Provider =
  | "ollama"
  | "openai"
  | "demo";

export type ChatReply = {
  reply: string;
  provider: Provider;
  knowledge_used?: number;
};

export type CallMode =
  | "voice"
  | "video";

export type CallSession = {
  mode: CallMode;
  demo: boolean;
  conversation_id: string | null;
  conversation_url: string | null;
  message: string | null;
};

export type ChatChannel =
  | "text"
  | "voice";

type StreamChatHandlers = {
  onToken: (token: string) => void;

  onMeta?: (
    provider: Provider,
    knowledgeUsed: number
  ) => void;
};

type StreamChatOptions = {
  channel?: ChatChannel;
  signal?: AbortSignal;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";


async function readError(
  res: Response
): Promise<string> {
  try {
    const body =
      await res.json();

    return (
      body.detail ||
      body.message ||
      `Request failed (${res.status})`
    );
  } catch {
    return `Request failed (${res.status})`;
  }
}


export async function sendChat(
  message: string,
  history: ChatTurn[]
): Promise<ChatReply> {
  const res =
    await fetch(
      `${API_BASE}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          message,
          history,
          channel: "text",
        }),
      }
    );

  if (!res.ok) {
    throw new Error(
      await readError(res)
    );
  }

  return res.json();
}


export async function streamChat(
  message: string,
  history: ChatTurn[],
  handlers: StreamChatHandlers,
  options: StreamChatOptions = {}
): Promise<void> {
  const res =
    await fetch(
      `${API_BASE}/api/chat/stream`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          message,
          history,

          channel:
            options.channel ??
            "text",
        }),

        signal:
          options.signal,
      }
    );

  if (!res.ok) {
    throw new Error(
      await readError(res)
    );
  }

  if (!res.body) {
    throw new Error(
      "Streaming response is not available."
    );
  }

  const reader =
    res.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  function processLine(
    rawLine: string
  ) {
    const line =
      rawLine.trim();

    if (!line) {
      return;
    }

    const event =
      JSON.parse(line);

    if (
      event.type ===
      "meta"
    ) {
      handlers.onMeta?.(
        event.provider as Provider,
        event.knowledge_used ??
        0
      );

      return;
    }

    if (
      event.type ===
      "token" &&
      typeof event.content ===
      "string"
    ) {
      handlers.onToken(
        event.content
      );

      return;
    }

    if (
      event.type ===
      "error"
    ) {
      throw new Error(
        event.detail ||
        "AI stream failed."
      );
    }

    /*
     * "done" does not require
     * any special handling here.
     *
     * The HTTP stream will finish
     * immediately afterwards and
     * streamChat() will resolve.
     */
  }

  while (true) {
    const {
      done,
      value,
    } =
      await reader.read();

    if (value) {
      buffer +=
        decoder.decode(
          value,
          {
            stream:
              !done,
          }
        );
    }

    let newlineIndex =
      buffer.indexOf(
        "\n"
      );

    while (
      newlineIndex !== -1
    ) {
      const line =
        buffer.slice(
          0,
          newlineIndex
        );

      buffer =
        buffer.slice(
          newlineIndex + 1
        );

      processLine(line);

      newlineIndex =
        buffer.indexOf(
          "\n"
        );
    }

    if (done) {
      break;
    }
  }

  const remainder =
    buffer.trim();

  if (remainder) {
    processLine(
      remainder
    );
  }
}


export async function startCall(
  mode: CallMode
): Promise<CallSession> {
  const res =
    await fetch(
      `${API_BASE}/api/calls/session`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          mode,
        }),
      }
    );

  if (!res.ok) {
    throw new Error(
      await readError(res)
    );
  }

  return res.json();
}


export async function endCall(
  conversationId: string
): Promise<void> {
  const res =
    await fetch(
      `${API_BASE}/api/calls/${encodeURIComponent(
        conversationId
      )}/end`,
      {
        method: "POST",
      }
    );

  if (!res.ok) {
    throw new Error(
      await readError(res)
    );
  }
}


export async function requestSpeech(
  text: string
): Promise<{
  audioUrl?: string;
  demo: boolean;
}> {
  const res =
    await fetch(
      `${API_BASE}/api/tts`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          text,
        }),
      }
    );

  if (!res.ok) {
    throw new Error(
      await readError(res)
    );
  }

  const contentType =
    res.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "audio/"
    )
  ) {
    const blob =
      await res.blob();

    return {
      audioUrl:
        URL.createObjectURL(
          blob
        ),

      demo: false,
    };
  }

  return {
    demo: true,
  };
}