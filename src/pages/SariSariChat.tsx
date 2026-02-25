import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, ShoppingCart, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiService, getApiData } from '@/lib/apiService';
import { getThumbnailUrl } from '@/lib/imageUtils';

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
  image_url?: string;
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
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use TanStack Query for sellable products with caching and refresh
  const {
    data: availableProducts = [],
    isLoading: loadingProducts,
    error: productsError,
    refetch: refetchProducts
  } = useQuery({
    queryKey: ['parts', 'sellable'],
    queryFn: async (): Promise<Part[]> => {
      const response = await apiService.get<{ data: Part[] }>('/parts/sellable');
      const sellableProducts = getApiData(response) || [];
      
      console.log('✅ Loaded sellable products:', sellableProducts);
      console.log(`📋 Found ${sellableProducts.length} sellable items`);
      
      // Log specific products for debugging
      sellableProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - ₱${product.cost_per_unit || 0}${product.unit ? `/${product.unit}` : ''} (qty: ${product.current_quantity})`);
      });
      
      return sellableProducts;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: true, // Refresh when user comes back to the tab
    refetchOnMount: true, // Always fetch fresh data when component mounts
  });

  // Handle products error
  useEffect(() => {
    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      toast({
        title: "Error",
        description: "Failed to load available products. Click refresh to try again.",
        variant: "destructive",
      });
    }
  }, [productsError, toast]);

  // Manual refresh function
  const handleRefreshProducts = async () => {
    console.log('🔄 Manual refresh triggered');
    toast({
      title: "Refreshing Products",
      description: "Loading latest inventory...",
    });
    
    try {
      await refetchProducts();
      toast({
        title: "Products Refreshed",
        description: `Found ${availableProducts.length} available items`,
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh products. Please try again.",
        variant: "destructive",
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize session and get welcome message
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      const welcomeMessage: Message = {
        id: 'welcome-1',
        role: 'agent',
        content: "Welcome to Stargazer Farm 🌱\nWhat would you like to explore today?",
        timestamp: new Date(),
        suggestions: [
          "Show me available products"
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
    await sendMessageWithText(inputMessage);
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const agentResponse = await simulateAgentResponse(text);
      
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
    console.log('🔍 User query:', message);
    console.log('🤖 Calling sari-sari chat Lambda with SearchPipeline...');
    
    try {
      // Call Lambda - it now uses SearchPipeline for all queries
      const response = await apiService.post('/sari-sari/chat', {
        message,
        sessionId,
        conversationHistory
      });
      
      console.log('✅ Lambda response:', response);
      
      // Extract data from response
      const data = response.data || response;
      
      // Update conversation history
      if (data.conversationHistory) {
        setConversationHistory(data.conversationHistory);
      }
      
      if (data.debug) {
        console.log('🔍 Pipeline debug info:', data.debug);
      }

      // Convert products to ProductInfo format
      const products: ProductInfo[] = (data.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        availability: p.in_stock ? 'in-stock' : 'out-of-stock',
        description: p.description,
        unit: p.unit,
        current_quantity: p.stock_level,
        image_url: p.image_url
      }));
      
      return {
        text: data.response,
        products,
        suggestions: ["Tell me more", "Show similar items", "Add to cart"]
      };
    } catch (error) {
      console.error('❌ Chat service error:', error);
      return {
        text: "I'm having trouble right now. Could you try rephrasing or browse our available products?",
        suggestions: ["Show me products", "What's available today?", "Try again"]
      };
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
    // Auto-send if it's a common query
    if (suggestion === "Show me available products") {
      setTimeout(() => {
        sendMessageWithText(suggestion);
      }, 100);
    }
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
                Stargazer Farm Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Chat with our farm assistant to explore organic produce and wines.
              </p>
            </div>
          </div>
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
                          <Card key={product.id} className="border overflow-hidden">
                            <CardContent className="p-0">
                              {/* Product Image */}
                              <div className="w-full h-32 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center overflow-hidden">
                                {product.image_url ? (
                                  <img 
                                    src={getThumbnailUrl(product.image_url) || ''}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="text-4xl">🌿</div>
                                )}
                              </div>
                              
                              {/* Product Info */}
                              <div className="p-3">
                                <h4 className="font-medium text-sm mb-1">{product.name}</h4>
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                  {product.description}
                                </p>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">
                                    ₱{product.price.toFixed(2)}{product.unit ? `/${product.unit}` : ''}
                                  </span>
                                  <Button size="sm" variant="default" className="h-7">
                                    <ShoppingCart className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                </div>
                              </div>
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
              {loadingProducts 
                ? 'Loading products...' 
                : `Showing ${availableProducts.length} available products from your inventory${productsError ? ' (Error - click refresh)' : ''}`
              }
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}