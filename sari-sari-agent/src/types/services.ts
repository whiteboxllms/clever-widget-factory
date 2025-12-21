/**
 * Service interface definitions for the Sari Sari Agent system
 */

import {
  Product,
  ProductFilter,
  ProductDetails,
  AvailabilityInfo,
  CartItem,
  ConversationSession,
  ConversationContext,
  Customer,
  AgentResponse,
  SessionInfo,
  Intent,
  Entity,
  BusinessContext,
  Message,
  Promotion,
  Transaction,
  ProductSearchTerm,
  SemanticSearchResult,
  NegationFilter
} from './core';

// Agent Core Service
export interface AgentCore {
  processMessage(sessionId: string, message: string): Promise<AgentResponse>;
  initializeSession(customerId?: string): Promise<SessionInfo>;
  endSession(sessionId: string): Promise<void>;
}

// Inventory Service
export interface InventoryService {
  getAvailableProducts(filters?: ProductFilter): Promise<Product[]>;
  getSellableProducts(filters?: ProductFilter): Promise<Product[]>; // Only items marked for sale
  searchProductsSemantically(searchTerm: string, filters?: ProductFilter): Promise<SemanticSearchResult[]>;
  getProductDetails(productId: string): Promise<ProductDetails>;
  checkAvailability(productId: string, quantity: number): Promise<AvailabilityInfo>;
  reserveItems(items: CartItem[]): Promise<ReservationResult>;
  updateStock(transactions: StockTransaction[]): Promise<void>;
  toggleSellability(productId: string, sellable: boolean): Promise<void>;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  expiresAt?: Date;
  failedItems?: CartItem[];
  message?: string;
}

export interface StockTransaction {
  productId: string;
  quantityChange: number; // Positive for additions, negative for sales
  type: 'sale' | 'restock' | 'adjustment' | 'reservation';
  reference?: string; // Transaction ID or other reference
}

// NLP Service
export interface NLPService {
  analyzeIntent(message: string, context: ConversationContext): Promise<Intent>;
  extractEntities(message: string): Promise<Entity[]>;
  extractProductDescription(message: string): Promise<ProductSearchTerm>;
  extractNegations(message: string): Promise<NegationFilter[]>;
  generateResponse(intent: Intent, context: BusinessContext): Promise<string>;
  formatSearchResults(searchResults: Product[], originalQuery: string, negations?: NegationFilter[]): Promise<string>;
}

// Semantic Search Service
export interface SemanticSearchService {
  searchProducts(searchTerm: string, limit?: number): Promise<SemanticSearchResult[]>;
  generateEmbedding(text: string): Promise<number[]>;
  updateProductEmbeddings(products: Product[]): Promise<void>;
  logSearch(searchTerm: string, results: SemanticSearchResult[], sessionId: string): Promise<void>;
  getSimilarProducts(productId: string, limit?: number): Promise<Product[]>;
}

// Price Calculator
export interface PriceCalculator {
  calculatePrice(productId: string, quantity: number): Promise<PriceBreakdown>;
  getPromotions(productIds: string[]): Promise<Promotion[]>;
  applyDiscounts(cart: CartItem[], customer?: Customer): Promise<PricingResult>;
}

export interface PriceBreakdown {
  basePrice: number;
  quantity: number;
  subtotal: number;
  discounts: Discount[];
  taxes: Tax[];
  total: number;
}

export interface Discount {
  type: 'quantity' | 'seasonal' | 'customer' | 'promotion';
  name: string;
  amount: number;
  percentage?: number;
}

export interface Tax {
  type: string;
  rate: number;
  amount: number;
}

export interface PricingResult {
  items: PricedCartItem[];
  subtotal: number;
  totalDiscounts: number;
  totalTaxes: number;
  grandTotal: number;
}

export interface PricedCartItem extends CartItem {
  breakdown: PriceBreakdown;
}

// Database Service
export interface DatabaseService {
  // Product operations
  getProducts(filters?: ProductFilter): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;
  updateProductSellability(productId: string, sellable: boolean): Promise<void>;
  
  // Session management
  createSession(sessionData: ConversationSession): Promise<void>;
  getSession(sessionId: string): Promise<ConversationSession | null>;
  updateSession(sessionId: string, updates: Partial<ConversationSession>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Customer management
  createCustomer(customer: Customer): Promise<void>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<Customer>): Promise<void>;
  
  // Transaction management
  createTransaction(transaction: Transaction): Promise<void>;
  getTransactions(customerId?: string, limit?: number): Promise<Transaction[]>;
}

// Session Manager
export interface SessionManager {
  createSession(customerId?: string): Promise<SessionInfo>;
  getSession(sessionId: string): Promise<ConversationSession | null>;
  updateSession(sessionId: string, updates: Partial<ConversationSession>): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>; // Returns number of cleaned up sessions
}

// Analytics Service
export interface AnalyticsService {
  logInteraction(sessionId: string, event: AnalyticsEvent): Promise<void>;
  getSessionMetrics(timeRange: TimeRange): Promise<SessionMetrics>;
  getProductMetrics(timeRange: TimeRange): Promise<ProductMetrics>;
  getCostMetrics(timeRange: TimeRange): Promise<CostMetrics>;
}

export interface AnalyticsEvent {
  type: 'session_start' | 'message_sent' | 'product_viewed' | 'item_added' | 'purchase_completed';
  sessionId: string;
  customerId?: string;
  productId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface SessionMetrics {
  totalSessions: number;
  averageSessionDuration: number;
  conversionRate: number;
  popularProducts: string[];
}

export interface ProductMetrics {
  topSellingProducts: Array<{ productId: string; quantity: number; revenue: number }>;
  lowStockAlerts: string[];
  categoryPerformance: Record<string, number>;
}

export interface CostMetrics {
  totalCosts: number;
  costBreakdown: Record<string, number>;
  budgetUtilization: number; // Percentage of $50 budget used
  projectedMonthlyCost: number;
}