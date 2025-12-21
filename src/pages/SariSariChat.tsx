import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, ShoppingCart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  products?: ProductInfo[];
}

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  description?: string;
  unit?: string;
  current_quantity?: number;
}

interface Part {
  id: string;
  name: string;
  description: string | null;
  current_quantity: number;
  minimum_quantity: number | null;
  cost_per_unit: number | null;
  unit: string | null;
  sellable: boolean;
  image_url: string | null;
}

export default function SariSariChat() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Part[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize session and get welcome message
    initializeChat();
    // Fetch available products
    fetchAvailableProducts();
  }, []);

  const fetchAvailableProducts = async () => {
    try {
      setLoadingProducts(true);
      const { apiService, getApiData } = await import('@/lib/apiService');
      const response = await apiService.get<{ data: Part[] }>('/parts/sellable');
      const sellableProducts = getApiData(response) || [];
      
      setAvailableProducts(sellableProducts);
      
      console.log('Loaded sellable products:', sellableProducts);
      console.log(`Found ${sellableProducts.length} sellable items`);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load available products",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const initializeChat = async () => {
    try {
      const welcomeMessage: Message = {
        id: 'welcome-1',
        role: 'agent',
        content: "Hello! Welcome to our farm store! I can help you browse our available products, check prices, and add items to your cart. What would you like to see today?",
        timestamp: new Date(),
        suggestions: [
          "Show me available products",
          "What's fresh today?",
          "Check prices"
        ]
      };
      
      setMessages([welcomeMessage]);
      setSessionId('live-session-' + Date.now());
      
      toast({
        title: "Connected to Sari Sari Store",
        description: "Browse our real inventory and chat with our assistant!",
      });
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to load store data.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Simulate agent response (in real implementation, this would call the AgentCore)
      const agentResponse = await simulateAgentResponse(inputMessage);
      
      const agentMessage: Message = {
        id: 'agent-' + Date.now(),
        role: 'agent',
        content: agentResponse.text,
        timestamp: new Date(),
        suggestions: agentResponse.suggestions,
        products: agentResponse.products
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get response from agent",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Extract product search term from user query
   * Extracts the key product characteristics/names for semantic search
   */
  const extractProductSearchTerm = (userQuery: string): string => {
    const query = userQuery.toLowerCase();
    
    // Product keywords that should be preserved
    const productKeywords = [
      // Characteristics
      'spicy', 'hot', 'sweet', 'sour', 'salty', 'bitter', 'fresh', 'organic', 'pure', 'natural',
      'mild', 'strong', 'light', 'heavy', 'thick', 'thin', 'smooth', 'rough', 'soft', 'hard',
      'long', 'short', 'big', 'small', 'large', 'tiny', 'cold', 'warm', 'cool',
      // Product names
      'vinegar', 'sauce', 'pepper', 'salt', 'sugar', 'oil', 'water', 'juice', 'milk',
      'rice', 'bread', 'meat', 'fish', 'chicken', 'pork', 'beef', 'vegetables', 'fruits',
      'tomato', 'onion', 'garlic', 'ginger', 'chili', 'lemon', 'lime', 'coconut',
      // Categories
      'food', 'drink', 'beverage', 'snack', 'candy', 'chocolate', 'cookie', 'cake',
      'spices', 'condiments', 'seasoning', 'herbs', 'grains', 'cereals', 'pasta',
      'dairy', 'cheese', 'butter', 'yogurt', 'cream'
    ];
    
    // Remove common question words and phrases
    let cleanedQuery = query
      .replace(/^(what|show me|find me|get me|i want|i need|do you have|can you show|looking for)\s*/i, '')
      .replace(/\b(products?|items?|things?|stuff|food|foods)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract product keywords from the cleaned query
    const words = cleanedQuery.split(/\s+/);
    const extractedKeywords = words.filter(word => 
      productKeywords.includes(word) || 
      word.length > 3 // Include longer words that might be product names
    );

    // If we found specific keywords, use them; otherwise use the cleaned query
    let extractedTerm;
    if (extractedKeywords.length > 0) {
      extractedTerm = extractedKeywords.join(' ');
    } else {
      // Fallback to cleaned query if no specific keywords found
      extractedTerm = cleanedQuery.length > 2 ? cleanedQuery : userQuery;
    }

    console.log('🔍 Product search term extraction:', {
      originalQuery: userQuery,
      cleanedQuery,
      extractedKeywords,
      extractedTerm
    });

    return extractedTerm;
  };

  const convertPartToProductInfo = (part: Part): ProductInfo => {
    const getAvailability = (part: Part): 'in-stock' | 'low-stock' | 'out-of-stock' => {
      if (part.current_quantity <= 0) return 'out-of-stock';
      if (part.minimum_quantity && part.current_quantity <= part.minimum_quantity) return 'low-stock';
      return 'in-stock';
    };

    return {
      id: part.id,
      name: part.name,
      price: part.cost_per_unit || 0,
      availability: getAvailability(part),
      description: part.description || undefined,
      unit: part.unit || undefined,
      current_quantity: part.current_quantity
    };
  };

  const simulateAgentResponse = async (message: string): Promise<{
    text: string;
    suggestions?: string[];
    products?: ProductInfo[];
  }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return {
        text: "Hello there! Great to see you! Let me know what you need and I'll find the perfect produce for you.",
        suggestions: ["Show me products", "What's available today?", "Check prices"]
      };
    }

    if (lowerMessage.includes('product') || lowerMessage.includes('available') || lowerMessage.includes('show')) {
      if (availableProducts.length === 0) {
        return {
          text: "I'm sorry, we don't have any products available for sale right now. Please check back later!",
          suggestions: ["Check back later", "Contact us"]
        };
      }

      const products = availableProducts.slice(0, 6).map(convertPartToProductInfo);
      return {
        text: `Here are our available products today (${availableProducts.length} items total):`,
        suggestions: ["Tell me more about an item", "Add to cart", "Check prices"],
        products
      };
    }

    // Use semantic search for product queries
    console.log('🔍 User query:', message);
    console.log('🔍 Checking if query needs semantic search...');
    
    // Check if this looks like a product search query
    const productSearchKeywords = ['spicy', 'hot', 'sweet', 'sour', 'fresh', 'vinegar', 'sauce', 'pepper', 'what', 'find', 'have', 'get'];
    const isProductQuery = productSearchKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (isProductQuery) {
      console.log('🎯 Detected product search query, using semantic search...');
      
      // Extract the search term but preserve natural language for semantic search
      const extractedSearchTerm = extractProductSearchTerm(message);
      console.log('🔍 Search term being sent to semantic search:', extractedSearchTerm);
      
      try {
        // Use the same semantic search approach as CombinedAssetsContainer
        console.log('🔍 Calling semantic search via apiService...');
        
        const response = await apiService.post('/semantic-search', {
          query: extractedSearchTerm,
          table: 'parts',
          limit: 6
        });

        console.log('✅ Semantic search API response:', response);
        
        // Extract results using the same pattern as CombinedAssetsContainer
        const semanticResults = response?.results || response?.data?.results || [];
        console.log(`🔍 Found ${semanticResults.length} semantic search results`);
        
        if (semanticResults.length > 0) {
          console.log('🎯 Raw semantic search results:');
          semanticResults.forEach((item: any, index: number) => {
            console.log(`   ${index + 1}. ${item.name} (similarity: ${item.similarity || item.distance || 'N/A'})`);
            if (item.description) {
              console.log(`      Description: ${item.description.substring(0, 100)}...`);
            }
          });
          
          // Convert semantic search results to ProductInfo format
          const products: ProductInfo[] = semanticResults.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.cost_per_unit || '0'),
            availability: item.current_quantity > 0 ? 'in-stock' : 'out-of-stock',
            description: item.description,
            unit: item.unit,
            current_quantity: item.current_quantity
          }));

          console.log('🎯 Converted semantic search results:', products.map(p => p.name));
          
          return {
            text: `Found ${semanticResults.length} products using AI semantic search! Here's what matches your request:`,
            suggestions: ["Add to cart", "Tell me more", "Show me similar products"],
            products
          };
        } else {
          console.log('🔍 No semantic search results found');
        }
      } catch (error) {
        console.error('❌ Semantic search error:', error);
        console.log('🔄 Falling back to simple text search...');
      }
    }

    // Fallback to simple text search
    console.log('🔄 Using fallback text search...');
    console.log('🔍 Available products for text search:', availableProducts.length);
    console.log('🔍 Search terms in message:', lowerMessage);
    
    const matchingProducts = availableProducts.filter(part => {
      const nameMatch = part.name.toLowerCase().includes(lowerMessage);
      const descMatch = part.description && part.description.toLowerCase().includes(lowerMessage);
      const matches = nameMatch || descMatch;
      
      if (matches) {
        console.log(`✅ Text search match: ${part.name} (name: ${nameMatch}, desc: ${descMatch})`);
      }
      
      return matches;
    });

    console.log(`📋 Text search found ${matchingProducts.length} products:`, matchingProducts.map(p => p.name));
    
    // Special debug for spicy queries
    if (lowerMessage.includes('spic')) {
      console.log('🌶️  SPICY QUERY DEBUG:');
      console.log('   All available products:');
      availableProducts.forEach(p => {
        console.log(`     - ${p.name} (sellable: ${p.sellable}, qty: ${p.current_quantity})`);
        if (p.description) {
          console.log(`       Description: ${p.description.substring(0, 100)}...`);
        }
      });
      
      console.log('   Products with "spice" in name:');
      availableProducts.forEach(p => {
        if (p.name.toLowerCase().includes('spice')) {
          console.log(`     ✅ ${p.name}`);
        }
      });
      
      console.log('   Products with "spice" in description:');
      availableProducts.forEach(p => {
        if (p.description && p.description.toLowerCase().includes('spice')) {
          console.log(`     ✅ ${p.name}: ${p.description.substring(0, 100)}...`);
        }
      });
      
      console.log('   Text search matches for spicy query:');
      matchingProducts.forEach(p => {
        console.log(`     - ${p.name} (matched because: ${p.name.toLowerCase().includes(lowerMessage) ? 'name' : 'description'})`);
      });
      
      if (matchingProducts.some(p => p.name.toLowerCase().includes('pure vinegar'))) {
        console.log('❌ FOUND PURE VINEGAR - This is the problem!');
        const pureVinegar = matchingProducts.find(p => p.name.toLowerCase().includes('pure vinegar'));
        if (pureVinegar) {
          console.log(`   Pure vinegar details: ${pureVinegar.name}`);
          console.log(`   Description: ${pureVinegar.description}`);
          console.log(`   Why it matched: name includes "${lowerMessage}"? ${pureVinegar.name.toLowerCase().includes(lowerMessage)}`);
          console.log(`   Why it matched: description includes "${lowerMessage}"? ${pureVinegar.description && pureVinegar.description.toLowerCase().includes(lowerMessage)}`);
        }
      }
    }

    if (matchingProducts.length > 0) {
      const products = matchingProducts.slice(0, 3).map(convertPartToProductInfo);
      
      return {
        text: `Found ${matchingProducts.length} matching product${matchingProducts.length > 1 ? 's' : ''} using text search:`,
        suggestions: ["Add to cart", "Tell me more", "Show me similar products"],
        products
      };
    }

    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      if (availableProducts.length === 0) {
        return {
          text: "We don't have any products available for pricing right now.",
          suggestions: ["Check back later"]
        };
      }

      const priceInfo = availableProducts.slice(0, 3).map(part => 
        `${part.name}: ₱${(part.cost_per_unit || 0).toFixed(2)}${part.unit ? `/${part.unit}` : ''}`
      ).join(', ');

      return {
        text: `Here are some of our current prices: ${priceInfo}. All fresh from the farm!`,
        suggestions: ["Show me all products", "Add to cart", "Negotiate price"]
      };
    }

    if (lowerMessage.includes('cart') || lowerMessage.includes('buy')) {
      return {
        text: "I'd be happy to help you add items to your cart! Which product would you like and how much?",
        suggestions: ["Show me products", "Check availability"]
      };
    }

    if (lowerMessage.includes('negotiate') || lowerMessage.includes('deal')) {
      return {
        text: "I can work with you on pricing! What did you have in mind? I'm always willing to make a fair deal for good customers.",
        suggestions: ["Show me products", "Make an offer"]
      };
    }

    if (lowerMessage.includes('thank') || lowerMessage.includes('bye')) {
      return {
        text: "Thank you for visiting our farm store! Enjoy your fresh produce and come back soon!",
        suggestions: []
      };
    }

    // Default response
    return {
      text: "I can help you find fresh produce, check prices, or add items to your cart. What would you like to know about our farm products?",
      suggestions: ["Show me products", "Check prices", "What's available today?"]
    };
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock': return 'bg-green-500';
      case 'low-stock': return 'bg-yellow-500';
      case 'out-of-stock': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="h-6 w-6 text-green-600" />
                Sari Sari Store Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Chat with our AI assistant to browse and purchase fresh farm produce
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {sessionId ? 'Connected' : 'Connecting...'}
          </Badge>
        </div>
      </header>

      {/* Chat Interface */}
      <main className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-500 text-white'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Card
                      className={`${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-card'
                      }`}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Products */}
                    {message.products && message.products.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {message.products.map((product) => (
                          <Card key={product.id} className="border">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-sm">{product.name}</h4>
                                <Badge
                                  className={`text-xs ${getAvailabilityColor(product.availability)} text-white`}
                                >
                                  {product.availability}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {product.description}
                              </p>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-green-600">
                                  ₱{product.price.toFixed(2)}{product.unit ? `/${product.unit}` : ''}
                                </span>
                                <Button size="sm" variant="outline">
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              </div>
                              {product.current_quantity !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                  Available: {product.current_quantity} {product.unit || 'units'}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-xs"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <Card className="bg-card">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          Agent is thinking...
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-card p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about products, prices, or add items to cart..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {loadingProducts ? 'Loading products...' : `Showing ${availableProducts.length} available products from your inventory`}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}