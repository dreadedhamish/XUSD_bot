const axiosInstance = require("./axiosConfig");
const { graphEndpoint, rpcEndpoint } = require("./bot");
const https = require('https');
const fs = require('fs');
const path = require('path');

// Function to fetch the latest block number
 

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
    additionalMessage = 'Looking for OneSwap? /1swapcontract';
  } else if (token.symbol === '1SWAP') {
    additionalMessage = 'Looking for XUSD? /xusdcontract';
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