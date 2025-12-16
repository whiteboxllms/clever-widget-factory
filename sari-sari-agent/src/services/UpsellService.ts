/**
 * Upsell Service - Handles product recommendation and upselling logic
 */

import { Product, CartItem, ConversationContext, Customer } from '../types/core';
import { PersonalityService } from '../personality/PersonalityService';

export interface UpsellRecommendation {
  productId: string;
  reason: string;
  confidence: number; // 0-1 scale
  type: 'complement' | 'upgrade' | 'bundle' | 'seasonal';
}

export interface UpsellContext {
  currentProducts: string[];
  customerPreferences?: string[];
  seasonalItems?: string[];
  budget?: number;
}

export class UpsellService {
  private personalityService: PersonalityService;

  constructor(personalityService: PersonalityService) {
    this.personalityService = personalityService;
  }

  /**
   * Generate upsell recommendations based on current cart and context
   */
  async generateRecommendations(
    cart: CartItem[],
    availableProducts: Product[],
    context: UpsellContext,
    customer?: Customer
  ): Promise<UpsellRecommendation[]> {
    const recommendations: UpsellRecommendation[] = [];

    // Get products currently in cart
    const cartProductIds = cart.map(item => item.productId);
    
    // Find complementary products
    const complementaryRecs = this.findComplementaryProducts(
      cartProductIds,
      availableProducts,
      context
    );
    recommendations.push(...complementaryRecs);

    // Find upgrade opportunities (exclude already recommended products)
    const alreadyRecommended = new Set(recommendations.map(r => r.productId));
    const upgradeRecs = this.findUpgradeOpportunities(
      cart,
      availableProducts,
      context
    ).filter(rec => !alreadyRecommended.has(rec.productId));
    recommendations.push(...upgradeRecs);

    // Find seasonal recommendations (exclude already recommended products)
    alreadyRecommended.clear();
    recommendations.forEach(r => alreadyRecommended.add(r.productId));
    const seasonalRecs = this.findSeasonalRecommendations(
      availableProducts,
      context
    ).filter(rec => !alreadyRecommended.has(rec.productId));
    recommendations.push(...seasonalRecs);

    // Sort by confidence and return top recommendations
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Limit to top 3 recommendations
  }

  /**
   * Generate personalized upsell message
   */
  generateUpsellMessage(
    recommendation: UpsellRecommendation,
    currentProduct: string,
    suggestedProduct: Product,
    conversationContext: ConversationContext
  ): string | null {
    // Use personality service to generate the message
    const baseMessage = this.personalityService.getUpsellSuggestion(
      currentProduct,
      suggestedProduct.name,
      conversationContext
    );

    if (!baseMessage) {
      return null;
    }

    // Enhance with specific reason
    const enhancedMessage = this.enhanceWithReason(baseMessage, recommendation, suggestedProduct);
    
    return enhancedMessage;
  }

  /**
   * Check if upsell should be offered based on timing and context
   */
  shouldOfferUpsell(
    conversationContext: ConversationContext,
    customer?: Customer
  ): boolean {
    const personality = this.personalityService.getCurrentPersonality();
    const upsellStyle = personality.upsellStyle;

    // Check conversation length - don't upsell too early or too late
    const messageCount = conversationContext.conversationHistory.length;
    
    if (upsellStyle.timing === 'early' && messageCount > 10) {
      return false;
    }
    
    if (upsellStyle.timing === 'mid-conversation' && (messageCount < 3 || messageCount > 15)) {
      return false;
    }

    // Check recent upsell attempts
    const recentUpsells = conversationContext.upsellAttempts.filter(
      attempt => Date.now() - attempt.timestamp.getTime() < 5 * 60 * 1000 // 5 minutes
    );

    // Don't oversell - limit to 2 upsells per 5 minutes
    if (recentUpsells.length >= 2) {
      return false;
    }

    return true;
  }

  /**
   * Find products that complement items in cart
   */
  private findComplementaryProducts(
    cartProductIds: string[],
    availableProducts: Product[],
    context: UpsellContext
  ): UpsellRecommendation[] {
    const recommendations: UpsellRecommendation[] = [];

    // Simple complementary product rules
    const complementaryRules = this.getComplementaryRules();

    for (const productId of cartProductIds) {
      const product = availableProducts.find(p => p.id === productId);
      if (!product) continue;

      const complements = complementaryRules[product.category] || [];
      
      for (const complementCategory of complements) {
        const complementProducts = availableProducts.filter(
          p => p.category === complementCategory && 
          p.sellable && 
          p.stockQuantity > 0 &&
          !cartProductIds.includes(p.id)
        );

        for (const complement of complementProducts.slice(0, 2)) { // Limit to 2 per category
          recommendations.push({
            productId: complement.id,
            reason: `Goes great with ${product.name}`,
            confidence: 0.7,
            type: 'complement'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Find upgrade opportunities (higher quality/price items in same category)
   */
  private findUpgradeOpportunities(
    cart: CartItem[],
    availableProducts: Product[],
    context: UpsellContext
  ): UpsellRecommendation[] {
    const recommendations: UpsellRecommendation[] = [];

    for (const cartItem of cart) {
      const currentProduct = availableProducts.find(p => p.id === cartItem.productId);
      if (!currentProduct) continue;

      // Find higher-priced items in same category
      const upgrades = availableProducts.filter(
        p => p.category === currentProduct.category &&
        p.basePrice > currentProduct.basePrice &&
        p.basePrice <= currentProduct.basePrice * 1.5 && // Max 50% price increase
        p.sellable &&
        p.stockQuantity > 0 &&
        p.id !== currentProduct.id
      );

      for (const upgrade of upgrades.slice(0, 1)) { // One upgrade per item
        recommendations.push({
          productId: upgrade.id,
          reason: `Premium quality ${upgrade.category}`,
          confidence: 0.6,
          type: 'upgrade'
        });
      }
    }

    return recommendations;
  }

  /**
   * Find seasonal or featured recommendations
   */
  private findSeasonalRecommendations(
    availableProducts: Product[],
    context: UpsellContext
  ): UpsellRecommendation[] {
    const recommendations: UpsellRecommendation[] = [];

    // Simple seasonal logic - could be enhanced with actual seasonal data
    const currentMonth = new Date().getMonth();
    const seasonalCategories = this.getSeasonalCategories(currentMonth);

    for (const category of seasonalCategories) {
      const seasonalProducts = availableProducts.filter(
        p => p.category === category &&
        p.sellable &&
        p.stockQuantity > 0
      );

      for (const product of seasonalProducts.slice(0, 1)) { // One per seasonal category
        recommendations.push({
          productId: product.id,
          reason: `Fresh and in season`,
          confidence: 0.5,
          type: 'seasonal'
        });
      }
    }

    return recommendations;
  }

  /**
   * Enhance upsell message with specific reason
   */
  private enhanceWithReason(
    baseMessage: string,
    recommendation: UpsellRecommendation,
    product: Product
  ): string {
    const reasonPhrases = {
      complement: `They pair perfectly together!`,
      upgrade: `It's our premium quality option.`,
      bundle: `You'll save money buying them together.`,
      seasonal: `It's especially fresh right now!`
    };

    const reasonPhrase = reasonPhrases[recommendation.type];
    return `${baseMessage} ${reasonPhrase}`;
  }

  /**
   * Get complementary product rules
   */
  private getComplementaryRules(): Record<string, string[]> {
    return {
      'vegetables': ['fruits', 'grains'],
      'fruits': ['vegetables', 'dairy'],
      'grains': ['vegetables', 'meat'],
      'dairy': ['fruits', 'grains'],
      'meat': ['vegetables', 'grains']
    };
  }

  /**
   * Get seasonal categories based on month
   */
  private getSeasonalCategories(month: number): string[] {
    // Simple seasonal mapping - could be enhanced with regional data
    if (month >= 2 && month <= 4) { // Spring
      return ['vegetables', 'fruits'];
    } else if (month >= 5 && month <= 7) { // Summer
      return ['fruits', 'vegetables'];
    } else if (month >= 8 && month <= 10) { // Fall
      return ['vegetables', 'grains'];
    } else { // Winter
      return ['grains', 'dairy'];
    }
  }
}