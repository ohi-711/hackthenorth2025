class StockSwapPopup {
  constructor() {
    this.init();
  }

  async init() {
    try {
      // Load and display current stats
      await this.loadStats();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check for current product
      await this.checkCurrentProduct();
      
      // Load recent activity
      await this.loadRecentActivity();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
    }
  }

  async loadStats() {
    try {
      const data = await chrome.storage.local.get(['totalSavings', 'avoidedPurchases']);
      
      const totalSavings = data.totalSavings || 0;
      const purchasesAvoided = (data.avoidedPurchases || []).length;
      
      const totalSavingsElement = document.getElementById('total-savings');
      const purchasesAvoidedElement = document.getElementById('purchases-avoided');
      
      if (totalSavingsElement) {
        totalSavingsElement.textContent = `$${totalSavings.toFixed(2)}`;
      }
      if (purchasesAvoidedElement) {
        purchasesAvoidedElement.textContent = purchasesAvoided.toString();
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  setupEventListeners() {
    // Analyze button
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        this.analyzeCurrentProduct();
      });
    }

    // Quick action buttons
    const portfolioBtn = document.getElementById('portfolio-simulator');
    if (portfolioBtn) {
      portfolioBtn.addEventListener('click', () => {
        this.openPortfolioSimulator();
      });
    }

    const educationBtn = document.getElementById('education-hub');
    if (educationBtn) {
      educationBtn.addEventListener('click', () => {
        this.openEducationHub();
      });
    }

    const savingsBtn = document.getElementById('savings-tracker');
    if (savingsBtn) {
      savingsBtn.addEventListener('click', () => {
        this.openSavingsTracker();
      });
    }

    const strategyBtn = document.getElementById('strategy-comparison');
    if (strategyBtn) {
      strategyBtn.addEventListener('click', () => {
        this.openStrategyComparison();
      });
    }

    // Footer buttons
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.openHelp();
      });
    }
  }

  async checkCurrentProduct() {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.showNoProduct();
        return;
      }

      // Check if it's a shopping site
      const isShoppingSite = this.isShoppingWebsite(tab.url);
      
      if (isShoppingSite) {
        // Try to get product data from the content script
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'getCurrentProduct'
          });
          
          if (response && response.product) {
            this.displayCurrentProduct(response.product);
          } else {
            this.showShoppingSiteDetected(tab.url);
          }
        } catch (error) {
          console.log('Could not get product data from content script:', error);
          this.showShoppingSiteDetected(tab.url);
        }
      } else {
        this.showNoProduct();
      }
    } catch (error) {
      console.error('Failed to check current product:', error);
      this.showNoProduct();
    }
  }

  isShoppingWebsite(url) {
    if (!url) return false;
    
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const shoppingSites = [
        'amazon.com', 'amazon.ca', 'ebay.com', 'walmart.com',
        'target.com', 'bestbuy.com', 'shopify.com', 'etsy.com'
      ];
      
      return shoppingSites.some(site => hostname.includes(site));
    } catch {
      return false;
    }
  }

  displayCurrentProduct(product) {
    const productCard = document.getElementById('current-product');
    const noProduct = document.getElementById('no-product');
    const productName = document.getElementById('product-name');
    const productPrice = document.getElementById('product-price');
    
    if (productCard && noProduct) {
      if (productName) {
        productName.textContent = this.truncateText(product.name, 40);
      }
      if (productPrice) {
        productPrice.textContent = `$${product.price}`;
      }
      
      productCard.classList.remove('hidden');
      noProduct.style.display = 'none';
    }
  }

  showShoppingSiteDetected(url) {
    const noProduct = document.getElementById('no-product');
    if (noProduct) {
      try {
        const hostname = new URL(url).hostname;
        noProduct.innerHTML = `
          <p>Shopping on ${hostname}?</p>
          <p>Navigate to a product page to see investment alternatives!</p>
          <div class="supported-sites">
            <small>StockSwap is active and ready to help</small>
          </div>
        `;
      } catch (error) {
        noProduct.innerHTML = `
          <p>Shopping site detected!</p>
          <p>Navigate to a product page to see investment alternatives!</p>
        `;
      }
    }
  }

  showNoProduct() {
    const productCard = document.getElementById('current-product');
    const noProduct = document.getElementById('no-product');
    
    if (productCard && noProduct) {
      productCard.classList.add('hidden');
      noProduct.style.display = 'block';
      noProduct.innerHTML = `
        <p>Visit a shopping website to get started!</p>
        <div class="supported-sites">
          <small>Supported: Amazon, eBay, Best Buy, Walmart, Target</small>
        </div>
      `;
    }
  }

  async analyzeCurrentProduct() {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.showMessage('No active tab found', 'error');
        return;
      }

      // Send message to content script to show investment alternative
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showInvestmentAlternative'
      });

      // Close the popup
      window.close();
    } catch (error) {
      console.error('Failed to analyze current product:', error);
      this.showMessage('Failed to analyze product. Make sure you\'re on a product page.', 'error');
    }
  }

  async loadRecentActivity() {
    try {
      const data = await chrome.storage.local.get(['avoidedPurchases']);
      const purchases = data.avoidedPurchases || [];
      
      const activityList = document.getElementById('recent-activity');
      if (!activityList) return;

      if (purchases.length === 0) {
        activityList.innerHTML = '<div class="no-activity">No activity yet. Start shopping to see investment alternatives!</div>';
        return;
      }

      // Show last 5 activities
      const recentPurchases = purchases.slice(-5).reverse();
      
      activityList.innerHTML = recentPurchases.map(purchase => {
        const date = new Date(purchase.timestamp);
        const timeAgo = this.getTimeAgo(date);
        
        return `
          <div class="activity-item">
            <div>
              <div class="activity-description">Avoided: ${this.truncateText(purchase.name, 25)}</div>
              <div class="activity-time">${timeAgo}</div>
            </div>
            <div class="activity-amount">+$${purchase.price.toFixed(2)}</div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Quick Action Handlers
  openPortfolioSimulator() {
    this.showMessage('Opening RBC InvestEase Portfolio Simulator...', 'info');
    // In a real implementation, this would open the RBC API simulation
    setTimeout(() => {
      chrome.tabs.create({ url: 'https://www.rbcdirectinvesting.com/' });
    }, 1000);
  }

  openEducationHub() {
    this.showMessage('Opening Investment Education Hub...', 'info');
    // Create a simple education modal or redirect
    this.showEducationModal();
  }

  showEducationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    modal.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 350px; text-align: center;">
        <h3 style="margin-bottom: 20px; color: #333;">Investment Education</h3>
        <div style="text-align: left; margin-bottom: 20px;">
          <h4>Portfolio Strategies:</h4>
          <ul style="margin: 10px 0;">
            <li><strong>Conservative:</strong> Low risk, steady returns</li>
            <li><strong>Balanced:</strong> Medium risk, balanced growth</li>
            <li><strong>Aggressive:</strong> High risk, growth potential</li>
          </ul>
          
          <h4>Key Concepts:</h4>
          <ul style="margin: 10px 0;">
            <li>Dollar-cost averaging</li>
            <li>Diversification</li>
            <li>Compound interest</li>
            <li>Risk tolerance</li>
          </ul>
        </div>
        <button id="close-education" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Got it!</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-education').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  openSavingsTracker() {
    this.showMessage('Opening detailed savings tracker...', 'info');
    this.showSavingsDetail();
  }

  async showSavingsDetail() {
    try {
      const data = await chrome.storage.local.get(['avoidedPurchases', 'totalSavings']);
      const purchases = data.avoidedPurchases || [];
      const totalSavings = data.totalSavings || 0;

      // Calculate potential investment growth
      const conservativeGrowth = totalSavings * 1.07;
      const balancedGrowth = totalSavings * 1.14;
      const aggressiveGrowth = totalSavings * 1.25;

      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        overflow-y: auto;
      `;

      modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 350px; max-height: 80vh; overflow-y: auto;">
          <h3 style="margin-bottom: 20px; color: #333; text-align: center;">Your Savings Tracker</h3>
          
          <div style="background: linear-gradient(135deg, #e8f5e8 0%, #f1f8f1 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">$${totalSavings.toFixed(2)}</div>
            <div style="color: #666; font-size: 14px;">Total Saved</div>
          </div>

          <h4 style="margin-bottom: 15px; color: #333;">Potential 1-Year Growth:</h4>
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Conservative (7%):</span>
              <strong style="color: #28a745;">$${conservativeGrowth.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Balanced (14%):</span>
              <strong style="color: #17a2b8;">$${balancedGrowth.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Aggressive (25%):</span>
              <strong style="color: #fd7e14;">$${aggressiveGrowth.toFixed(2)}</strong>
            </div>
          </div>

          <h4 style="margin-bottom: 15px; color: #333;">Recent Savings:</h4>
          <div style="max-height: 150px; overflow-y: auto; margin-bottom: 20px;">
            ${purchases.slice(-5).reverse().map(purchase => `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
                <span style="font-size: 12px;">${this.truncateText(purchase.name, 20)}</span>
                <span style="color: #28a745; font-weight: bold;">$${purchase.price.toFixed(2)}</span>
              </div>
            `).join('') || '<div style="text-align: center; color: #666; font-style: italic;">No savings yet</div>'}
          </div>

          <button id="close-savings" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; width: 100%;">Close</button>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#close-savings').addEventListener('click', () => {
        modal.remove();
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (error) {
      console.error('Failed to show savings detail:', error);
    }
  }

  openStrategyComparison() {
    this.showMessage('Opening strategy comparison tool...', 'info');
  }

  openSettings() {
    this.showMessage('Settings coming soon...', 'info');
  }

  openHelp() {
    const helpContent = `
      <h3>How StockSwap Works</h3>
      <ol style="text-align: left; margin: 15px 0;">
        <li>Browse shopping websites normally</li>
        <li>Click the StockSwap button when you see a product</li>
        <li>View investment alternatives and portfolio projections</li>
        <li>Choose to invest instead of purchase</li>
        <li>Track your savings and learning progress</li>
      </ol>
      <p><strong>Supported Sites:</strong> Amazon, eBay, Best Buy, Walmart, Target</p>
      <p><strong>Powered by:</strong> RBC InvestEase API & Cohere AI</p>
    `;
    this.showInfoModal('Help & Guide', helpContent);
  }

  showInfoModal(title, content) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    modal.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 350px; text-align: center;">
        <h3 style="margin-bottom: 20px; color: #333;">${title}</h3>
        <div style="margin-bottom: 20px;">${content}</div>
        <button id="close-info" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Got it!</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-info').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showMessage(message, type = 'info') {
    // Create or get message container
    let messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'message-container';
      messageContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        z-index: 1001;
      `;
      document.body.appendChild(messageContainer);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.style.cssText = `
      background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
      color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
      border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
      font-size: 14px;
    `;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      messageDiv.remove();
      if (messageContainer.children.length === 0) {
        messageContainer.remove();
      }
    }, 3000);
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StockSwapPopup();
});

// Listen for storage changes to update stats in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.totalSavings || changes.avoidedPurchases)) {
    // Reload stats
    const popup = new StockSwapPopup();
    popup.loadStats();
    popup.loadRecentActivity();
  }
});