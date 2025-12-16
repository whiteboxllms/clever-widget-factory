/**
 * Personality system type definitions
 */

export interface PersonalityProfile {
  id: string;
  name: string;
  description: string;
  traits: PersonalityTraits;
  responseStyle: ResponseStyle;
  negotiationStyle: NegotiationStyle;
  upsellStyle: UpsellStyle;
}

export interface PersonalityTraits {
  friendliness: number; // 1-10 scale
  formality: number; // 1-10 scale (1 = very casual, 10 = very formal)
  enthusiasm: number; // 1-10 scale
  patience: number; // 1-10 scale
  helpfulness: number; // 1-10 scale
}

export interface ResponseStyle {
  greetingTemplates: string[];
  farewellTemplates: string[];
  acknowledgmentPhrases: string[];
  clarificationPhrases: string[];
  errorHandlingPhrases: string[];
  tone: 'warm' | 'professional' | 'casual' | 'enthusiastic';
}

export interface NegotiationStyle {
  willingness: number; // 1-10 scale (1 = never negotiate, 10 = always negotiate)
  flexibility: number; // 1-10 scale (1 = rigid, 10 = very flexible)
  minDiscountPercent: number; // Minimum discount willing to offer
  maxDiscountPercent: number; // Maximum discount willing to offer
  counterOfferStrategy: 'conservative' | 'moderate' | 'aggressive';
  phrases: {
    acceptOffer: string[];
    rejectOffer: string[];
    counterOffer: string[];
    finalOffer: string[];
  };
}

export interface UpsellStyle {
  frequency: number; // 1-10 scale (1 = rarely upsell, 10 = always upsell)
  approach: 'subtle' | 'direct' | 'educational';
  timing: 'early' | 'mid-conversation' | 'at-checkout';
  phrases: {
    suggestions: string[];
    benefits: string[];
    alternatives: string[];
  };
}

export interface PersonalityContext {
  currentMood?: 'happy' | 'neutral' | 'busy' | 'helpful';
  customerRelationship?: 'new' | 'returning' | 'regular';
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  seasonalContext?: string;
}

export interface PersonalizedResponse {
  text: string;
  tone: string;
  suggestions?: string[];
  emotionalContext?: string;
}