
// =======================
// UI Functions
// =======================

function buildInfoTable(data, earnings, currencySymbol) {
  const container = createElementWithStyles('div', {
    padding: '15px',
    backgroundColor: '#f8f8f8',
    border: '1px solid #ddd',
    borderRadius: '5px',
    margin: '20px'
  });
  
  const heading = createElementWithStyles('h3', { marginTop: '0', marginBottom: '10px' }, 'Book Information');
  container.appendChild(heading);
  
  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  });
  
  const headers = ['List Price', 'Dimensions', 'Pages', 'Min List Price', 'Printing Cost', 'Royalty', 'Break-even ACOS', 'Best Sellers Rank', 'Copies Per Month', 'Monthly Royalty'];
  const headerRow = document.createElement('tr');
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    Object.assign(th.style, {
      textAlign: 'right',
      padding: '5px',
      border: '1px solid #ddd',
      backgroundColor: '#f0f0f0'
    });
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  
  const dataRow = document.createElement('tr');
  
  function createCell(content) {
    const td = document.createElement('td');
    td.textContent = content;
    Object.assign(td.style, {
      textAlign: 'right',
      padding: '5px',
      border: '1px solid #ddd'
    });
    return td;
  }
  
  const formattedListPrice = data.listPrice ? formatCurrency(data.listPrice, currencySymbol) : 'N/A';
  const dimensions = (data.width && data.height) ? `${data.width.toFixed(1)} x ${data.height.toFixed(1)}` : 'N/A';
  const formattedPages = data.pages || 'N/A';
  const formattedMinListPrice = formatCurrency(data.minimumListPrice, currencySymbol);
  const formattedPrintingCost = formatCurrency(data.printingCost, currencySymbol);
  const formattedRoyalty = formatCurrency(data.adRoyalty, currencySymbol);
  const formattedBreakEvenAcos = data.breakEvenAcosPct.toFixed(2) + '%';
  const formattedBSR = data.bsr ? data.bsr.toLocaleString() : 'N/A';
  const formattedCopiesPerMonth = earnings.copiesPerMonth ? earnings.copiesPerMonth.toFixed(1).toString() : 'N/A';
  const formattedMonthlyRoyalty = formatCurrency(earnings.earningsPerMonth, currencySymbol);
  
  const cells = [
    formattedListPrice,
    dimensions,
    formattedPages,
    formattedMinListPrice,
    formattedPrintingCost,
    formattedRoyalty,
    formattedBreakEvenAcos,
    formattedBSR,
    formattedCopiesPerMonth,
    formattedMonthlyRoyalty
  ];
  
  cells.forEach(content => {
    dataRow.appendChild(createCell(content));
  });
  
  table.appendChild(dataRow);
  container.appendChild(table);
  return container;
}

function extractAndInsertInfo() {
  try {
    const data = extractInfo();
    if (!data) return;
    const earnings = calculateEarnings(data);
    const currencySymbol = getCurrencySymbolFromDomain(data.store);
    const infoDiv = buildInfoTable(data, earnings, currencySymbol);
    
    // Insert the info div after breadcrumbs if available
    const breadcrumbsDiv = document.querySelector('div[cel_widget_id="showing-breadcrumbs_csm_instrumentation_wrapper"]');
    if (breadcrumbsDiv && breadcrumbsDiv.nextSibling) {
      breadcrumbsDiv.parentNode.insertBefore(infoDiv, breadcrumbsDiv.nextSibling);
    } else {
      const mainContent = document.querySelector('#dp') || document.querySelector('body');
      if (mainContent) {
        mainContent.insertBefore(infoDiv, mainContent.firstChild);
      }
    }
  } catch (error) {
    console.error('Error in extractAndInsertInfo:', error);
  }
}

// =======================
// Error Handling and Initialization
// =======================

function isErrorPage() {
  // Check for known error element patterns
  if (document.querySelector('#g') &&
      document.querySelector('#h') &&
      document.querySelector('#i') &&
      document.querySelector('#i')?.textContent?.includes("we couldn't find that page")) {
    return true;
  }
  // Check page title for error indicators
  const pageTitle = document.title?.toLowerCase() || '';
  if (pageTitle.includes('not found') || pageTitle.includes('error') || pageTitle.includes('sorry')) {
    return true;
  }
  // Check for missing essential product elements
  const essentialSelectors = ['#dp', '#productTitle', '#buy-now-button', '#add-to-cart-button'];
  const hasEssential = essentialSelectors.some(selector => document.querySelector(selector));
  return !hasEssential;
}

function showErrorNotification() {
  try {
    const notification = createElementWithStyles('div', {
      position: 'fixed',
      top: '50px',
      right: '20px',
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px 15px',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      zIndex: '9999',
      maxWidth: '300px',
      fontFamily: 'Arial, sans-serif'
    });
    
    const title = createElementWithStyles('p', { margin: '0', fontWeight: 'bold' }, 'Book Info Extension');
    const message = createElementWithStyles('p', { margin: '5px 0 0' }, "Could not load book data - this doesn't appear to be a valid Amazon product page.");
    notification.appendChild(title);
    notification.appendChild(message);
    
    const closeBtn = createElementWithStyles('button', {
      position: 'absolute',
      top: '5px',
      right: '5px',
      background: 'none',
      border: 'none',
      fontSize: '20px',
      cursor: 'pointer',
      color: '#721c24'
    }, '×');
    closeBtn.onclick = function() {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    };
    notification.appendChild(closeBtn);
    
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 10000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

function initExtension() {
  if (isErrorPage()) {
    console.log("Detected Amazon error page - extension functionality disabled");
    showErrorNotification();
  } else {
    extractAndInsertInfo();
  }
}

// Utility: Wait for element to appear before initialisation
function waitForElement(selector, callback, maxWaitTime = 8000) {
  if (document.querySelector(selector)) {
    callback();
    return;
  }
  const observer = new MutationObserver((mutations, obs) => {
    if (document.querySelector(selector)) {
      clearTimeout(timeout);
      obs.disconnect();
      callback();
    }
  });
  const timeout = setTimeout(() => {
    observer.disconnect();
    console.log(`Timed out waiting for element: ${selector}`);
    callback();
  }, maxWaitTime);
  observer.observe(document.body, { childList: true, subtree: true });
}

// Listen for Chrome tab updates (Manifest V3 support)
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      extractAndInsertInfo();
    }
  });
}

// Wait for critical elements then initialise the extension
waitForElement('#dp, #productTitle, #corePriceDisplay_desktop_feature_div', initExtension);
