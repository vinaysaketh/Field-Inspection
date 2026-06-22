import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Observation } from "@/src/store/types";
import { formatLocationStamp } from "./location";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

async function fileToDataUri(uri: string): Promise<string> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return uri;
  }
}

export async function exportObservationsPdf(observations: Observation[], title = "FieldSnap Pro Report"): Promise<void> {
  const sections = await Promise.all(
    observations.map(async (o) => {
      const img = await fileToDataUri(o.imageUri);
      const stamp = formatLocationStamp(o.location, o.template, "", new Date(o.timestamp));
      return `
        <section style="page-break-inside: avoid; margin-bottom: 28px; border-bottom: 1px solid #ccc; padding-bottom: 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h2 style="margin:0; font-size:18px; color:#0A2463;">${esc(o.number)}</h2>
            <span style="font-size:11px; color:#555;">${esc(new Date(o.timestamp).toLocaleString())}</span>
          </div>
          ${o.project ? `<div style="font-size:12px;color:#555;margin-bottom:6px;">Project: ${esc(o.project)}</div>` : ""}
          <img src="${img}" style="width:100%; max-height:420px; object-fit:contain; border:1px solid #ddd; border-radius:4px;" />
          ${o.notes ? `<div style="margin-top:10px; font-size:13px;"><b>Notes:</b><br/>${esc(o.notes)}</div>` : ""}
          ${stamp ? `<div style="margin-top:10px; font-size:11px; color:#444; background:#f4f5f8; padding:8px; border-radius:4px; white-space:pre-wrap; font-family:monospace;">${esc(stamp)}</div>` : ""}
        </section>
      `;
    })
  );

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Roboto, sans-serif; margin: 24px; color: #1E1E24; }
      h1 { color:#0A2463; font-size: 22px; margin: 0 0 4px 0; }
      .meta { color:#666; font-size: 12px; margin-bottom: 20px; }
    </style>
    </head><body>
      <h1>${esc(title)}</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} • ${observations.length} observation${observations.length === 1 ? "" : "s"}</div>
      ${sections.join("")}
    </body></html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Report" });
  }
}
