import { ExternalLink, Play, Trash2 } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { cn } from "@/lib/utils";
import { isShortsUrl, youtubeEmbedUrl, youtubeId } from "@/lib/video";

type Props = {
  url: string;
  title: string;
  sourceLabel?: string;
  onRemove?: () => void;
};

/**
 * Video nur als Link. YouTube wird erst nach Tippen eingebettet (kein Tracking vorab,
 * kein Datenverbrauch). Klappt das Embed nicht, bleibt immer der sichere Link "Video öffnen".
 */
export function VideoEmbed({ url, title, sourceLabel, onRemove }: Props) {
  const { t } = useApp();
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  const vertical = isShortsUrl(url);
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // ungültige URL – nur Text anzeigen
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-elevated">
      {id && (
        <div className={cn("relative mx-auto w-full bg-black", vertical ? "aspect-[9/16] max-h-[60dvh] max-w-[340px]" : "aspect-video")}>
          {playing ? (
            <iframe
              src={youtubeEmbedUrl(id)}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_40%,rgba(255,106,0,0.18),transparent_60%)]"
              aria-label={`${t("exercise.playVideo")}: ${title}`}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-black shadow-lg transition group-active:scale-95">
                <Play size={28} fill="currentColor" aria-hidden />
              </span>
              <span className="px-6 text-center text-xs text-muted">{t("exercise.videoPrivacy")}</span>
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 p-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-muted">{host}</p>
          {sourceLabel && <p className="text-[11px] text-subtle">{sourceLabel}</p>}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-accent-light hover:bg-white/5"
        >
          {t("exercise.openVideo")} <ExternalLink size={14} aria-hidden />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-subtle hover:bg-white/5 hover:text-danger"
            aria-label={t("exercise.removeVideo")}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
