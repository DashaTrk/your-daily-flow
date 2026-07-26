import { useRef, useState } from "react";
import { Mic, Send, Square, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function ChatComposer({ onSend, disabled }: { onSend: (text: string) => Promise<void> | void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcribe = useServerFn(transcribeAudio);

  async function submit() {
    const t = value.trim();
    if (!t || disabled) return;
    setValue("");
    await onSend(t);
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];
      node.onaudioprocess = e => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node); node.connect(ctx.destination);
      sourceRef.current = source; nodeRef.current = node;
      setRecording(true);
    } catch {
      toast.error("Нет доступа к микрофону");
    }
  }

  async function stopRec() {
    setRecording(false);
    const ctx = ctxRef.current!;
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    const blob = encodeWav(chunksRef.current, ctx.sampleRate);
    await ctx.close();
    if (blob.size < 2048) { toast.error("Слишком короткая запись"); return; }
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      const res = await transcribe({ data: fd });
      setValue(v => (v ? v + " " : "") + res.text);
    } catch (e: any) {
      toast.error(e.message ?? "Не удалось распознать");
    } finally { setTranscribing(false); }
  }

  return (
    <div className="glass rounded-2xl p-2 flex items-end gap-2">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Введите или наговорите… «завтра в 15:00 встреча с Аней»"
        rows={1}
        disabled={disabled || transcribing}
        className="flex-1 bg-transparent resize-none px-3 py-2.5 text-sm outline-none max-h-40 min-h-[42px] placeholder:text-muted-foreground/60"
      />
      <button
        type="button"
        onClick={recording ? stopRec : startRec}
        disabled={disabled || transcribing}
        className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition ${
          recording ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-surface-2 hover:bg-surface text-foreground"
        }`}
        title={recording ? "Остановить запись" : "Голосовой ввод"}
      >
        {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={disabled || transcribing || !value.trim()}
        className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition glow"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const flat = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { flat.set(c, off); off += c.length; }
  // Downsample to 16k mono
  const target = 16000;
  const ratio = sampleRate / target;
  const outLen = Math.floor(flat.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = flat[Math.floor(i * ratio)];
    const v = Math.max(-1, Math.min(1, s));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVE"); writeStr(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, target, true); view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, "data"); view.setUint32(40, out.length * 2, true);
  const bytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < out.length; i++) {
    bytes[i * 2] = out[i] & 0xff;
    bytes[i * 2 + 1] = (out[i] >> 8) & 0xff;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
