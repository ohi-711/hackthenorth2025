class StockSwapAPI {
  constructor() {
    this.rbcBaseUrl = "https://2dcq63co40.execute-api.us-east-1.amazonaws.com/dev";
    this.cohereBaseUrl = "https://api.cohere.ai/v1";
    this.cohereApiKey = ""; // replace with api key !!
    this.jwtToken = null;
    this.clientId = null;
    this.initPromise = null;
    this.isInitialized = false;
    
    // Start initialization but don't await it in constructor
    this.initPromise = this.init();
  }

  async init() {
    try {
      console.log('Initializing StockSwap API...');
      
      // Load stored credentials
      const stored = await chrome.storage.local.get(["jwtToken", "clientId"]);
      this.jwtToken = stored.jwtToken;
      this.clientId = stored.clientId;

      console.log('Stored credentials:', { hasToken: !!this.jwtToken, hasClient: !!this.clientId });

      // Register team if no token
      if (!this.jwtToken) {
        console.log('No JWT token, registering team...');
        await this.registerTeam();
      }

      // Create client if no client ID
      if (!this.clientId && this.jwtToken) {
        console.log('No client ID, creating client...');
        await this.createClient();
      }

      this.isInitialized = true;
      console.log('StockSwap API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize StockSwap API:', error);
      this.isInitialized = false;
    }
  }

  // Ensure API is initialized before any operation
  async ensureInitialized() {
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }
    return this.isInitialized;
  }

  async registerTeam() {
    try {
      console.log('Registering team with RBC API...');
      
      const response = await fetch(`${this.rbcBaseUrl}/teams/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team_name: `StockSwap_${Date.now()}`, // Make team name unique
          contact_email: `team${Date.now()}@stockswap.com`,
        }),
      });

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Registration failed:', errorText);
        throw new Error(`Registration failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Team registration response:', data);
      console.log('🔍 FULL REGISTRATION RESPONSE DEBUG:');
      console.log('  Response keys:', Object.keys(data));
      console.log('  Full response:', JSON.stringify(data, null, 2));

      if (data.jwtToken) {
        this.jwtToken = data.jwtToken;
        await chrome.storage.local.set({ jwtToken: this.jwtToken });
        console.log('JWT token stored successfully');
        
        // Debug JWT token format
        console.log('🔍 JWT TOKEN DEBUG:');
        console.log('  Length:', this.jwtToken.length);
        console.log('  First 100 chars:', this.jwtToken.substring(0, 100));
        console.log('  Contains dots:', this.jwtToken.includes('.'));
        console.log('  Dot count:', (this.jwtToken.match(/\./g) || []).length);
        
        // Check if it's a valid JWT format (should have 3 parts separated by dots)
        const parts = this.jwtToken.split('.');
        console.log('  JWT parts count:', parts.length);
        if (parts.length === 3) {
          console.log('  Header length:', parts[0].length);
          console.log('  Payload length:', parts[1].length);
          console.log('  Signature length:', parts[2].length);
        }
      } else {
        throw new Error('No JWT token in registration response');
      }
    } catch (error) {
      console.error('Failed to register team:', error);
      throw error;
    }
  }

  async createClient(userName = "Student User", userEmail = "student@university.com") {
    try {
      console.log('Creating client with RBC API...');
      
      if (!this.jwtToken) {
        throw new Error('No JWT token available for client creation');
      }

      const response = await fetch(`${this.rbcBaseUrl}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.jwtToken}`,
        },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          cash: 0,
        }),
      });

      console.log('Client creation response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Client creation failed:', errorText);
        throw new Error(`Client creation failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Client creation response:', data);

      if (data.id) {
        this.clientId = data.id;
        await chrome.storage.local.set({ clientId: this.clientId });
        console.log('Client ID stored successfully');
      } else {
        throw new Error('No client ID in creation response');
      }
    } catch (error) {
      console.error('Failed to create client:', error);
      throw error;
    }
  }

  async createPortfolio(strategy, amount) {
    try {
      console.log(`Creating ${strategy} portfolio with $${amount}...`);
      
      if (!this.clientId || !this.jwtToken) {
        throw new Error('Missing client ID or JWT token for portfolio creation');
      }

      // Debug the authorization header that will be sent
      const authHeader = `Bearer ${this.jwtToken}`;
      console.log('🔍 PORTFOLIO API DEBUG:');
      console.log('  Client ID:', this.clientId);
      console.log('  JWT Token length:', this.jwtToken.length);
      console.log('  JWT Token value:', this.jwtToken);
      console.log('  Authorization header:', authHeader);
      console.log('  Strategy:', strategy);
      console.log('  Amount:', amount);

      // Try different authentication methods based on the error
      let headers = {
        'Content-Type': 'application/json'
      };

      // The error suggests the API might expect a different format
      // Let's try some alternatives:
      console.log('🔍 TRYING DIFFERENT AUTH FORMATS:');
      
      // Method 1: Standard Bearer (current)
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
      console.log('  Method 1 - Bearer:', headers['Authorization']);
      
      // Method 2: Try without Bearer prefix
      // headers['Authorization'] = this.jwtToken;
      
      // Method 3: Try as API key
      // headers['x-api-key'] = this.jwtToken;
      
      // Method 4: Try as custom header
      // headers['x-jwt-token'] = this.jwtToken;

      const response = await fetch(`${this.rbcBaseUrl}/portfolios`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          client_id: this.clientId,
          strategy: strategy, // 'conservative', 'balanced', 'aggressive'
          initial_investment: amount
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Portfolio creation failed:', response.status, errorText);
        throw new Error(`Portfolio creation failed: ${response.status}`);
      }

      const portfolioData = await response.json();
      console.log('Portfolio created successfully:', portfolioData);
      
      // Simulate the portfolio for 1 year
      const simulationResponse = await fetch(`${this.rbcBaseUrl}/portfolios/${portfolioData.id}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwtToken}`
        },
        body: JSON.stringify({
          years: 1
        })
      });

      if (!simulationResponse.ok) {
        console.warn('Portfolio simulation failed, using fallback calculation');
        // Use fallback calculation
        const fallbackMultipliers = {
          conservative: 1.07,
          balanced: 1.10,
          aggressive: 1.15
        };
        return {
          strategy,
          initial_value: amount,
          projected_value: amount * (fallbackMultipliers[strategy] || 1.10),
          time_period: '1 year',
          source: 'fallback'
        };
      }

      const simulationData = await simulationResponse.json();
      console.log('Portfolio simulation complete:', simulationData);
      
      return {
        strategy,
        initial_value: amount,
        projected_value: simulationData.projected_value || amount * 1.10,
        time_period: '1 year',
        source: 'rbc_api',
        portfolio_id: portfolioData.id
      };

    } catch (error) {
      console.error('Portfolio creation/simulation failed:', error);
      
      // Fallback calculation
      const fallbackMultipliers = {
        conservative: 1.07,
        balanced: 1.10,
        aggressive: 1.15
      };
      
      return {
        strategy,
        initial_value: amount,
        projected_value: amount * (fallbackMultipliers[strategy] || 1.10),
        time_period: '1 year',
        source: 'fallback_error'
      };
    }
  }

  async analyzeProduct(productData) {
    try {
      console.log('Starting product analysis with RBC API...');
      
      // Ensure we're initialized
      await this.ensureInitialized();
      
      if (!this.clientId || !this.jwtToken) {
        console.warn('Missing RBC credentials, using fallback suggestions');
        return this.getFallbackSuggestions(productData);
      }

      // Create portfolios for all three strategies
      const strategies = ['conservative', 'balanced', 'aggressive'];
      const portfolioPromises = strategies.map(strategy => 
        this.createPortfolio(strategy, productData.price)
      );
      
      console.log('Creating portfolios for all strategies...');
      const portfolios = await Promise.all(portfolioPromises);
      
      // Get stock suggestions based on product category
      const fallbackData = this.getFallbackSuggestions(productData);
      
      return {
        stocks: fallbackData.stocks,
        portfolios: portfolios,
        education: fallbackData.education,
        explanation: `Instead of spending $${productData.price} on this item, see how investing that money could grow:`,
        api_source: portfolios.some(p => p.source === 'rbc_api') ? 'rbc_api' : 'fallback'
      };
      
    } catch (error) {
      console.error('Product analysis failed:', error);
      return this.getFallbackSuggestions(productData);
    }
  }

  getFallbackSuggestions(productData) {
    console.log('Generating fallback suggestions for:', productData);
    
    const suggestions = {
      electronics: { stocks: ["AAPL", "MSFT"], strategy: "balanced" },
      gaming: { stocks: ["NVDA", "AMD"], strategy: "aggressive" },
      fashion: { stocks: ["NKE", "LULU"], strategy: "balanced" },
      shoes: { stocks: ["NKE", "ADDYY"], strategy: "balanced" },
      clothing: { stocks: ["NKE", "LULU"], strategy: "balanced" },
      tech: { stocks: ["MSFT", "GOOGL"], strategy: "balanced" },
      home: { stocks: ["HD", "LOW"], strategy: "conservative" },
      dockers: { stocks: ["VFC", "NKE"], strategy: "balanced" }
    };

    const category = (productData.category || '').toLowerCase();
    const name = (productData.name || '').toLowerCase();
    const brand = (productData.brand || '').toLowerCase();
    
    // Try to match category, product name, or brand
    for (const [key, value] of Object.entries(suggestions)) {
      if (category.includes(key) || name.includes(key) || brand.includes(key)) {
        return {
          stocks: value.stocks,
          strategy: value.strategy,
          education: `Learn about investing in ${value.stocks.join(", ")} - companies in the ${key} sector that could benefit from consumer trends.`,
          explanation: `Instead of spending $${productData.price} on this ${key} item, consider investing in related companies like ${value.stocks.join(" or ")} for potential long-term growth.`,
        };
      }
    }

    // Default fallback
    return {
      stocks: ["SPY", "VTI"],
      strategy: "balanced",
      education: "Learn about diversified index fund investing with broad market ETFs that track the S&P 500 and total stock market.",
      explanation: `Consider investing your $${productData.price} in a diversified index fund instead. Historical market returns suggest this could grow to approximately $${(productData.price * 1.10).toFixed(2)} in one year.`,
    };
  }
}

// Initialize API instance
const investSmartAPI = new StockSwapAPI();

// Keep service worker alive
console.log('StockSwap background script loaded');

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  console.log('Sender:', sender);
  
  // Handle each action type
  switch (message.action) {
    case "analyzeProduct":
      handleAnalyzeProduct(message, sendResponse);
      return true; // Keep channel open for async response
      
    case "trackAvoidedPurchase":
      handleTrackPurchase(message, sendResponse);
      return true;
      
    default:
      console.log('Unknown action:', message.action);
      sendResponse({ error: `Unknown action: ${message.action}` });
      return false;
  }
});

async function handleAnalyzeProduct(message, sendResponse) {
  try {
    console.log('Analyzing product:', message.productData);
    
    const result = await investSmartAPI.analyzeProduct(message.productData);
    console.log('Analysis result:', result);
    
    sendResponse(result);
  } catch (error) {
    console.error('Analysis error:', error);
    // Absolute fallback
    sendResponse({
      stocks: ["SPY", "VTI"],
      strategy: "balanced",
      education: `Learn about investing in index funds instead of spending $${message.productData?.price || 100}`,
      explanation: "Instead of buying this item, consider investing in a diversified portfolio for long-term growth."
    });
  }
}

async function handleTrackPurchase(message, sendResponse) {
  try {
    const result = await trackAvoidedPurchase(message.productData);
    sendResponse(result);
  } catch (error) {
    console.error('Track purchase error:', error);
    sendResponse({ error: error.message });
  }
}

async function trackAvoidedPurchase(productData) {
  try {
    // Store avoided purchase in local storage for tracking
    const stored = await chrome.storage.local.get([
      "avoidedPurchases",
      "totalSavings",
    ]);
    const avoidedPurchases = stored.avoidedPurchases || [];
    const totalSavings = stored.totalSavings || 0;

    const newPurchase = {
      ...productData,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    };

    avoidedPurchases.push(newPurchase);
    const newTotalSavings = totalSavings + productData.price;

    await chrome.storage.local.set({
      avoidedPurchases: avoidedPurchases.slice(-50), // Keep last 50 purchases
      totalSavings: newTotalSavings,
    });

    // Show success notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icon48.png",
      title: "Smart Choice!",
      message: `You saved $${productData.price}! Total savings: $${newTotalSavings.toFixed(2)}`,
    });

    return { success: true, totalSavings: newTotalSavings };
  } catch (error) {
    console.error("Failed to track avoided purchase:", error);
    throw error;
  }
}

// Handle tab updates - detect shopping sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const isShoppingSite = isShoppingWebsite(tab.url);
    if (isShoppingSite) {
      // Inject shopping detection
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Signal to content script that this is a shopping site
            window.postMessage({ type: "STOCKSWAP_SHOPPING_SITE" }, "*");
          },
        });
      } catch (error) {
        console.log("Could not inject script:", error);
      }
    }
  }
});

function isShoppingWebsite(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const shoppingSites = [
      "amazon.com",
      "amazon.ca", 
      "ebay.com",
      "walmart.com",
      "target.com",
      "bestbuy.com",
      "shopify.com",
      "etsy.com",
    ];
    return shoppingSites.some((site) => hostname.includes(site));
  } catch {
    return false;
  }
}

// Installation handler
chrome.runtime.onInstalled.addListener(() => {
  console.log("StockSwap Shopping Advisor installed");
  // Initialize storage with API key for demo
  chrome.storage.local.set({
    totalSavings: 0,
    avoidedPurchases: [],
    learningProgress: {},
    cohereApiKey: "eL8tMALym78D2JyJipo3C7hF13e13tHxvZiBWT4b" // TODO: Move to secure config
  });
});

// Context menu for quick analysis
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzePrice",
    title: "Analyze with StockSwap",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzePrice" && info.selectionText) {
    const priceMatch = info.selectionText.match(
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
    );
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      chrome.tabs.sendMessage(tab.id, {
        action: "showInvestmentSuggestion",
        price: price,
      });
    }
  }
});

console.log("StockSwap Shopping Advisor background script loaded!");