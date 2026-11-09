export interface ListItem {
  id: number;
  title: string;
  description: string;
}
export interface HowItWorksStep {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
}

export type DeviceKind = "phone" | "laptop" | "tablet";
export type DeviceCondition = "Like new" | "Good" | "Fair" | "Needs repair";

export interface MockListing {
  id: string;
  kind: DeviceKind;
  title: string;
  brand: string;
  condition: DeviceCondition;
  city: string;
  area: string;
  extras: string[];
  posted: string;
  donor: string;
  rating: number;
  handoffs: number;
  note: string;
}

export interface MockRequest {
  id: string;
  kind: DeviceKind;
  title: string;
  condition: string;
  city: string;
  area: string;
  posted: string;
  person: string;
  rating: number;
  handoffs: number;
  note: string;
}

export interface ChatMessage {
  from: "me" | "them";
  text: string;
  time: string;
}


// email function params types
export interface SendEmailParams {
  from?: string;
  to: string;
  subject: string;
  html: string;
}