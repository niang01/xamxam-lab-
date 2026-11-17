"use client";
import { useCallback, useEffect, useState } from "react";
import { api, RequestError } from "./api";

/** Chargement d'une ressource API (lecture), avec rechargement explicite. */
export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<RequestError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    api<T>(path).then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => { if (alive) setError(e instanceof RequestError ? e : new RequestError(0, String(e))); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, n]);
  const reload = useCallback(() => { setLoading(true); setN((x) => x + 1); }, []);
  return { data, error, loading, reload, setData };
}
