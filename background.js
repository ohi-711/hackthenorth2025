// Smart Shopping Stock Advisor - Background Service Worker
console.log('Smart Shopping Stock Advisor background script loaded!');

// Extension installation and setup
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default user settings
    chrome.storage.sync.set({
      userGoals: {
        monthlyGoal: 1000,
        riskLevel: 'moderate'
      },
      settings: {
        notifications: true,
        priceAlerts: true,
        smartTips: true
      },
      monthlySavings: 0,
      purchaseHistory: [],
      lastResetDate: new Date().toISOString()
    });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🎉 Smart Shopping Advisor Ready!',
      message: 'Start making smarter financial decisions. Click the extension icon to set your goals.'
    });
  }
});

// Handle tab updates - detect shopping sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isShoppingSite = await isShoppingWebsite(tab.url);
    
    if (isShoppingSite) {
      // Inject content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            if (!document.getElementById('shopping-advisor-btn')) {
              console.log('Injecting shopping advisor on:', window.location.hostname);
            }
          }
        });
        
        // Show shopping site notification
        const settings = await chrome.storage.sync.get(['settings']);
        if (settings.settings?.notifications) {
          showShoppingAlert(tab.url);
        }
      } catch (error) {
        console.log('Could not inject script:', error);
      }
    }
  }
});

// Detect if website is a shopping site
function isShoppingWebsite(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const shoppingSites = [
      'amazon.com', 'amazon.ca', 'amazon.co.uk', 'amazon.de',
      'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com',
      'shopify.com', 'etsy.com', 'alibaba.com', 'aliexpress.com',
      'newegg.com', 'costco.com', 'homedepot.com', 'wayfair.com',
      'overstock.com', 'zappos.com', 'nordstrom.com', 'macys.com'
    ];
    
    return shoppingSites.some(site => hostname.includes(site)) || 
           hostname.includes('shop') || hostname.includes('store') || hostname.includes('buy');
  } catch {
    return false;
  }
}

// Show shopping alert notification
async function showShoppingAlert(url) {
  try {
    const hostname = new URL(url).hostname;
    const userData = await chrome.storage.sync.get(['userGoals', 'monthlySavings']);
    const monthlyGoal = userData.userGoals?.monthlyGoal || 1000;
    const currentSavings = userData.monthlySavings || 0;
    const remaining = monthlyGoal - currentSavings;
    
    if (remaining > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '💰 Smart Shopping Alert',
        message: `Shopping on ${hostname}? You have $${remaining.toFixed(2)} left in your monthly budget.`
      });
    }
  } catch (error) {
    console.error('Error showing shopping alert:', error);
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  switch (request.action) {
    case 'trackPurchaseDecision':
      handlePurchaseTracking(request.data);
      sendResponse({ success: true });
      break;
      
    /*case 'getStockData':
      getStockRecommendations(request.price, request.goals)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response*/
      
    case 'exportData':
      exportUserData()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Track purchase decisions and savings
async function handlePurchaseTracking(data) {
  try {
    const result = await chrome.storage.sync.get(['purchaseHistory', 'monthlySavings']);
    const history = result.purchaseHistory || [];
    const currentSavings = result.monthlySavings || 0;
    
    // Add to purchase history
    const purchaseRecord = {
      ...data,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };
    
    history.push(purchaseRecord);
    
    // Update monthly savings if it's a "saved" purchase
    let newSavings = currentSavings;
    if (data.decision === 'skip_purchase') {
      newSavings += data.amount || 0;
    }
    
    await chrome.storage.sync.set({
      purchaseHistory: history.slice(-100), // Keep last 100 records
      monthlySavings: newSavings
    });
    
    // Show congratulatory notification for savings
    if (data.decision === 'skip_purchase') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '🎉 Great Decision!',
        message: `You saved $${data.amount?.toFixed(2) || 0}! Total monthly savings: $${newSavings.toFixed(2)}`
      });
    }
  } catch (error) {
    console.error('Error tracking purchase:', error);
  }
}

// Get stock recommendations
async function getStockRecommendations(price, goals) {
  
  const { monthlyGoal = 1000, riskLevel = 'moderate' } = goals;
  const budgetImpact = price / monthlyGoal;
  
  if (budgetImpact > 0.3) {
    return {
      shouldBuy: false,
      reasoning: `This purchase represents ${(budgetImpact * 100).toFixed(0)}% of your monthly goal. Consider investing instead.`,
      alternative: `Invest $${price.toFixed(2)} in a diversified portfolio for potential long-term growth.`,
      stocks: []
    };
  }

  return {
    shouldBuy: true,
    reasoning: `This purchase fits your budget. Here's how you could invest ${price.toFixed(2)} instead:`,
    //stocks: recommendations.slice(0, 3) // Top 3 recommendations
  };
}

// Export user data for analysis
async function exportUserData() {
  try {
    const allData = await chrome.storage.sync.get(null);
    return {
      exportDate: new Date().toISOString(),
      ...allData
    };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// Show daily financial tip
async function showDailyFinancialTip() {
  try {
    const settings = await chrome.storage.sync.get(['settings']);
    if (!settings.settings?.smartTips) return;
    
    const tips = [
      "💡 The average American spends $1,986 per year on impulse purchases. Track yours!",
      "📊 Investing $100/month for 30 years at 7% return = $121,997. Start today!",
      "🎯 The 24-hour rule: Wait a day before any non-essential purchase over $50.",
      "💰 Pay yourself first: Set up automatic transfers to savings before spending.",
      "📈 Dollar-cost averaging: Invest the same amount regularly, regardless of market conditions.",
      "🛡️ Emergency fund goal: 3-6 months of expenses in a high-yield savings account.",
      "🔄 Review and cancel unused subscriptions monthly. Average savings: $273/year.",
      "📱 Use the extension before every online purchase to stay on track with your goals!"
    ];
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '💡 Daily Financial Tip',
      message: randomTip
    });
  } catch (error) {
    console.error('Error showing daily tip:', error);
  }
}

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "quickAnalyze",
    title: "💰 Analyze this price with Smart Shopping Advisor",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "openAdvisor",
    title: "📊 Open Smart Shopping Advisor",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "quickAnalyze" && info.selectionText) {
    // Extract price from selected text
    const priceMatch = info.selectionText.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      
      // Send message to content script to show investment tip
      chrome.tabs.sendMessage(tab.id, {
        action: 'showInvestmentTip',
        price: price
      });
    }
  }
  
  if (info.menuItemId === "openAdvisor") {
    // Open extension popup (this will open the popup programmatically)
    chrome.action.openPopup();
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open the extension when notification is clicked
  chrome.action.openPopup();
});

// Badge management - show savings progress
async function updateBadge() {
  try {
    const result = await chrome.storage.sync.get(['userGoals', 'monthlySavings']);
    const monthlyGoal = result.userGoals?.monthlyGoal || 1000;
    const currentSavings = result.monthlySavings || 0;
    const percentage = Math.min(Math.floor((currentSavings / monthlyGoal) * 100), 100);
    
    chrome.action.setBadgeText({
      text: percentage > 0 ? `${percentage}%` : ''
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: percentage >= 100 ? '#4CAF50' : percentage >= 50 ? '#FF9800' : '#F44336'
    });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update badge periodically
setInterval(updateBadge, 30000); // Every 30 seconds
updateBadge(); // Initial call

console.log('Smart Shopping Stock Advisor background script fully initialized!');