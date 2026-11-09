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