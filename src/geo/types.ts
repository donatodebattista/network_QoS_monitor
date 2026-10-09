export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number; // Precisión en metros
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  provider?: string;
}

export interface LocationState {
  loading: boolean;
  location: GeoLocationData | null;
  error: string | null;
  hasPermission: boolean;
}
