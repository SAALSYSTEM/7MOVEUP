/** Backup-Datei an den Nutzer übergeben: auf dem Handy über „Teilen“, sonst als Download. */
export type DeliverResult = "shared" | "downloaded" | "cancelled";

export function slug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export async function deliverFile(file: File): Promise<DeliverResult> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (coarse && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
      // sonst: Download als Fallback
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
