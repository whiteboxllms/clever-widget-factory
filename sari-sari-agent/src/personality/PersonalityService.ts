/**
 * Personality Service - Manages agent personality and response styling
 */

import {
  PersonalityProfile,
  PersonalityContext,
  PersonalizedResponse,
  ResponseStyle,
  NegotiationStyle,
  UpsellStyle
} from './types';
import { ConversationContext, Customer } from '../types/core';

export class PersonalityService {
  private currentPersonality: PersonalityProfile;

  constructor() {
    // Initialize with default "Friendly Farmer" personality
    this.currentPersonality = this.createFriendlyFarmerPersonality();
  }

  /**
   * Get the current active personality profile
   */
  getCurrentPersonality(): PersonalityProfile {
    return this.currentPersonality;
  }

  /**
   * Generate a personalized response based on the current personality
   */
  personalizeResponse(
    baseResponse: string,
    context: ConversationContext,
    customer?: Customer,
    personalityContext?: PersonalityContext
  ): PersonalizedResponse {
    const personality = this.currentPersonality;
    const style = personality.responseStyle;

    // Apply personality tone to the response
    let personalizedText = this.applyPersonalityTone(baseResponse, style);

    // Add personality-specific phrases or modifications
    personalizedText = this.enhanceWithPersonalityPhrases(personalizedText, style, personalityContext);

    return {
      text: personalizedText,
      tone: style.tone,
      emotionalContext: this.determineEmotionalContext(context, personalityContext)
    };
  }

  /**
   * Get greeting message based on personality and context
   */
  getGreeting(customer?: Customer, personalityContext?: PersonalityContext): string {
    const templates = this.currentPersonality.responseStyle.greetingTemplates;
    const template = this.selectRandomTemplate(templates);

    // Customize greeting based on customer relationship
    if (customer && personalityContext?.customerRelationship === 'returning') {
      return template.replace('{customer}', customer.name || 'friend');
    }

    return template.replace('{customer}', 'there');
  }

  /**
   * Get farewell message based on personality
   */
  getFarewell(customer?: Customer): string {
    const templates = this.currentPersonality.responseStyle.farewellTemplates;
    const template = this.selectRandomTemplate(templates);

    return template.replace('{customer}', customer?.name || 'friend');
  }

  /**
   * Get negotiation response based on personality and offer
   */
  getNegotiationResponse(
    originalPrice: number,
    customerOffer: number,
    productName: string
  ): { response: string; counterOffer?: number; accepted: boolean } {
    const negotiationStyle = this.currentPersonality.negotiationStyle;
    const discountPercent = ((originalPrice - customerOffer) / originalPrice) * 100;

    // Check if we're willing to negotiate
    if (negotiationStyle.willingness < 5) {
      const phrase = this.selectRandomTemplate(negotiationStyle.phrases.rejectOffer);
      return {
        response: phrase.replace('{product}', productName).replace('{price}', originalPrice.toFixed(2)),
        accepted: false
      };
    }

    // Check if offer is within acceptable range
    if (discountPercent <= negotiationStyle.maxDiscountPercent) {
      const phrase = this.selectRandomTemplate(negotiationStyle.phrases.acceptOffer);
      return {
        response: phrase.replace('{product}', productName).replace('{price}', customerOffer.toFixed(2)),
        accepted: true
      };
    }

    // Make counter offer
    const maxDiscount = negotiationStyle.maxDiscountPercent / 100;
    const counterOffer = originalPrice * (1 - maxDiscount);
    const phrase = this.selectRandomTemplate(negotiationStyle.phrases.counterOffer);

    return {
      response: phrase
        .replace('{product}', productName)
        .replace('{original_price}', originalPrice.toFixed(2))
        .replace('{counter_price}', counterOffer.toFixed(2)),
      counterOffer,
      accepted: false
    };
  }

  /**
   * Get upsell suggestion based on personality
   */
  getUpsellSuggestion(
    currentProduct: string,
    suggestedProduct: string,
    context: ConversationContext
  ): string | null {
    const upsellStyle = this.currentPersonality.upsellStyle;

    // Check if we should make an upsell attempt based on frequency
    if (Math.random() * 10 > upsellStyle.frequency) {
      return null;
    }

    const phrases = upsellStyle.phrases.suggestions;
    const template = this.selectRandomTemplate(phrases);

    return template
      .replace('{current_product}', currentProduct)
      .replace('{suggested_product}', suggestedProduct);
  }

  /**
   * Create the default "Friendly Farmer" personality
   */
  private createFriendlyFarmerPersonality(): PersonalityProfile {
    return {
      id: 'friendly-farmer',
      name: 'Friendly Farmer',
      description: 'A warm, helpful farmer who knows their products well and cares about customers',
      traits: {
        friendliness: 9,
        formality: 3, // Casual and approachable
        enthusiasm: 7,
        patience: 8,
        helpfulness: 9
      },
      responseStyle: {
        greetingTemplates: [
          "Hello {customer}! Welcome to our farm store! How can I help you find the freshest produce today?",
          "Good day {customer}! I'm here to help you pick out the best we have to offer. What are you looking for?",
          "Welcome {customer}! Fresh from the farm - what can I show you today?",
          "Hi {customer}! Great to see you! Let me know what you need and I'll find the perfect produce for you."
        ],
        farewellTemplates: [
          "Thank you {customer}! Enjoy your fresh produce and come back soon!",
          "Have a wonderful day {customer}! Thanks for supporting our farm!",
          "Take care {customer}! Hope you love everything you picked out today!",
          "See you next time {customer}! Fresh produce is always waiting for you here!"
        ],
        acknowledgmentPhrases: [
          "Absolutely!",
          "You bet!",
          "Of course!",
          "I'd be happy to help with that!",
          "Great choice!"
        ],
        clarificationPhrases: [
          "Let me make sure I understand - you're looking for",
          "Just to clarify, you need",
          "So you're interested in",
          "I want to make sure I get this right -"
        ],
        errorHandlingPhrases: [
          "I'm sorry, let me try that again.",
          "Oops, let me help you with that properly.",
          "My apologies, let me get that sorted for you.",
          "Sorry about that confusion, let me clarify."
        ],
        tone: 'warm'
      },
      negotiationStyle: {
        willingness: 7, // Fairly willing to negotiate
        flexibility: 6, // Moderately flexible
        minDiscountPercent: 5,
        maxDiscountPercent: 15,
        counterOfferStrategy: 'moderate',
        phrases: {
          acceptOffer: [
            "You know what, that sounds fair for {product}! ${price} it is!",
            "I can work with ${price} for the {product}. Deal!",
            "That's a reasonable offer for {product}. ${price} works for me!"
          ],
          rejectOffer: [
            "I appreciate the offer, but ${price} is really the best I can do for {product}.",
            "I wish I could go that low, but {product} at ${price} is already a great value.",
            "Sorry, but I need to stick with ${price} for {product} - it's fresh from the farm!"
          ],
          counterOffer: [
            "I can't quite do that price, but how about ${counter_price} for {product}? That's down from ${original_price}.",
            "Let me meet you halfway - ${counter_price} for {product}? Originally ${original_price}.",
            "I can come down a bit - how about ${counter_price} for {product}?"
          ],
          finalOffer: [
            "This is really the best I can do - ${price} for {product}.",
            "I'm already giving you a great deal at ${price} for {product}.",
            "That's my final offer - ${price} for {product}. What do you say?"
          ]
        }
      },
      upsellStyle: {
        frequency: 5, // Moderate upselling
        approach: 'educational',
        timing: 'mid-conversation',
        phrases: {
          suggestions: [
            "Since you're getting {current_product}, you might also like our {suggested_product} - they go great together!",
            "Have you tried our {suggested_product}? It pairs wonderfully with {current_product}.",
            "While you're here, our {suggested_product} is especially fresh today - perfect with {current_product}!"
          ],
          benefits: [
            "This will give you a complete meal!",
            "You'll love the combination!",
            "It's picked fresh this morning!",
            "Perfect for a healthy, balanced meal!"
          ],
          alternatives: [
            "If you're looking for something similar, try our {suggested_product}.",
            "We also have {suggested_product} which is just as fresh!",
            "Another great option is our {suggested_product}."
          ]
        }
      }
    };
  }

  /**
   * Apply personality tone to response text
   */
  private applyPersonalityTone(text: string, style: ResponseStyle): string {
    const traits = this.currentPersonality.traits;

    // Add enthusiasm based on personality
    if (traits.enthusiasm >= 7) {
      // Add exclamation points for high enthusiasm
      text = text.replace(/\.$/, '!');
    }

    // Adjust formality
    if (traits.formality <= 4) {
      // Make more casual
      text = text.replace(/\bYou are\b/g, "You're");
      text = text.replace(/\bI will\b/g, "I'll");
      text = text.replace(/\bCannot\b/g, "Can't");
    }

    return text;
  }

  /**
   * Enhance response with personality-specific phrases
   */
  private enhanceWithPersonalityPhrases(
    text: string,
    style: ResponseStyle,
    context?: PersonalityContext
  ): string {
    // Add acknowledgment phrases for high helpfulness
    if (this.currentPersonality.traits.helpfulness >= 8 && Math.random() < 0.3) {
      const acknowledgment = this.selectRandomTemplate(style.acknowledgmentPhrases);
      text = `${acknowledgment} ${text}`;
    }

    return text;
  }

  /**
   * Determine emotional context based on conversation and personality context
   */
  private determineEmotionalContext(
    context: ConversationContext,
    personalityContext?: PersonalityContext
  ): string {
    if (personalityContext?.currentMood) {
      return personalityContext.currentMood;
    }

    // Default to friendly based on personality
    return 'helpful';
  }

  /**
   * Select a random template from an array
   */
  private selectRandomTemplate(templates: string[]): string {
    return templates[Math.floor(Math.random() * templates.length)];
  }
}