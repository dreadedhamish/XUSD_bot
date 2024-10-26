const axiosInstance = require('./axiosConfig');

const { graphEndpoint, rpcEndpoint } = require('./bot');

// Function to fetch the latest block number
async function fetchLatestBlockNumber() {
  const response = await axiosInstance.post(rpcEndpoint, {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const data = response.data;
  console.log('Response from eth_blockNumber API:', data); // Log the response
  return parseInt(data.result, 16);
}

// Function to fetch data for multiple blocks
async function fetchPriceMultiBlock(token) {
  const latestBlockNumber = await fetchLatestBlockNumber();
  const blockNumbers = [
    latestBlockNumber,
    latestBlockNumber - 30,
    latestBlockNumber - 360,
    latestBlockNumber - 8640,
    latestBlockNumber - 60480
  ];

  const query = `
    {
      pairCurrent: pair(id: "${token.mainPair}") {
        token1 {
          derivedUSD
        }
      }
      pairMinusFiveMin: pair(id: "${token.mainPair}", block: { number: ${blockNumbers[1]} }) {
        token1 {
          derivedUSD
        }
      }
      pairMinusOneHour: pair(id: "${token.mainPair}", block: { number: ${blockNumbers[2]} }) {
        token1 {
          derivedUSD
        }
      }
      pairMinusOneDay: pair(id: "${token.mainPair}", block: { number: ${blockNumbers[3]} }) {
        token1 {
          derivedUSD
        }
      }
      pairMinusOneWeek: pair(id: "${token.mainPair}", block: { number: ${blockNumbers[4]} }) {
        token1 {
          derivedUSD
        }
      }
    }
  `;

  console.log('PRICE - query', query);
  const response = await axiosInstance.post(graphEndpoint, { query }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const data = response.data;
  console.log('Response from GraphQL API:', data); // Log the response
  return data.data;
}

// Helper function to escape special characters for MarkdownV2
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// Function to format price changes into a message
function formatPriceChangesMessage(data, token) {
  const currentPrice = parseFloat(data.pairCurrent.token1.derivedUSD);
  const fiveMinPrice = parseFloat(data.pairMinusFiveMin.token1.derivedUSD);
  const oneHourPrice = parseFloat(data.pairMinusOneHour.token1.derivedUSD);
  const twentyFourHourPrice = parseFloat(data.pairMinusOneDay.token1.derivedUSD);
  const sevenDayPrice = parseFloat(data.pairMinusOneWeek.token1.derivedUSD);

  const formatPrice = price => price.toFixed(6);
  const formatPercentageChange = (oldPrice, newPrice) => {
    const change = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1);
    return change > 0 ? `+${change}%` : `${change}%`;
  };

  const fiveMinChange = formatPercentageChange(fiveMinPrice, currentPrice) + ' ';
  const oneHourChange = ' ' + formatPercentageChange(oneHourPrice, currentPrice) + ' ';
  const twentyFourHourChange = ' ' + formatPercentageChange(twentyFourHourPrice, currentPrice) + ' ';
  const sevenDayChange = ' ' + formatPercentageChange(sevenDayPrice, currentPrice);

  // Calculate padding for each header based on the length of the change values
  const calculatePadding = (header, value) => {
    const totalPadding = Math.max(value.length - header.length, 0);
    const leftPadding = header === headers[0] ? 0 : 1; // No leading space for the first header
    const rightPadding = totalPadding - leftPadding; // Add the rest of the padding after the header text
    return { leftPadding, rightPadding };
  };

  const headers = ['5m', '1h', '1d', '7d'];
  const changes = [fiveMinChange, oneHourChange, twentyFourHourChange, sevenDayChange];
  const paddedHeaders = headers.map((header, index) => {
    const { leftPadding, rightPadding } = calculatePadding(header, changes[index]);
    return ' '.repeat(leftPadding) + header + ' '.repeat(rightPadding);
  });

  const paddedBorders = changes.map(change => '─'.repeat(change.length));

  return `
\`\`\`

${token.flair}

Current Price: ${formatPrice(currentPrice)}

${paddedHeaders.join('│')}
${paddedBorders.join('┼')}
${fiveMinChange}│${oneHourChange}│${twentyFourHourChange}│${sevenDayChange}
⠀
\`\`\`
  `;
}

// Export the functions
module.exports = {
  fetchPriceMultiBlock,
  formatPriceChangesMessage
};


// │${paddedHeaders.join('│')}│
// ├${paddedBorders.join('┼')}┤
// │${fiveMinChange} │${oneHourChange} │${twentyFourHourChange} │${sevenDayChange} │