export interface Farm {
  id: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: "Stockholm" | "Uppsala" | "Västmanland" | "Södermanland" | "Skåne" | "Kalmar" | "Gotland" | "Västra Götaland" | "Halland" | "Blekinge";
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
  openingHours: string;
  season: string;
  source: string;
  isClaimed: boolean;
  facebook: string | null;
  instagram: string | null;
}
