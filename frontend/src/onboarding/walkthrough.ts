import { storage } from "@/src/utils/storage";

const KEY = "fsp.walkthroughCompleted";

export async function isWalkthroughDone(): Promise<boolean> {
  return !!(await storage.getItem<boolean>(KEY, false));
}
export async function markWalkthroughDone(): Promise<void> {
  await storage.setItem(KEY, true);
}
export async function resetWalkthrough(): Promise<void> {
  await storage.setItem(KEY, false);
}

export interface WalkthroughStep {
  icon: string; // Ionicons name
  title: string;
  body: string;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    icon: "image-outline",
    title: "Pick a Photo",
    body: "From the home screen tap Pick Photo to choose any photograph from your device gallery and start annotating.",
  },
  {
    icon: "location",
    title: "Marker Tool",
    body: "In the editor tap Marker, then tap on the image to drop numbered markers (1, 2, 3…). Great for pointing out multiple observations.",
  },
  {
    icon: "text",
    title: "Text Tool",
    body: "Tap Text and then tap anywhere on the image to add a rounded text label. Choose S/M/L size and Normal or Invert style.",
  },
  {
    icon: "document-text-outline",
    title: "Notes",
    body: "Tap the Notes tool (next to Text) to add a written observation. Notes are separate from image annotations.",
  },
  {
    icon: "crop-outline",
    title: "Crop Image",
    body: "Crop Image – Crop your photograph to focus on the area you want to document. Tap Crop in the bottom toolbar, adjust the crop box, then Confirm.",
  },
  {
    icon: "add-circle-outline",
    title: "Overlay",
    body: "Overlay – Add another photograph as a circular detail image on top of your main photograph. Drag the overlay to position it where you need it.",
  },
  {
    icon: "save-outline",
    title: "Save",
    body: "Tap the Save icon at the top-right of the editor. The annotated image is stored locally and saved to your device Gallery.",
  },
  {
    icon: "images-outline",
    title: "Gallery & Settings",
    body: "Open My Gallery from the home screen to browse saved observations. Tap the gear icon for Settings, tutorial, and more.",
  },
];
