export interface ListItem {
  id: number;
  title: string;
  description: string;
}
export interface CardDetail extends ListItem {
  bgColor: string;
  icon: React.ReactNode;
}

export interface HowItWorksItems {
  forRequesters: ListItem[];
  forDonors: ListItem[];
}

export interface ShortListing {
  id: string;
  condition: string;
  model: string;
  deviceType: string;
  country: string;
  ram: number;
  storage: number;
}
