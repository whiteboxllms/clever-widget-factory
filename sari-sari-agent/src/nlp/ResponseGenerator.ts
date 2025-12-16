/**
 * Response Generator - Integrates NLP, personality, and business context for response generation
 */

import { 
  Intent, 
  Entity, 
  ConversationContext, 
  BusinessContext, 
  Product, 
  CartItem 
} from '../types/core';
import { PersonalityService } from '../personality/PersonalityService';
import { UpsellService, UpsellRecommendation } from '../services/UpsellService';
import { NegotiationService } from '../services/NegotiationService';
import { StoreIntent, EntityType } from './types';
import { logger } from '../utils/logger';

export interface ResponseGenerationOptions {
  includeUpsell?: boolean;
  includeNegotiation?: boolean;
  maxResponseLength?: number;
  tone?: 'casual' | 'formal' | 'friendly';
}

export interface GeneratedResponse {
  text: string;
  confidence: number;
  metadata: {
    intent: string;
    personalityApplied: boolean;
    upsellIncluded: boolean;
    negotiationIncluded: boolean;
    processingTime: number;
  };
}

export class ResponseGenerator {
  private personalityService: PersonalityService;
  private upsellService: UpsellService;
  private negotiationService: NegotiationService;

  constructor(
    personalityService: PersonalityService,
    upsellService: UpsellService,
    negotiationService: NegotiationService
  ) {
    this.personalityService = personalityService;
    this.upsellService = upsellService;
    this.negotiationService = negotiationService;
  }

  /**
   * Generate a complete response based on intent and context
   */
  async generateResponse(
    intent: Intent,
    context: ConversationContext,
    businessContext: BusinessContext,
    originalMessage?: string,
    options: ResponseGenerationOptions = {}
  ): Promise<GeneratedResponse> {
    const startTime = Date.now();
    
    logger.debug('Generating response', {
      intent: intent.name,
      confidence: intent.confidence,
      entityCount: intent.entities.length,
      options
    });

    try {
      // Generate base response based on intent
      let baseResponse = await this.generateBaseResponse(
        intent,
        context,
        businessContext,
        originalMessage
      );

      // Apply personality styling
      let personalizedResponse;
      try {
        personalizedResponse = this.personalityService.personalizeResponse(
          baseResponse,
          context,
          businessContext.sessionContext.customer
        );
      } catch (personalityError) {
        logger.warn('Personality service failed, using base response', { personalityError });
        personalizedResponse = { text: baseResponse, tone: 'neutral' as const, emotionalContext: 'neutral' };
      }

      let finalResponse = personalizedResponse.text;
      let upsellIncluded = false;
      let negotiationIncluded = false;

      // Add upsell suggestions if appropriate
      if (options.includeUpsell !== false && this.shouldIncludeUpsell(intent, context)) {
        const upsellText = await this.generateUpsellSuggestion(intent, context, businessContext);
        if (upsellText) {
          finalResponse += ` ${upsellText}`;
          upsellIncluded = true;
        }
      }

      // Add negotiation response if applicable
      if (options.includeNegotiation !== false && this.shouldIncludeNegotiation(intent, context)) {
        const negotiationText = await this.generateNegotiationResponse(intent, context, businessContext);
        if (negotiationText) {
          finalResponse += ` ${negotiationText}`;
          negotiationIncluded = true;
        }
      }

      // Apply length constraints
      if (options.maxResponseLength && finalResponse.length > options.maxResponseLength) {
        finalResponse = this.truncateResponse(finalResponse, options.maxResponseLength);
      }

      const processingTime = Date.now() - startTime;

      logger.info('Response generated successfully', {
        intent: intent.name,
        responseLength: finalResponse.length,
        upsellIncluded,
        negotiationIncluded,
        processingTime
      });

      return {
        text: finalResponse,
        confidence: intent.confidence,
        metadata: {
          intent: intent.name,
          personalityApplied: true,
          upsellIncluded,
          negotiationIncluded,
          processingTime
        }
      };

    } catch (error) {
      logger.error('Response generation failed', { error, intent: intent.name });
      
      // Return fallback response with personality
      const fallbackResponse = this.personalityService.personalizeResponse(
        "I'm sorry, I'm having trouble understanding right now. Could you please try again?",
        context
      );

      return {
        text: fallbackResponse.text,
        confidence: 0.1,
        metadata: {
          intent: intent.name,
          personalityApplied: true,
          upsellIncluded: false,
          negotiationIncluded: false,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Generate base response based on intent
   */
  private async generateBaseResponse(
    intent: Intent,
    context: ConversationContext,
    businessContext: BusinessContext,
    originalMessage?: string
  ): Promise<string> {
    switch (intent.name) {
      case StoreIntent.GREETING:
        return this.generateGreetingResponse(context, businessContext);

      case StoreIntent.BROWSE_PRODUCTS:
        return this.generateBrowseResponse(intent, businessContext);

      case StoreIntent.PRODUCT_INQUIRY:
        return this.generateProductInquiryResponse(intent, businessContext);

      case StoreIntent.PRICE_INQUIRY:
        return this.generatePriceInquiryResponse(intent, businessContext);

      case StoreIntent.ADD_TO_CART:
        return this.generateAddToCartResponse(intent, businessContext);

      case StoreIntent.VIEW_CART:
        return this.generateViewCartResponse(businessContext);

      case StoreIntent.NEGOTIATE_PRICE:
        return this.generateNegotiationStartResponse(intent, businessContext);

      case StoreIntent.ASK_RECOMMENDATIONS:
        return this.generateRecommendationResponse(businessContext);

      case StoreIntent.FAREWELL:
        return this.generateFarewellResponse(context, businessContext);

      case StoreIntent.HELP:
        return this.generateHelpResponse();

      default:
        return this.generateUnknownIntentResponse(originalMessage);
    }
  }

  /**
   * Generate greeting response
   */
  private generateGreetingResponse(
    context: ConversationContext,
    businessContext: BusinessContext
  ): string {
    const customer = businessContext.sessionContext.customer;
    const personalityContext = {
      customerRelationship: customer ? 'returning' : 'new' as const,
      currentMood: 'welcoming' as const
    };

    return this.personalityService.getGreeting(customer, personalityContext);
  }

  /**
   * Generate browse products response
   */
  private generateBrowseResponse(
    intent: Intent,
    businessContext: BusinessContext
  ): string {
    const inventory = businessContext.inventory;
    const categories = [...new Set(inventory.map(p => p.category))];

    if (categories.length === 0) {
      return "I'm sorry, but we don't have any products available right now. Please check back later!";
    }

    const categoryList = categories.slice(0, 4).join(', ');
    const moreCategories = categories.length > 4 ? ` and ${categories.length - 4} more categories` : '';

    return `We have fresh ${categoryList}${moreCategories} available today! What type of produce are you looking for?`;
  }

  /**
   * Generate product inquiry response
   */
  private generateProductInquiryResponse(
    intent: Intent,
    businessContext: BusinessContext
  ): string {
    const productEntity = intent.entities.find(e => e.type === EntityType.PRODUCT_NAME);
    
    if (!productEntity) {
      return "What specific product would you like to know more about? I can tell you about freshness, origin, and nutritional information.";
    }

    const productName = productEntity.value.toLowerCase();
    const matchingProducts = businessContext.inventory.filter(p => 
      p.name.toLowerCase().includes(productName) && p.sellable
    );

    if (matchingProducts.length === 0) {
      return `I don't see ${productEntity.value} in our current inventory. Would you like me to suggest some similar products?`;
    }

    const product = matchingProducts[0];
    let response = `Our ${product.name} is ${product.description}. `;
    
    if (product.harvestDate) {
      const daysOld = Math.floor((Date.now() - product.harvestDate.getTime()) / (1000 * 60 * 60 * 24));
      response += `It was harvested ${daysOld === 0 ? 'today' : `${daysOld} days ago`}. `;
    }

    response += `We have ${product.stockQuantity} ${product.unit} available at ₱${product.basePrice.toFixed(2)} per ${product.unit}.`;

    return response;
  }

  /**
   * Generate price inquiry response
   */
  private generatePriceInquiryResponse(
    intent: Intent,
    businessContext: BusinessContext
  ): string {
    const productEntity = intent.entities.find(e => e.type === EntityType.PRODUCT_NAME);
    const quantityEntity = intent.entities.find(e => e.type === EntityType.QUANTITY);

    if (!productEntity) {
      return "Which product would you like to know the price for? I can give you current pricing and any available discounts.";
    }

    const productName = productEntity.value.toLowerCase();
    const matchingProducts = businessContext.inventory.filter(p => 
      p.name.toLowerCase().includes(productName) && p.sellable
    );

    if (matchingProducts.length === 0) {
      return `I don't have pricing information for ${productEntity.value} right now. Let me show you what we do have available.`;
    }

    const product = matchingProducts[0];
    let response = `${product.name} is ₱${product.basePrice.toFixed(2)} per ${product.unit}. `;

    if (quantityEntity) {
      const quantity = parseFloat(quantityEntity.value);
      const totalPrice = product.basePrice * quantity;
      response += `For ${quantity} ${product.unit}, that would be ₱${totalPrice.toFixed(2)}. `;
    }

    // Check for promotions
    const applicablePromotions = businessContext.promotions.filter(promo => 
      promo.applicableProducts.includes(product.id)
    );

    if (applicablePromotions.length > 0) {
      response += `We also have a special promotion running on this item!`;
    }

    return response;
  }

  /**
   * Generate add to cart response
   */
  private generateAddToCartResponse(
    intent: Intent,
    businessContext: BusinessContext
  ): string {
    const productEntity = intent.entities.find(e => e.type === EntityType.PRODUCT_NAME);
    const quantityEntity = intent.entities.find(e => e.type === EntityType.QUANTITY);

    if (!productEntity) {
      return "What would you like to add to your cart? I can help you find the perfect products for your needs.";
    }

    if (!quantityEntity) {
      return `How much ${productEntity.value} would you like? Please let me know the quantity and I'll add it to your cart.`;
    }

    const productName = productEntity.value.toLowerCase();
    const matchingProducts = businessContext.inventory.filter(p => 
      p.name.toLowerCase().includes(productName) && p.sellable
    );

    if (matchingProducts.length === 0) {
      return `I'm sorry, ${productEntity.value} isn't available right now. Would you like to see similar products?`;
    }

    const product = matchingProducts[0];
    const quantity = parseFloat(quantityEntity.value);

    if (quantity > product.stockQuantity) {
      return `I only have ${product.stockQuantity} ${product.unit} of ${product.name} available. Would you like to add that amount to your cart?`;
    }

    const totalPrice = product.basePrice * quantity;
    return `Perfect! I'll add ${quantity} ${product.unit} of ${product.name} to your cart for ₱${totalPrice.toFixed(2)}. Anything else you'd like?`;
  }

  /**
   * Generate view cart response
   */
  private generateViewCartResponse(businessContext: BusinessContext): string {
    // This would integrate with actual cart state when implemented
    return "Let me show you what's in your cart. You can review your items and proceed to checkout when you're ready.";
  }

  /**
   * Generate negotiation start response
   */
  private generateNegotiationStartResponse(
    intent: Intent,
    businessContext: BusinessContext
  ): string {
    const productEntity = intent.entities.find(e => e.type === EntityType.PRODUCT_NAME);
    const priceEntity = intent.entities.find(e => e.type === EntityType.PRICE);

    if (!productEntity || !priceEntity) {
      return "I'd be happy to discuss pricing with you! Which product are you interested in negotiating on?";
    }

    return `I see you're interested in negotiating the price for ${productEntity.value}. Let me see what I can do for you.`;
  }

  /**
   * Generate recommendation response
   */
  private generateRecommendationResponse(businessContext: BusinessContext): string {
    const featuredProducts = businessContext.inventory
      .filter(p => p.sellable && p.stockQuantity > 0)
      .slice(0, 3);

    if (featuredProducts.length === 0) {
      return "I'd love to make some recommendations, but we're currently restocking. Please check back soon!";
    }

    const productNames = featuredProducts.map(p => p.name).join(', ');
    return `Based on what's fresh today, I'd recommend our ${productNames}. They're all picked fresh and at great prices!`;
  }

  /**
   * Generate farewell response
   */
  private generateFarewellResponse(
    context: ConversationContext,
    businessContext: BusinessContext
  ): string {
    const customer = businessContext.sessionContext.customer;
    return this.personalityService.getFarewell(customer);
  }

  /**
   * Generate help response
   */
  private generateHelpResponse(): string {
    return "I'm here to help you find fresh produce! You can ask me about available products, prices, or get recommendations. I can also help you add items to your cart and answer questions about our farm-fresh inventory.";
  }

  /**
   * Generate unknown intent response
   */
  private generateUnknownIntentResponse(originalMessage?: string): string {
    const responses = [
      "I'm not sure I understand. Could you tell me what you're looking for?",
      "Let me help you with that. Are you looking for specific products or do you have questions about our inventory?",
      "I want to make sure I help you properly. Could you rephrase that or tell me what product you're interested in?",
      "I'm here to help with product information, pricing, and recommendations. What can I assist you with today?"
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Generate upsell suggestion
   */
  private async generateUpsellSuggestion(
    intent: Intent,
    context: ConversationContext,
    businessContext: BusinessContext
  ): Promise<string | null> {
    if (!this.upsellService.shouldOfferUpsell(context)) {
      return null;
    }

    // Simple upsell logic - could be enhanced with actual cart state
    const currentProducts = intent.entities
      .filter(e => e.type === EntityType.PRODUCT_NAME)
      .map(e => e.value);

    if (currentProducts.length === 0) {
      return null;
    }

    const currentProduct = currentProducts[0];
    const availableProducts = businessContext.inventory.filter(p => p.sellable);
    
    // Find a complementary product
    const complementaryProduct = availableProducts.find(p => 
      p.category !== businessContext.inventory.find(ip => 
        ip.name.toLowerCase().includes(currentProduct.toLowerCase())
      )?.category
    );

    if (!complementaryProduct) {
      return null;
    }

    return this.personalityService.getUpsellSuggestion(
      currentProduct,
      complementaryProduct.name,
      context
    );
  }

  /**
   * Generate negotiation response
   */
  private async generateNegotiationResponse(
    intent: Intent,
    context: ConversationContext,
    businessContext: BusinessContext
  ): Promise<string | null> {
    const priceEntity = intent.entities.find(e => e.type === EntityType.PRICE);
    const productEntity = intent.entities.find(e => e.type === EntityType.PRODUCT_NAME);

    if (!priceEntity || !productEntity || intent.name !== StoreIntent.NEGOTIATE_PRICE) {
      return null;
    }

    const customerOffer = parseFloat(priceEntity.value);
    const productName = productEntity.value;
    
    const product = businessContext.inventory.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase()) && p.sellable
    );

    if (!product) {
      return null;
    }

    const negotiationResult = this.personalityService.getNegotiationResponse(
      product.basePrice,
      customerOffer,
      product.name
    );

    return negotiationResult.response;
  }

  /**
   * Check if upsell should be included
   */
  private shouldIncludeUpsell(intent: Intent, context: ConversationContext): boolean {
    const upsellIntents = [
      StoreIntent.PRODUCT_INQUIRY,
      StoreIntent.ADD_TO_CART,
      StoreIntent.BROWSE_PRODUCTS
    ];

    return upsellIntents.includes(intent.name as StoreIntent);
  }

  /**
   * Check if negotiation should be included
   */
  private shouldIncludeNegotiation(intent: Intent, context: ConversationContext): boolean {
    return intent.name === StoreIntent.NEGOTIATE_PRICE;
  }

  /**
   * Truncate response to fit length constraints
   */
  private truncateResponse(response: string, maxLength: number): string {
    if (response.length <= maxLength) {
      return response;
    }

    // Try to truncate at sentence boundary
    const sentences = response.split('. ');
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence + '. ').length > maxLength) {
        break;
      }
      truncated += sentence + '. ';
    }

    return truncated.trim() || response.substring(0, maxLength - 3) + '...';
  }
}