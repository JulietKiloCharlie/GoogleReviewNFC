export type BusinessStatus = "draft" | "active" | "disabled";

export type Business = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  description: string | null;
  feedback_email: string | null;
  feedback_email_verified: boolean;
  pending_feedback_email: string | null;
  google_review_url: string;
  welcome_message: string;
  thank_you_message: string;
  accent_colour: string;
  status: BusinessStatus;
  created_at: string;
  updated_at: string;
};

export type PublicPage = {
  name: string;
  slug: string;
  logo_path: string | null;
  description: string | null;
  google_review_url: string;
  welcome_message: string;
  thank_you_message: string;
  accent_colour: string;
  page_status: BusinessStatus;
};

export type BusinessInput = {
  name: string;
  slug: string;
  description: string;
  feedbackEmail: string;
  googleReviewUrl: string;
  welcomeMessage: string;
  thankYouMessage: string;
  accentColour: string;
};
