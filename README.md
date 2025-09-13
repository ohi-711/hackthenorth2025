# InvestSmart Shopping Advisor 💡💰

A Chrome extension that transforms online shopping impulses into investment learning opportunities using RBC InvestEase's portfolio simulator and Cohere's AI for intelligent suggestions.

## 🚀 Core Concept

InvestSmart helps students and young adults make smarter financial decisions by showing them investment alternatives to impulse purchases. Instead of buying that $200 gadget, see how investing that money could grow over time!

## 🛠️ How It Works

### 1. Shopping Detection & Interception

- **Content Script** monitors popular shopping websites (Amazon, Best Buy, eBay, etc.)
- Automatically detects product pages and extracts:
  - Product name and price
  - Brand and category
  - Current URL for context

### 2. Cohere AI-Powered Analysis

- Sends product data to **Cohere API** for intelligent processing
- Maps products to relevant stock companies (iPhone → AAPL, PlayStation → SONY)
- Generates personalized investment suggestions
- Creates educational content about the company
- Suggests portfolio strategies based on user's risk profile

### 3. RBC InvestEase Integration

- **Team Registration**: Registers extension as hackathon team via `/teams/register`
- **Client Management**: Each user becomes a client via `/clients` endpoints
- **Portfolio Simulation**: Creates portfolios with different strategies using `/clients/{clientId}/portfolios`
- **What-If Analysis**: Uses `/client/{clientId}/simulate` to show growth projections

## 📱 Extension UI Flow

```
┌─────────────────────────────┐
│ 🛍️ Shopping for AirPods?    │
│ Price: $249                 │
│                             │
│ 💡 Investment Alternative:   │
│ "Invest in Apple (AAPL)     │
│ instead!"                   │
│                             │
│ 📊 Simulation Results:      │
│ • Conservative: $267 (1yr)  │
│ • Balanced: $284 (1yr)      │
│ • Aggressive: $312 (1yr)    │
│                             │
│ [💰 Try Simulation]         │
│ [📚 Learn About AAPL]      │
│ [❌ Not Now]               │
└─────────────────────────────┘
```

## 🏗️ Technical Architecture

### Frontend (Chrome Extension)

```
manifest.json
├── background.js (API calls, auth management)
├── content.js (page detection, product extraction)
├── popup/
│   ├── popup.html
│   ├── popup.js (UI logic)
│   └── popup.css
└── assets/ (icons, images)
```

### API Integration Flow

1. **Extension loads** → Register team → Store JWT token
2. **User detected** → Create client (if first time)
3. **Product detected** → Send to Cohere for analysis
4. **Cohere returns** → Stock suggestions + educational content
5. **User interested** → Create simulation portfolios
6. **Show results** → Use `/simulate` endpoint for projections
7. **User commits** → Add "avoided purchase" to portfolio tracker

### Data Flow

```
Shopping Page → Content Script → Background Script
                                      ↓
                               Cohere API (product analysis)
                                      ↓
                               RBC API (portfolio simulation)
                                      ↓
                               Popup UI (results display)
```

## ✨ Key Features

### 1. Smart Product-to-Stock Mapping

- Cohere analyzes product context and suggests relevant stocks
- "Gaming laptop" → suggests NVDA, AMD, INTC
- "Tesla accessories" → suggests TSLA

### 2. Educational Investment Simulator

- Creates mock portfolios with "avoided purchase" money
- Shows how different strategies (Conservative → Aggressive Growth) perform
- Tracks learning progress over time

### 3. Personalized Recommendations

- Cohere learns spending patterns
- Suggests portfolio strategies based on risk tolerance
- Provides market context and timing advice

### 4. Portfolio Strategy Comparison

```javascript
// Example API calls for comparison
const strategies = ["conservative", "balanced", "aggressive_growth"];
const simulationResults = await Promise.all(
  strategies.map(
    (strategy) =>
      createPortfolio(clientId, strategy, productPrice).then((portfolio) =>
        simulatePortfolio(clientId, 12)
      ) // 12 months
  )
);
```

### 5. Learning Progress Tracker

- Dashboard showing "purchases avoided"
- Portfolio performance across different strategies
- Educational achievements and milestones

## 🔌 RBC API Usage

### Setup Phase

```javascript
// Register team and get JWT
POST /teams/register
{ "team_name": "InvestSmart", "contact_email": "team@investsmart.com" }

// Create user as client
POST /clients
{ "name": "John Student", "email": "john@university.com", "cash": 0 }
```

### Per Shopping Session

```javascript
// When user wants to simulate investment
POST /clients/{clientId}/deposit
{ "amount": productPrice } // Add "avoided purchase" money

// Create portfolio for simulation
POST /clients/{clientId}/portfolios
{ "type": "balanced", "initialAmount": productPrice }

// Run simulation
POST /client/{clientId}/simulate
{ "months": 12 }

// Get analysis
GET /portfolios/{portfolioId}/analysis
```

## 🤖 Cohere Integration

### Product Analysis

```javascript
const coherePrompt = `
Product: ${productName}
Price: ${productPrice}
Context: Student is considering this purchase

Suggest:
1. Related public companies to invest in
2. Educational content about the company
3. Investment strategy recommendation
4. Engaging explanation of why investing might be better
`;
```

### Personalization

- Track user's shopping categories
- Build risk tolerance profile
- Generate contextual investment education

## 📊 Success Metrics

1. **Educational Value**: Users learn about different portfolio strategies
2. **Engagement**: Time spent exploring simulations vs. immediate purchases
3. **Learning Progress**: Portfolio performance understanding over time
4. **Practical Application**: Students actually start investing in real life

## 🚀 Getting Started

### Prerequisites

- Chrome browser
- Node.js (for development)
- RBC InvestEase API access
- Cohere API key

### Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Load the extension in Chrome Developer Mode
4. Navigate to a shopping website and start saving!

### Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🔒 Environment Variables

Create a `.env` file with:

```
COHERE_API_KEY=your_cohere_api_key_here
RBC_API_BASE_URL=https://rbc-investease-api.com/api/v1
```

## 🌟 Supported Shopping Sites

- Amazon (amazon.com, amazon.ca)
- eBay (ebay.com)
- Best Buy (bestbuy.com)
- Walmart (walmart.com)
- Target (target.com)
- Shopify stores

## 🤝 Contributing

We welcome contributions! Please see our Contributing Guidelines for details.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 Hack the North 2025

Built with ❤️ for Hack the North 2025, demonstrating the power of combining financial education with smart technology to help students make better financial decisions.

---

**Team InvestSmart** - Empowering smart financial decisions, one purchase at a time! 💡💰
