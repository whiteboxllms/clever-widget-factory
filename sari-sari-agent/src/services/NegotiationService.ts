/**
 * Negotiation Service - Handles price negotiation logic and responses
 */

import { Product, Customer, ConversationContext } from '../types/core';
import { PersonalityService } from '../personality/PersonalityService';

export interface NegotiationOffer {
  productId: string;
  originalPrice: number;
  customerOffer: number;
  timestamp: Date;
}

export interface NegotiationResult {
  accepted: boolean;
  finalPrice: number;
  response: string;
  counterOffer?: number;
  reason?: string;
}

export interface NegotiationRules {
  minDiscountPercent: number;
  maxDiscountPercent: number;
  volumeDiscountThreshold: number; // Quantity threshold for volume discounts
  volumeDiscountPercent: number;
  loyalCustomerDiscountPercent: number; // Extra discount for loyal customers
  seasonalDiscountPercent: number; // Seasonal promotion discount
}

export class NegotiationService {
  private personalityService: PersonalityService;
  private negotiationRules: NegotiationRules;

  constructor(personalityService: PersonalityService) {
    this.personalityService = personalityService;
    
    // Default negotiation rules - could be configurable
    this.negotiationRules = {
      minDiscountPercent: 5,
      maxDiscountPercent: 15,
      volumeDiscountThreshold: 5, // 5+ items
      volumeDiscountPercent: 5, // Additional 5% for volume
      loyalCustomerDiscountPercent: 3, // Additional 3% for loyal customers
      seasonalDiscountPercent: 10 // Seasonal promotions
    };
  }

  /**
   * Process a negotiation offer and return the result
   */
  async processNegotiation(
    offer: NegotiationOffer,
    product: Product,
    quantity: number = 1,
    customer?: Customer,
    conversationContext?: ConversationContext
  ): Promise<NegotiationResult> {
    // Calculate acceptable price range
    const priceRange = this.calculateAcceptablePriceRange(
      product,
      quantity,
      customer
    );

    // Check if offer is acceptable
    if (offer.customerOffer >= priceRange.min) {
      return this.acceptOffer(offer, product, priceRange.min);
    }

    // Check if we should make a counter offer
    if (this.shouldCounterOffer(offer, priceRange, conversationContext)) {
      return this.makeCounterOffer(offer, product, priceRange);
    }

    // Reject the offer
    return this.rejectOffer(offer, product, priceRange.min);
  }

  /**
   * Check if a product is negotiable
   */
  isNegotiable(product: Product, customer?: Customer): boolean {
    const personality = this.personalityService.getCurrentPersonality();
    
    // Check personality willingness to negotiate
    if (personality.negotiationStyle.willingness < 5) {
      return false;
    }

    // Some products might not be negotiable (could add product flags)
    // For now, all products are potentially negotiable
    return true;
  }

  /**
   * Get negotiation hints for the customer
   */
  getNegotiationHints(product: Product, customer?: Customer): string[] {
    const hints: string[] = [];
    const personality = this.personalityService.getCurrentPersonality();

    if (personality.negotiationStyle.willingness >= 7) {
      hints.push("I'm open to discussing the price!");
    }

    if (customer && customer.visitCount >= 3) {
      hints.push("As a regular customer, I might be able to work with you on pricing.");
    }

    const priceRange = this.calculateAcceptablePriceRange(product, 1, customer);
    const maxDiscount = ((product.basePrice - priceRange.min) / product.basePrice) * 100;
    
    if (maxDiscount > 10) {
      hints.push(`I have some flexibility on the price for ${product.name}.`);
    }

    return hints;
  }

  /**
   * Calculate the acceptable price range for a product
   */
  private calculateAcceptablePriceRange(
    product: Product,
    quantity: number,
    customer?: Customer
  ): { min: number; max: number } {
    let maxDiscountPercent = this.negotiationRules.maxDiscountPercent;

    // Volume discount
    if (quantity >= this.negotiationRules.volumeDiscountThreshold) {
      maxDiscountPercent += this.negotiationRules.volumeDiscountPercent;
    }

    // Loyal customer discount
    if (customer && customer.visitCount >= 5) {
      maxDiscountPercent += this.negotiationRules.loyalCustomerDiscountPercent;
    }

    // Seasonal discount (simple check - could be enhanced)
    if (this.isSeasonalPromotion()) {
      maxDiscountPercent += this.negotiationRules.seasonalDiscountPercent;
    }

    // Cap the maximum discount at 25%
    maxDiscountPercent = Math.min(maxDiscountPercent, 25);

    const minPrice = product.basePrice * (1 - maxDiscountPercent / 100);
    
    return {
      min: Math.round(minPrice * 100) / 100, // Round to 2 decimal places
      max: product.basePrice
    };
  }

  /**
   * Accept a customer offer
   */
  private acceptOffer(
    offer: NegotiationOffer,
    product: Product,
    minAcceptablePrice: number
  ): NegotiationResult {
    const personalityResponse = this.personalityService.getNegotiationResponse(
      offer.originalPrice,
      offer.customerOffer,
      product.name
    );

    return {
      accepted: true,
      finalPrice: offer.customerOffer,
      response: personalityResponse.response,
      reason: 'Customer offer within acceptable range'
    };
  }

  /**
   * Make a counter offer
   */
  private makeCounterOffer(
    offer: NegotiationOffer,
    product: Product,
    priceRange: { min: number; max: number }
  ): NegotiationResult {
    // Calculate counter offer - meet somewhere in the middle
    const customerDiscount = (offer.originalPrice - offer.customerOffer) / offer.originalPrice;
    const maxDiscount = (offer.originalPrice - priceRange.min) / offer.originalPrice;
    
    // Offer 70% of the maximum discount we're willing to give
    const counterDiscountPercent = maxDiscount * 0.7;
    const counterOffer = offer.originalPrice * (1 - counterDiscountPercent);
    
    const personalityResponse = this.personalityService.getNegotiationResponse(
      offer.originalPrice,
      offer.customerOffer,
      product.name
    );

    return {
      accepted: false,
      finalPrice: counterOffer,
      counterOffer: counterOffer,
      response: personalityResponse.response,
      reason: 'Counter offer within negotiation range'
    };
  }

  /**
   * Reject a customer offer
   */
  private rejectOffer(
    offer: NegotiationOffer,
    product: Product,
    minAcceptablePrice: number
  ): NegotiationResult {
    const personalityResponse = this.personalityService.getNegotiationResponse(
      offer.originalPrice,
      offer.customerOffer,
      product.name
    );

    return {
      accepted: false,
      finalPrice: minAcceptablePrice,
      response: personalityResponse.response,
      reason: 'Customer offer below acceptable threshold'
    };
  }

  /**
   * Determine if we should make a counter offer
   */
  private shouldCounterOffer(
    offer: NegotiationOffer,
    priceRange: { min: number; max: number },
    conversationContext?: ConversationContext
  ): boolean {
    const personality = this.personalityService.getCurrentPersonality();
    
    // Check personality flexibility
    if (personality.negotiationStyle.flexibility < 5) {
      return false;
    }

    // Don't counter offer if customer's offer is way too low (less than 50% of min price)
    if (offer.customerOffer < priceRange.min * 0.5) {
      return false;
    }

    // Check if we've already made counter offers recently
    if (conversationContext) {
      const recentNegotiations = conversationContext.negotiationHistory.filter(
        neg => neg.productId === offer.productId &&
        Date.now() - neg.timestamp.getTime() < 10 * 60 * 1000 // 10 minutes
      );

      // Don't make more than 2 counter offers per product
      if (recentNegotiations.length >= 2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if seasonal promotion is active (simple implementation)
   */
  private isSeasonalPromotion(): boolean {
    // Simple check - could be enhanced with actual promotion data
    const currentDate = new Date();
    const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / 86400000);
    
    // Example: Seasonal promotion every 90 days
    return dayOfYear % 90 < 7; // 7-day promotion every 90 days
  }

  /**
   * Update negotiation rules (for future configuration)
   */
  updateNegotiationRules(newRules: Partial<NegotiationRules>): void {
    this.negotiationRules = { ...this.negotiationRules, ...newRules };
  }

  /**
   * Get current negotiation rules
   */
  getNegotiationRules(): NegotiationRules {
    return { ...this.negotiationRules };
  }
}