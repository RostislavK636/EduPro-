export interface TTSProvider {
  synthesize(
    text: string,
    language: string,
  ): Promise<{ audio: Uint8Array; mimeType: string }>;
}
export interface VideoAssemblyProvider {
  assemble(
    scenes: { image: Uint8Array; duration: number; subtitle: string }[],
    audio?: Uint8Array,
  ): Promise<Uint8Array>;
}
export class OpenAICompatibleTTSProvider implements TTSProvider {
  constructor(
    private options: {
      baseUrl: string;
      apiKey: string;
      model: string;
      voice: string;
    },
  ) {}
  async synthesize(text: string, language: string) {
    const response = await fetch(
      this.options.baseUrl.replace(/\/$/, "") + "/audio/speech",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          voice: this.options.voice,
          input: text.slice(0, 4096),
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) throw new Error(`TTS provider error: ${response.status}`);
    return {
      audio: new Uint8Array(await response.arrayBuffer()),
      mimeType: "audio/mpeg",
    };
  }
}
// No video provider is selected until an actual encoder is configured.
export class LessonVideoPipeline {
  constructor(
    private tts: TTSProvider,
    private video: VideoAssemblyProvider,
  ) {}
  async render(
    scenes: { image: Uint8Array; duration: number; subtitle: string }[],
  ) {
    const audio = await this.tts.synthesize(
      scenes.map((s) => s.subtitle).join("\n"),
      "ru-RU",
    );
    return this.video.assemble(scenes, audio.audio);
  }
}
