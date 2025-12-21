/**
 * Core type definitions for the Sari Sari Agent system
 */

// Product and Inventory Types
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  basePrice: number;
  stockQuantity: number;
  harvestDate?: Date;
  expiryDate?: Date;
  nutritionalInfo?: NutritionalData;
  tags: string[];
  // New field for MVP store functionality
  sellable: boolean; // Toggle for customer-facing availability
  // Semantic search fields
  embeddingText?: string; // Enhanced product description for embeddings
  embeddingVector?: number[]; // Vector embeddings for semantic search
}

export interface NutritionalData {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
}

export interface ProductFilter {
  category?: string;
  priceRange?: [number, number];
  inStock?: boolean;
  sellableOnly?: boolean; // New filter for customer-facing products
}

// Semantic Search Types
export interface ProductSearchTerm {
  extractedTerm: string;
  confidence: number;
  originalQuery: string;
  searchType: 'characteristic' | 'name' | 'category' | 'description';
  negations?: NegationFilter[];
}

export interface NegationFilter {
  negatedTerm: string;
  negationType: 'characteristic' | 'ingredient' | 'category' | 'attribute';
  confidence: number;
  originalPhrase: string;
}

export interface SemanticSearchResult {
  product: Product;
  similarity: number;
  searchTerm: string;
  timestamp: Date;
}

export interface SearchAttempt {
  originalQuery: string;
  extractedSearchTerm: string;
  searchResults: SemanticSearchResult[];
  selectedProducts: string[];
  timestamp: Date;
}

export interface ProductDetails extends Product {
  origin?: string;
  freshness?: 'excellent' | 'good' | 'fair';
  certifications?: string[];
  storageInstructions?: string;
}

export interface AvailabilityInfo {
  available: boolean;
  quantity: number;
  reservedQuantity: number;
  estimatedRestockDate?: Date;
  alternatives?: Product[];
}

// Session and Conversation Types
export interface ConversationSession {
  sessionId: string;
  customerId?: string;
  startTime: Date;
  lastActivity: Date;
  context: ConversationContext;
  cart: CartItem[];
  status: SessionStatus;
}

export interface ConversationContext {
  currentIntent?: string;
  entities: Record<string, any>;
  conversationHistory: Message[];
  preferences: CustomerPreferences;
  // Simplified for MVP
  negotiationHistory: NegotiationAttempt[];
  upsellAttempts: UpsellAttempt[];
  searchHistory: SearchAttempt[];
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NegotiationAttempt {
  productId: string;
  originalPrice: number;
  customerOffer?: number;
  agentCounterOffer?: number;
  outcome: 'accepted' | 'rejected' | 'ongoing';
  timestamp: Date;
}

export interface UpsellAttempt {
  suggestedProductId: string;
  context: string;
  customerResponse: 'interested' | 'declined' | 'ignored';
  timestamp: Date;
}

export type SessionStatus = 'active' | 'idle' | 'completed' | 'abandoned';

// Customer Types
export interface Customer {
  customerId: string;
  name?: string;
  phone?: string;
  email?: string;
  preferredLanguage: string;
  visitCount: number;
  totalSpent: number;
  favoriteCategories: string[];
  createdAt: Date;
  lastVisit: Date;
}

export interface CustomerPreferences {
  language: string;
  communicationStyle: 'formal' | 'casual';
  priceRange?: [number, number];
  favoriteCategories: string[];
  dietaryRestrictions?: string[];
}

// Cart and Transaction Types
export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  reservationId?: string;
}

export interface Transaction {
  transactionId: string;
  customerId?: string;
  sessionId: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: string;
  createdAt: Date;
}

// Agent Response Types
export interface AgentResponse {
  text: string;
  suggestions?: string[];
  products?: ProductInfo[];
  actions?: ActionItem[];
  metadata: ResponseMetadata;
}

export interface ProductInfo {
  id: string;
  name: string;
  price: number;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  description?: string;
}

export interface ActionItem {
  type: 'add-to-cart' | 'view-product' | 'negotiate-price' | 'checkout';
  productId?: string;
  data?: Record<string, any>;
}

export interface ResponseMetadata {
  sessionId: string;
  timestamp: Date;
  processingTime: number;
  confidence?: number;
  intent?: string;
}

// Session Management
export interface SessionInfo {
  sessionId: string;
  customerId?: string;
  startTime: Date;
  expiresAt: Date;
}

// Error Types
export interface ErrorResponse {
  type: 'system' | 'business' | 'user';
  code: string;
  message: string;
  suggestions?: string[];
  fallbackActions?: string[];
}

// Intent and Entity Types
export interface Intent {
  name: string;
  confidence: number;
  entities: Entity[];
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  start?: number;
  end?: number;
}

// Business Context
export interface BusinessContext {
  inventory: Product[];
  promotions: Promotion[];
  customerProfile?: Customer;
  sessionContext: ConversationContext;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'buy-x-get-y';
  discountValue: number;
  applicableProducts: string[];
  startDate: Date;
  endDate: Date;
  active: boolean;
}