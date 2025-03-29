const axiosInstance = require("./axiosConfig");
const { graphEndpoint, rpcEndpoint } = require("./bot");
const https = require('https');
const fs = require('fs');
const path = require('path');

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

// async function getMidnightTimestamps(days) {
//   const timestamps = [];
//   const now = new Date();

//   for (let i = 0; i < days; i++) {
//     const date = new Date(now);
//     date.setUTCDate(now.getUTCDate() - i);
//     date.setUTCHours(0, 0, 0, 0); // Set to midnight GMT
//     timestamps.push(Math.floor(date.getTime() / 1000)); // Convert to Unix timestamp
//   }

//   // Add the current timestamp
//   timestamps.push(Math.floor(now.getTime() / 1000));

//   // Sort the timestamps in ascending order
//   timestamps.sort((a, b) => a - b);

//   return timestamps;
// }

async function getMidnightTimestamps(days) {
  const timestamps = [];
  const now = new Date();

  let step = 1;
  if (days > 800) {
    step = 16;
  } else if (days > 400) {
    step = 8;
  } else if (days > 200) {
    step = 4;
  } else if (days > 100) {
    step = 2;
  }

  for (let i = 0; i < days; i += step) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    timestamps.push(Math.floor(date.getTime() / 1000));
  }

  // Add the current timestamp
  timestamps.push(Math.floor(now.getTime() / 1000));

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
  if (token.symbol === "1SWAP") {
    const burnAddresses = [
      "0x000000000000000000000000000000000000dead",
      "0x0000000000000000000000000000000000000000",
      "0x0e0Deb1C756d81c19235CF6C832377bC481cA05A"
    ];
    const methodSignature = "0x70a08231000000000000000000000000"; // balanceOf(address) method signature

    // Create batch request data
    const requests = burnAddresses.map((address, index) => ({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: token.contractAddress,
          data: methodSignature + address.slice(2) // Append the address without '0x'
        },
        "latest"
      ],
      id: index + 1
    }));

    try {
      // Log the request
      console.log('Request:', JSON.stringify(requests, null, 2));

      const response = await axiosInstance.post(rpcEndpoint, requests, {
        headers: { 'Content-Type': 'application/json' }
      });

      // Log the response
      console.log('Response:', JSON.stringify(response.data, null, 2));

      // Sum the balances
      const totalBurned = response.data.reduce((sum, res) => {
        const balanceWei = res.result;
        const balanceEther = parseInt(balanceWei, 16) / 1e18; // Convert from Wei to Ether
        return sum + balanceEther;
      }, 0);

      return totalBurned;
    } catch (error) {
      console.error('Error fetching balances:', error);
      throw error;
    }
  }
  
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

const IPFS_GATEWAY_FILE = path.join(__dirname, 'ipfs_gateway.json');

async function getIpfsGateway() {
  // Check if the file exists
  if (fs.existsSync(IPFS_GATEWAY_FILE)) {
    const data = JSON.parse(fs.readFileSync(IPFS_GATEWAY_FILE, 'utf8'));
    const timestamp = Object.keys(data)[0];
    const savedValue = data[timestamp];

    // Check if the timestamp is less than 24 hours old
    const now = Date.now();
    if (now - timestamp < 24 * 60 * 60 * 1000) {
      console.log('Using cached value:', savedValue);
      return savedValue + "/#/?outputCurrency=0xbbea78397d4d4590882efcc4820f03074ab2ab29";
    }
  }

  // Make the API request if no valid cached value is found
  return new Promise((resolve, reject) => {
    https.get('https://app.pulsex.com/version.json', (res) => {
      let data = '';

      // A chunk of data has been received.
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // console.log(json);
          const ipfsGateways = json.ipfs_gateways;

          if (!ipfsGateways || !Array.isArray(ipfsGateways) || ipfsGateways.length === 0) {
            throw new Error('ipfs_gateways key is missing or empty in the API response');
          }

          const ipfsGateway = ipfsGateways[0];

          // Save the value to the file with the current timestamp
          const newData = {
            [Date.now()]: ipfsGateway
          };
          fs.writeFileSync(IPFS_GATEWAY_FILE, JSON.stringify(newData, null, 2));

          console.log('Fetched new value:', ipfsGateway);
          // resolve(ipfsGateway + "/#/?outputCurrency=0xbbea78397d4d4590882efcc4820f03074ab2ab29");
          resolve(ipfsGateway);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching IPFS gateway:', error);
      reject(error);
    });
  });
}

async function generateContractMessage(token) {
  const ipfsGateway = await getIpfsGateway();
  const ipfsGatewayUrl = ipfsGateway + "/#/?outputCurrency=" + token.contractAddress;

  // Determine the additional message based on the token symbol
  let additionalMessage;
  if (token.symbol === 'XUSD') {
    additionalMessage = 'Looking for OneSwap? /1swapcontract\nLooking for VIBES? /vibescontract';
  } else if (token.symbol === '1SWAP') {
    additionalMessage = 'Looking for XUSD? /xusdcontract\nLooking for VIBES? /vibescontract';
  } else if (token.symbol === 'VIBES') {
    additionalMessage = 'Looking for XUSD? /xusdcontract\nLooking for OneSwap? /1swapcontract';
  } else {
    throw new Error('Unknown token symbol');
  }

  // Format the message to include token details and the concatenated URL
  const message = `
\`\`\`

${token.flair}

Name: ${token.name}
Symbol: ${token.symbol}
⠀
\`\`\`
Contract Address: \`${token.contractAddress}\`

[Scan](https://scan.pulsechain.com/address/${token.contractAddress})   \\|   [Contract](https://scan.pulsechain.com/address/${token.contractAddress}?tab=contract)
[Dexscreener](https://dexscreener.com/pulsechain/${token.mainPair})  \\|  [Dextools](https://www.dextools.io/app/en/pulse/pair-explorer/${token.mainPair})
[PulseX Buy Link](${ipfsGatewayUrl})

${additionalMessage}

  `;

  return message;
}

//  Looking for OneSwap? /1swap_contract

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
  escapeMarkdownV2,
  getIpfsGateway,
  generateContractMessage
};