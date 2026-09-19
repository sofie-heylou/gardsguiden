export interface Farm {
  id: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: "Stockholm" | "Uppsala" | "Västmanland" | "Södermanland" | "Skåne" | "Kalmar" | "Gotland" | "Västra Götaland" | "Halland" | "Blekinge" | "Kronoberg" | "Jönköping" | "Östergötland";
  lat: number;
  lng: number;
  website: string;
  phone: string;
  email: string;
  products: string[];
  onSiteSales: boolean;
  tastingRoom: boolean;
  gardsförsäljningLicense: boolean;
  isArchipelago: boolean;
  /** Presses fruit the visitor brings in (legomustning). */
  legomustning: boolean;
  openingHours: string;
  season: string;
  source: string;
  facebook: string | null;
  instagram: string | null;
  /** Free for everyone; `extended` is the paid "utökad profil" (more photos). */
  tier: "free" | "extended";
  /** The farm's first visible photo, or null — see photos.ts. */
  photoId: string | null;
}
