document.addEventListener('DOMContentLoaded', function() {
  const savingsGoalInput = document.getElementById('savingsGoal');
  const riskLevelSelect = document.getElementById('riskLevel');
  const saveGoalsBtn = document.getElementById('saveGoals');
  const detectPriceBtn = document.getElementById('detectPrice');
  const manualPriceInput = document.getElementById('manualPrice');
  const getRecommendationsBtn = document.getElementById('getRecommendations');
  const status = document.getElementById('status');
  const detectedPriceDiv = document.getElementById('detectedPrice');
  const recommendationsDiv = document.getElementById('recommendations');
  const progressFill = document.getElementById('progressFill');
  const savedAmountDiv = document.getElementById('savedAmount');

  let currentPrice = 0;
  let userGoals = {};

  // Load saved data
  loadUserData();

  // Function to show status messages
  function showStatus(message, type = 'success') {
    status.textContent = message;
    status.className = type;
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 4000);
  }

  // Load user data from storage
  async function loadUserData() {
    try {
      const result = await chrome.storage.sync.get(['userGoals', 'monthlySavings']);
      if (result.userGoals) {
        userGoals = result.userGoals;
        savingsGoalInput.value = userGoals.monthlyGoal || '';
        riskLevelSelect.value = userGoals.riskLevel || 'moderate';
      }
      
      const monthlySavings = result.monthlySavings || 0;
      updateSavingsProgress(monthlySavings);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Update savings progress
  function updateSavingsProgress(saved) {
    const goal = userGoals.monthlyGoal || 1000;
    const percentage = Math.min((saved / goal) * 100, 100);
    progressFill.style.width = percentage + '%';
    savedAmountDiv.textContent = `Saved this month: $${saved.toFixed(2)}`;
  }

  // Save user goals
  saveGoalsBtn.addEventListener('click', async () => {
    const monthlyGoal = parseFloat(savingsGoalInput.value) || 0;
    const riskLevel = riskLevelSelect.value;
    
    if (monthlyGoal <= 0) {
      showStatus('Please enter a valid savings goal', 'error');
      return;
    }

    userGoals = { monthlyGoal, riskLevel };
    
    try {
      await chrome.storage.sync.set({ userGoals });
      showStatus('Goals saved successfully!');
    } catch (error) {
      showStatus('Error saving goals: ' + error.message, 'error');
    }
  });

  // Manual price input
  manualPriceInput.addEventListener('input', () => {
    const price = parseFloat(manualPriceInput.value);
    if (price > 0) {
      currentPrice = price;
      displayDetectedPrice(price, true);
      getRecommendationsBtn.disabled = false;
    } else {
      getRecommendationsBtn.disabled = true;
    }
  });
}
);
