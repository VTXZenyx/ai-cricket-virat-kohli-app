export type SegmentResult = {
    segments: string[];
    remainder: string;
};

export function takeSpeakableSegments(
    buffer: string,
    final = false
): SegmentResult {
    const segments: string[] = [];

    let start = 0;

    for (
        let i = 0;
        i < buffer.length;
        i += 1
    ) {
        const char = buffer[i];

        const isSentenceEnd =
            char === "." ||
            char === "?" ||
            char === "!";

        if (!isSentenceEnd) {
            continue;
        }

        const next =
            buffer[i + 1];

        /*
         * Accept punctuation as a sentence boundary
         * if:
         *
         * 1. it is currently the end of the streamed buffer, or
         * 2. the next character is whitespace.
         *
         * This works well with Ollama because punctuation
         * often arrives as its own token.
         */
        if (
            next === undefined ||
            /\s/.test(next)
        ) {
            const sentence =
                buffer
                    .slice(
                        start,
                        i + 1
                    )
                    .trim();

            if (sentence) {
                segments.push(
                    sentence
                );
            }

            start = i + 1;
        }
    }

    let remainder =
        buffer
            .slice(start)
            .trimStart();

    /*
     * When Qwen says "done", there may still be
     * useful text without final punctuation.
     *
     * We still want Fish to speak it.
     */
    if (
        final &&
        remainder.trim()
    ) {
        segments.push(
            remainder.trim()
        );

        remainder = "";
    }

    return {
        segments,
        remainder,
    };
}

export type SequentialPrefetchQueue<
    TInput,
    TPrepared
> = {
    enqueue: (
        input: TInput
    ) => void;

    finish: () =>
        Promise<void>;
};


export function createSequentialPrefetchQueue<
    TInput,
    TPrepared
>(
    prepare: (
        input: TInput
    ) => Promise<TPrepared>,

    play: (
        prepared: TPrepared
    ) => Promise<void>
): SequentialPrefetchQueue<
    TInput,
    TPrepared
> {
    /*
     * TTS preparation is kept in order.
     *
     * Sentence 2 can begin preparation
     * as soon as sentence 1 has finished
     * preparing. It does NOT need to wait
     * for sentence 1 to finish playing.
     */
    let preparationTail:
        Promise<void> =
        Promise.resolve();

    /*
     * Playback stays strictly sequential.
     *
     * This prevents sentence 2 from
     * speaking over sentence 1.
     */
    let playbackTail:
        Promise<void> =
        Promise.resolve();


    function enqueue(
        input: TInput
    ) {
        const prepared =
            preparationTail.then(
                () =>
                    prepare(input)
            );

        /*
         * Allow preparation of the next
         * sentence to continue independently
         * of playback.
         */
        preparationTail =
            prepared.then(
                () => undefined
            );

        /*
         * But audio playback itself remains
         * strictly ordered.
         */
        playbackTail =
            playbackTail.then(
                async () => {
                    const result =
                        await prepared;

                    await play(
                        result
                    );
                }
            );
    }


    async function finish() {
        await playbackTail;
    }


    return {
        enqueue,
        finish,
    };
}