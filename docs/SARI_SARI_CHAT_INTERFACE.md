# Sari Sari Chat Interface

A conversational AI interface for the farm store that allows customers to browse products, check prices, and make purchases through natural language chat.

## Features

### Current Implementation (Demo)
- **Interactive Chat Interface**: Clean, modern chat UI with message bubbles
- **Simulated Agent Responses**: Intelligent responses based on message content
- **Product Display**: Visual product cards with pricing and availability
- **Suggestion System**: Quick-action buttons for common requests
- **Real-time Typing Indicators**: Shows when the agent is processing
- **Responsive Design**: Works on desktop and mobile devices

### Supported Interactions
- **Greetings**: "Hello", "Hi there"
- **Product Browsing**: "What vegetables do you have?", "Show me products"
- **Product Inquiries**: "Tell me about tomatoes", "What's fresh today?"
- **Price Checking**: "How much are tomatoes?", "Check prices"
- **Cart Management**: "Add to cart", "I want 2 tomatoes"
- **Price Negotiation**: "Can you do $3 for tomatoes?", "What's your best price?"
- **Farewells**: "Thank you", "Goodbye"

## Access

The chat interface is available through the main dashboard:

1. **Dashboard Tile**: Look for the "Sari Sari Store" tile with the orange bot icon
2. **Direct URL**: `/sari-sari-chat`
3. **Navigation**: Use the "Back to Dashboard" button to return

## Interface Components

### Header
- **Back Button**: Returns to main dashboard
- **Title**: "Sari Sari Store Assistant" with bot icon
- **Connection Status**: Shows connection state (demo mode)

### Chat Area
- **Message History**: Scrollable conversation with user and agent messages
- **Product Cards**: Interactive product displays with:
  - Product name and description
  - Current pricing
  - Availability status (in-stock, low-stock, out-of-stock)
  - Add to cart buttons
- **Suggestion Buttons**: Quick actions based on context
- **Typing Indicator**: Shows when agent is processing

### Input Area
- **Message Input**: Text field for typing messages
- **Send Button**: Submits messages (also works with Enter key)
- **Status Text**: Shows demo mode disclaimer

## Current Status

### Demo Mode
The current implementation is a **demo interface** that simulates agent responses. Key points:

- **No Backend Connection**: Responses are generated locally using predefined logic
- **Simulated Products**: Shows sample farm products (tomatoes, lettuce, carrots)
- **Mock Pricing**: Uses example prices for demonstration
- **Fake Inventory**: Simulated stock levels and availability

### Integration Ready
The interface is designed to easily integrate with the actual Agent Core:

```typescript
// Future integration point
const response = await agentCore.processMessage(sessionId, message);
```

## Technical Implementation

### Components Used
- **React Hooks**: `useState`, `useEffect`, `useRef` for state management
- **UI Components**: Shadcn/ui components (Card, Button, Input, ScrollArea, Badge)
- **Icons**: Lucide React icons (Bot, User, Send, ShoppingCart, etc.)
- **Routing**: React Router for navigation
- **Notifications**: Toast notifications for status updates

### Key Files
- `src/pages/SariSariChat.tsx` - Main chat interface component
- `src/pages/Dashboard.tsx` - Updated with new tile
- `src/App.tsx` - Added route configuration

### Styling
- **Tailwind CSS**: Utility-first styling
- **Responsive Design**: Mobile-friendly layout
- **Color Coding**: 
  - User messages: Blue theme
  - Agent messages: Green theme
  - Product availability: Color-coded badges
  - Connection status: Green for connected

## Future Enhancements

### Backend Integration
1. **Connect to Agent Core**: Replace simulated responses with actual AI agent
2. **Real Inventory**: Connect to farm inventory database
3. **Session Management**: Implement proper session handling
4. **Authentication**: Add user authentication if needed

### Advanced Features
1. **Voice Interface**: Add speech-to-text and text-to-speech
2. **Image Support**: Allow product images in responses
3. **Cart Persistence**: Save cart across sessions
4. **Payment Integration**: Add checkout and payment processing
5. **Multi-language**: Support for multiple languages
6. **Analytics**: Track conversation metrics and user behavior

### UI Improvements
1. **Message Reactions**: Allow users to rate responses
2. **Quick Actions**: More contextual action buttons
3. **Product Filtering**: Advanced product search and filtering
4. **Chat History**: Save and restore conversation history
5. **Typing Animations**: More sophisticated loading states

## Development Notes

### Adding New Response Types
To add new simulated responses, update the `simulateAgentResponse` function in `SariSariChat.tsx`:

```typescript
if (lowerMessage.includes('your-keyword')) {
  return {
    text: "Your response text",
    suggestions: ["Suggestion 1", "Suggestion 2"],
    products: [/* product objects */]
  };
}
```

### Styling Customization
The interface uses Tailwind CSS classes. Key styling areas:

- **Message Bubbles**: `.bg-blue-500` (user), `.bg-card` (agent)
- **Product Cards**: Standard card styling with hover effects
- **Availability Badges**: Color-coded based on stock status
- **Layout**: Flexbox for responsive design

### Performance Considerations
- **Message Scrolling**: Auto-scrolls to latest message
- **Simulated Delays**: Adds realistic response timing
- **Efficient Rendering**: Uses React keys for list items
- **Memory Management**: Limits message history if needed

This chat interface provides a solid foundation for the Sari Sari agent and can be easily enhanced as the backend services are integrated.