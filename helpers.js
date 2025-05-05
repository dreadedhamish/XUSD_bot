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
    additionalMessage = 'Looking for OneSwap? /1swapcontract\nLooking for VIBES? /vibescontract\nLooking for oOneSwap? /o1swapcontract';
  } else if (token.symbol === '1SWAP') {
    additionalMessage = 'Looking for XUSD? /xusdcontract\nLooking for VIBES? /vibescontract\nLooking for oOneSwap? /o1swapcontract';
  } else if (token.symbol === 'VIBES') {
    additionalMessage = 'Looking for XUSD? /xusdcontract\nLooking for OneSwap? /1swapcontract\nLooking for oOneSwap? /o1swapcontract';
  } else if (token.symbol === 'o1SWAP') {
    additionalMessage = 'Looking for XUSD? /xusdcontract\nLooking for OneSwap? /1swapcontract\nLooking for VIBES? /vibescontract';  
  } else {
    throw new Error('Unknown token symbol');
  }

  let message;
  if (token.symbol === 'o1SWAP') {
  // Format the message to include token details and the concatenated URL
    message = `
\`\`\`
⠀
⠀Name: ${token.name}
⠀Symbol: ${token.symbol}
⠀
\`\`\`
Contract Address: \`${token.contractAddress}\`

o1SWAP is a reward token that is earned by staking LP or through trading\\. It is not designed to be directly traded on a DEX\\.

[Scan](https://scan.pulsechain.com/address/${token.contractAddress})   \\|   [Contract](https://scan.pulsechain.com/address/${token.contractAddress}?tab=contract)

${additionalMessage}

  `;
  } else {
    message = `
\`\`\`

${token.flair}

⠀Name: ${token.name}
⠀Symbol: ${token.symbol}
⠀
\`\`\`
Contract Address: \`${token.contractAddress}\`

[Scan](https://scan.pulsechain.com/address/${token.contractAddress})   \\|   [Contract](https://scan.pulsechain.com/address/${token.contractAddress}?tab=contract)
[Dexscreener](https://dexscreener.com/pulsechain/${token.mainPair})  \\|  [Dextools](https://www.dextools.io/app/en/pulse/pair-explorer/${token.mainPair})
[PulseX Buy Link](${ipfsGatewayUrl})

${additionalMessage}

  `;
  }
  return message;
}

async function generateAllContractMessages(tokens) {
  const messages = [];
  
  for (const token of tokens) {
    
    // Determine the additional message based on the token symbol
    let additionalMessage;
    if (token.symbol === 'XUSD') {
      additionalMessage = ' /xusdcontract';
    } else if (token.symbol === '1SWAP') {
      additionalMessage = ' /1swapcontract';
    } else if (token.symbol === 'VIBES') {
      additionalMessage = ' /vibescontract';
    } else if (token.symbol === 'o1SWAP') {
      additionalMessage = ' /o1SWAPcontract';
    } else {
      throw new Error('Unknown token symbol');
    }
    
    // Build the message based on the token symbol
    let message = `
Name: *${token.name}*
Symbol: *${token.symbol}*
CA: \`${token.contractAddress}\`
Details: ${additionalMessage}
`;
    messages.push(message.trim());
  }
  
  return messages;
}

async function getCurrentMintPrice() {
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: "0x71348a7C0805898999A0f54fcf134974e1C4dFad",
        data: "0xeb91d37e" // function selector for getCurrentPrice()
      },
      "latest"
    ],
    id: 1
  };

  const response = await axiosInstance.post(rpcEndpoint, data, {
    headers: { "Content-Type": "application/json" }
  });

  const resultHex = response.data.result;
  // Assuming that getCurrentPrice returns a uint256.
  const mintPrice = parseInt(resultHex, 16);
  return mintPrice;
}

async function generateVibePassMessage(token) {
  
  const mintPriceRaw = await getCurrentMintPrice();
  const oneswapPriceRaw = await getUSDPrice(token);
  
  // Divide by 1e18, then round up to the next whole number, and round oneswapPrice to 8 decimals
  const mintPrice = Math.ceil(mintPriceRaw / 1e18);
  const oneswapPriceStr = oneswapPriceRaw.toFixed(8); // returns a string with 8 decimals
  const oneswapPriceEscaped = oneswapPriceStr.replace(/\./g, '\\.');
  const mintPriceUSD = Math.ceil(mintPrice * oneswapPriceRaw);

  // Format the message to include token details and the concatenated URL
  const message = `
The VibePass is your passport and identification within the Vibratile token protocol, granting you access to higher levels of participation\\. Owning a VibePass sets you apart from general users, offering exclusive benefits and deeper involvement in the ecosystem\\.

*Seigniorage Rewards*
Seigniorage is the profit generated from issuing currency, specifically the difference between the value of money and the cost to produce it\\.

*Function*
When the token price exceeds the peg, inflation occurs to bring the price back down\\. The seigniorage generated from this process is distributed to VibePass holders in accordance to the amount of XUSD they have burned\\.

*Buying a VibePass*
Your Vibescore must be below 400\\. You can drop your VibeScore by buying XUSD, it's better to do so by buying XUSD repeatedly in smaller amounts \\(min 500\\)

Required 1SWAP \\= ${mintPrice}
1SWAP Price \\= ${oneswapPriceEscaped}
Mint Price \\(USD\\) \\= \\$*${mintPriceUSD}*

You can mint a VibePass or use the calculator to estimate rewards here: [https://www\\.x\\-usd\\.net/VibePass](https://www.x-usd.net/VibePass)  

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
  generateContractMessage,
  generateVibePassMessage,
  generateAllContractMessages
};