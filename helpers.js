const axiosInstance = require("./axiosConfig");
const { graphEndpoint, rpcEndpoint } = require("./bot");

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

async function getMidnightTimestamps(days) {
  const timestamps = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - i);
    date.setUTCHours(0, 0, 0, 0); // Set to midnight GMT
    timestamps.push(Math.floor(date.getTime() / 1000)); // Convert to Unix timestamp
  }

  // Sort the timestamps in ascending order
  timestamps.sort((a, b) => a - b);

  return timestamps;
}

async function getBlockNumbers(timestamps) {
  const requests = timestamps.map((timestamp, index) => ({
    jsonrpc: "2.0",
    method: "erigon_getBlockByTimestamp",
    params: [timestamp.toString(), false],
    id: index + 1
  }));

  const response = await axiosInstance.post(rpcEndpoint, requests, {
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data.map(res => ({
    timestamp: timestamps[res.id - 1],
    blockNumber: res.result.number
  }));
}

async function getTotalBurned(token, blockNumber = "latest") {
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: token.contractAddress,
        data: "0xd89135cd"
      },
      blockNumber
    ],
    id: 1
  };

  const response = await axiosInstance.post(rpcEndpoint, data, {
    headers: { 'Content-Type': 'application/json' }
  });

  const burnedHex = response.data.result;
  const burned = parseInt(burnedHex, 16) / 1e18; // Convert from hex to decimal and adjust for token decimals
  return burned;
}

async function getUSDPrice(token, blockNumber = "latest") {
  const query = `
    {
      pair(id: "${token.mainPair}") {
        token1 {
          derivedUSD
        }
      }
    }
  `;

  const response = await axiosInstance.post(graphEndpoint, { query }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const derivedUSD = parseFloat(response.data.data.pair.token1.derivedUSD);
  return derivedUSD;
}

// Escape special characters for MarkdownV2
const escapeMarkdownV2 = (text) => {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

module.exports = {
  fetchLatestBlockNumber,
  getMidnightTimestamps,
  getBlockNumbers,
  getTotalBurned,
  getUSDPrice,
  escapeMarkdownV2
};