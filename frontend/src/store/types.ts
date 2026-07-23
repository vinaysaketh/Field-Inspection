export interface LocationData {
  latitude: number;
  longitude: number;
  village?: string;
  mandal?: string;
  district?: string;
  state?: string;
  country?: string;
  pin?: string;
  resolved: boolean; // false if reverse geocoding still pending
}

export interface Observation {
  id: string;
  number: string; // e.g. OBS-0001
  title?: string; // user-editable display name (defaults to number)
  imageUri: string; // local file uri (documentDirectory)
  /**
   * MediaLibrary asset id if the image was successfully saved to the device
   * Photos/Gallery. If the user later deletes that asset from their Gallery
   * app, we detect it and prune this observation (see pruneOrphanedObservations).
   */
  mediaAssetId?: string;
  thumbnailUri?: string;
  location: LocationData | null;
  timestamp: number; // ms since epoch
  project: string;
  company: string;
  auditor: string;
  notes: string;
  template: StampTemplate;
}

export type StampTemplate = "A" | "B" | "C" | "D";

export interface AppSettings {
  gpsEnabled: boolean;
  stampTemplate: StampTemplate;
  customTemplate: string; // for template D
  company: string;
  project: string;
  auditor: string;
  watermarkCompany: boolean;
  watermarkAuditor: boolean;
  watermarkObsNumber: boolean;
  watermarkDateTime: boolean;
  watermarkGps: boolean;
  appLockEnabled: boolean;
  biometricEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  gpsEnabled: true,
  stampTemplate: "A",
  customTemplate: "{date}\n{village}, {district}\nLat: {lat}  Lon: {lon}",
  company: "",
  project: "",
  auditor: "",
  watermarkCompany: false,
  watermarkAuditor: false,
  watermarkObsNumber: true,
  watermarkDateTime: false,
  watermarkGps: false,
  appLockEnabled: false,
  biometricEnabled: false,
};
