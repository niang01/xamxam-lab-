"use client";
/**
 * Salle de réunion WebRTC d'un projet (maillage pair à pair) : audio, vidéo, partage d'écran.
 * Le média ne transite pas par la plateforme ; seule la signalisation (offres, réponses, candidats ICE) y passe.
 * Sans serveur TURN configuré, la connexion n'est garantie qu'au sein d'un même réseau (signalé).
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "./providers";
import { Btn, ErrorBox, Pill } from "./ui";
import { api, post } from "@/lib/client/api";

type Peer = { id: string; display_name: string };
type Signal = { id: number; from_peer: string; kind: "offer" | "answer" | "ice"; payload: Record<string, unknown> };

function Video({ stream, muted, label, testId }: { stream: MediaStream | null; muted?: boolean; label: string; testId?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <figure className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-black">
      <video ref={ref} data-testid={testId} autoPlay playsInline muted={muted} className="aspect-video w-full object-cover" />
      <figcaption className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{label}</figcaption>
    </figure>
  );
}

export function MeetingRoom({ projectId }: { projectId: string }) {
  const t = useT();
  const [joined, setJoined] = useState(false);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, { name: string; stream: MediaStream | null; state: string }>>({});
  const [mic, setMic] = useState(true); const [cam, setCam] = useState(true); const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const S = useRef<{ peer: string | null; pcs: Map<string, RTCPeerConnection>; pendingIce: Map<string, RTCIceCandidateInit[]>; after: number; ice: RTCIceServer[]; stream: MediaStream | null; timer: ReturnType<typeof setInterval> | null; names: Map<string, string> }>(
    { peer: null, pcs: new Map(), pendingIce: new Map(), after: 0, ice: [], stream: null, timer: null, names: new Map() });

  const send = (to: string, kind: Signal["kind"], payload: unknown) => post(`/api/rooms/${projectId}/signal`, { from: S.current.peer, to, kind, payload }).catch(() => undefined);

  function connection(id: string) {
    const s = S.current;
    let pc = s.pcs.get(id);
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: s.ice });
    s.pcs.set(id, pc);
    s.stream?.getTracks().forEach((tr) => pc!.addTrack(tr, s.stream!));
    pc.onicecandidate = (e) => { if (e.candidate) void send(id, "ice", e.candidate.toJSON() as Record<string, unknown>); };
    pc.ontrack = (e) => setRemotes((r) => ({ ...r, [id]: { name: s.names.get(id) ?? "?", stream: e.streams[0] ?? new MediaStream([e.track]), state: r[id]?.state ?? "connecting" } }));
    pc.onconnectionstatechange = () => setRemotes((r) => ({ ...r, [id]: { name: s.names.get(id) ?? "?", stream: r[id]?.stream ?? null, state: pc!.connectionState } }));
    setRemotes((r) => ({ ...r, [id]: r[id] ?? { name: s.names.get(id) ?? "?", stream: null, state: "connecting" } }));
    return pc;
  }
  async function flushIce(id: string) {
    const pc = S.current.pcs.get(id); const q = S.current.pendingIce.get(id) ?? [];
    if (!pc?.remoteDescription) return;
    S.current.pendingIce.delete(id);
    for (const c of q) await pc.addIceCandidate(c).catch(() => undefined);
  }
  function drop(id: string) {
    S.current.pcs.get(id)?.close(); S.current.pcs.delete(id);
    setRemotes((r) => { const n = { ...r }; delete n[id]; return n; });
  }

  async function join() {
    setErr(null); setNote(null);
    try {
      const cfg = await api<{ iceServers: RTCIceServer[]; note: string | null }>("/api/rtc/config");
      S.current.ice = cfg.iceServers;
      if (cfg.note) setNote(cfg.note);
      let stream: MediaStream | null = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); }
      catch { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); } catch { setNote(t("meet.noMedia")); } }
      S.current.stream = stream; setLocal(stream);
      const r = await post<{ peer_id: string; peers: Peer[] }>(`/api/rooms/${projectId}/join`, {});
      S.current.peer = r.peer_id;
      setJoined(true);
      // Le nouvel arrivant appelle les participants déjà présents.
      for (const p of r.peers) {
        S.current.names.set(p.id, p.display_name);
        const pc = connection(p.id);
        await pc.setLocalDescription(await pc.createOffer());
        await send(p.id, "offer", pc.localDescription!.toJSON() as unknown as Record<string, unknown>);
      }
      S.current.timer = setInterval(poll, 1000);
    } catch (e) { setErr(e); }
  }

  async function poll() {
    const s = S.current;
    if (!s.peer) return;
    try {
      const r = await api<{ peers: Peer[]; signals: Signal[] }>(`/api/rooms/${projectId}/signal?peer=${s.peer}&after=${s.after}`);
      for (const p of r.peers) s.names.set(p.id, p.display_name);
      for (const id of [...s.pcs.keys()]) if (!r.peers.some((p) => p.id === id)) drop(id);
      for (const sig of r.signals) {
        s.after = Math.max(s.after, sig.id);
        const id = sig.from_peer;
        if (sig.kind === "offer") {
          const pc = connection(id);
          await pc.setRemoteDescription(sig.payload as unknown as RTCSessionDescriptionInit);
          await pc.setLocalDescription(await pc.createAnswer());
          await send(id, "answer", pc.localDescription!.toJSON() as unknown as Record<string, unknown>);
          await flushIce(id);
        } else if (sig.kind === "answer") {
          const pc = s.pcs.get(id);
          if (pc && pc.signalingState === "have-local-offer") { await pc.setRemoteDescription(sig.payload as unknown as RTCSessionDescriptionInit); await flushIce(id); }
        } else {
          const pc = s.pcs.get(id);
          if (pc?.remoteDescription) await pc.addIceCandidate(sig.payload as RTCIceCandidateInit).catch(() => undefined);
          else s.pendingIce.set(id, [...(s.pendingIce.get(id) ?? []), sig.payload as RTCIceCandidateInit]);
        }
      }
    } catch (e) { setErr(e); }
  }

  async function leave() {
    const s = S.current;
    if (s.timer) clearInterval(s.timer);
    for (const id of [...s.pcs.keys()]) drop(id);
    s.stream?.getTracks().forEach((tr) => tr.stop());
    if (s.peer) await post(`/api/rooms/${projectId}/leave`, { peer: s.peer }).catch(() => undefined);
    s.peer = null; s.after = 0; s.stream = null;
    setLocal(null); setJoined(false); setSharing(false);
  }
  useEffect(() => () => { void leave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(kind: "audio" | "video") {
    const tracks = kind === "audio" ? S.current.stream?.getAudioTracks() : S.current.stream?.getVideoTracks();
    tracks?.forEach((tr) => { tr.enabled = !tr.enabled; });
    if (kind === "audio") setMic((m) => !m); else setCam((c) => !c);
  }
  async function share() {
    const s = S.current;
    const cameraTrack = s.stream?.getVideoTracks()[0] ?? null;
    if (sharing) {
      for (const pc of s.pcs.values()) pc.getSenders().filter((x) => x.track?.kind === "video").forEach((x) => void x.replaceTrack(cameraTrack));
      setSharing(false); return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      for (const pc of s.pcs.values()) pc.getSenders().filter((x) => x.track?.kind === "video").forEach((x) => void x.replaceTrack(track));
      track.onended = () => { for (const pc of s.pcs.values()) pc.getSenders().filter((x) => x.track?.kind === "video").forEach((x) => void x.replaceTrack(cameraTrack)); setSharing(false); };
      setSharing(true);
    } catch (e) { setErr(e); }
  }

  return (
    <div className="space-y-3" data-testid="meeting">
      {!joined ? <Btn onClick={join} data-testid="meet-join">{t("meet.join")}</Btn> : (
        <div className="flex flex-wrap gap-2">
          <Btn kind="ghost" onClick={() => toggle("audio")}>{mic ? t("meet.mute") : t("meet.unmute")}</Btn>
          <Btn kind="ghost" onClick={() => toggle("video")} disabled={!local?.getVideoTracks().length}>{cam ? t("meet.camOff") : t("meet.camOn")}</Btn>
          <Btn kind="ghost" onClick={share} disabled={!Object.keys(remotes).length}>{sharing ? t("meet.stopShare") : t("meet.share")}</Btn>
          <Btn kind="danger" onClick={leave} data-testid="meet-leave">{t("meet.leave")}</Btn>
        </div>
      )}
      {note && <p className="text-xs text-[var(--warn)]">{note}</p>}
      <ErrorBox error={err} />
      {joined && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Video stream={local} muted label={t("meet.me")} testId="local-video" />
          {Object.entries(remotes).map(([id, r]) => (
            <div key={id}><Video stream={r.stream} label={r.name} testId="remote-video" /><Pill tone={r.state === "connected" ? "ok" : r.state === "failed" ? "danger" : "info"}>{r.state}</Pill></div>
          ))}
        </div>
      )}
    </div>
  );
}
