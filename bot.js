require('dotenv').config();

const { Bot, InputFile } = require("grammy");
const { ignoreOld } = require("grammy-middlewares");
const { limit } = require("@grammyjs/ratelimiter");
const { autoRetry } = require("@grammyjs/auto-retry");
const fs = require('fs');
const path = require('path');

const { subscribe } = require('./events-web3-2');


// Debugging statements
console.log('BOT_TOKEN:', process.env.BOT_TOKEN);

const bot = new Bot(process.env.BOT_TOKEN); // Use environment variable for token

// Limits message handling to a message per second for each user.
bot.use(limit());

bot.use(ignoreOld());

bot.api.config.use(autoRetry());
autoRetry({
  maxRetryAttempts: 1, // only repeat requests once
  maxDelaySeconds: 10, // 5 - fail immediately if we have to wait >5 seconds
});

// new_bot.js
const graphEndpoint = "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2";
const rpcEndpoint = "https://rpc.pulsechain.com";
const saveLocation = process.env.IMAGE_SAVE_LOCATION;
const cacheLifetime = process.env.CACHE_LIFETIME;

module.exports = {
  bot,
  graphEndpoint,
  rpcEndpoint,
  saveLocation
};

// Import the functions from price.js
const { fetchPriceMultiBlock, formatPriceChangesMessage } = require('./price');

// Import the functions from charts.js
const { generatePriceChart, generateSupplyChart, generateBurnedChart, generateHoldersChart, generateMCapChart } = require('./charts');

// Import helpers
const { getTotalBurned, getUSDPrice, escapeMarkdownV2, getIpfsGateway, generateContractMessage, generateVibePassMessage } = require('./helpers');

// Define contract addresses and main pairs
// Non-checksummed addresses only
const tokens = [
  {
    name: 'OneSwap',
    symbol: '1SWAP',
    contractAddress: '0xeb14f3192a37ad2501f3bf6627c565e6799ad661',
    mainPair: '0x246766d81bad75bca1d9189fc0d90ced7f057b15',
    position: 'token1',
    featureColour: '#2EAEA2',
    chatID: '-1002100001267',
    flair: `
⠀⠀⣠⠂⠉⠉⠳⣦   Oneswap
⠀⣼⠹⣄⡀⠠⠊⠈⢧  Liquidity
⠀⢻⡄⠊⠙⠛⢆⠀⢸  Yield
⠀⠀⠛⠧⣄⣀⡌⠔⠁  Layer`
  },
  {
    name: 'XUSD Vibratile Asset',
    symbol: 'XUSD',
    contractAddress: '0xbbea78397d4d4590882efcc4820f03074ab2ab29',
    mainPair: '0xeb5c0c2f096604a62585ee378f664fbf6620b5a5',
    position: 'token1',
    featureColour: '#9A0093',
    chatID: '-1002185937112',
    flair: `
⠀⠘⢿⣷⣄⠀⡠⠾⠿⠃  XUSD
⠀⠀⠀⠙⢿⣿⣷⣄⠀⠀  Vibratile
⠀⢠⣶⡶⠊⠀⠙⢿⣷⡄  Asset`
  },
  {
    name: 'VIBES',
    symbol: 'VIBES',
    contractAddress: '0x50D0DD7f2164212B6218EDe3834E39d629bd72dc',
    mainPair: '0x503ea91a13c3e0a1898e76cb148e86954ddd9327',
    position: 'token0',
    featureColour: '#64579B',
    chatID: '',
    flair: `
⠀⢠⣄⠀⠀⠀⠀⢠⣦
⠀⠈⢿⡇⠀⠀⠀⣸⠃
⠀⠀⣿⠇⠀⣀⠖⠁⠀
⠀⢸⡿⠄⠊⠀⠀⠀⠀`
  }
  // Add more tokens here as needed
];

function getToken(command, chatID) {
  console.log('command:', command, 'type:', typeof command);
  if (typeof command !== 'string') {
    console.log("Command isn't a string!")
    return null;
  }
  // if (command.startsWith('/1d_') || command.startsWith('/7d_') || command.startsWith('/30d_')) {
  //   const tokenName = command.split('_')[1].toUpperCase();
  //   const token = tokens.find(t => t.name === tokenName);
  //   return token || tokens[1]; // Return tokens[1] if no token is found
  // } else if (command === '/1d' || command === '/7d' || command === '/30d') {
  //   const token = tokens.find(t => t.chatID === chatID.toString());
  //   return token || tokens[1]; // Return tokens[1] if no token is found
  // }

  const token = tokens.find(t => t.chatID === chatID.toString());

  if (!token) {
    console.log('Unknown chatID - using XUSD');
    return tokens[1]; // Return tokens[1] if no token is found
    
  }
  
  return token;
}

// Command handler for /contract
const handleContractCommand = async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {
    const token = getToken('contract', ctx.chat.id);
    if (!token) {
      await ctx.reply('Sorry, no token found for this chat.');
      return;
    }
    
    const message = await generateContractMessage(token);
    
    console.log('Payload:', message); // Log the payload
    
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, there was an error fetching the IPFS gateway.');
  }
};

// Register the same handler for multiple commands
['contract', 'ca'].forEach(command => {
  bot.command(command, handleContractCommand);
});

bot.command('xusdcontract', async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {  
    const message = await generateContractMessage(tokens[1]);
    console.log('Payload before escaping:', message); // Log the payload before escaping
    
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, there was an error.');
  }
});

bot.command('1swapcontract', async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {  
    const message = await generateContractMessage(tokens[0]);
    console.log('Payload before escaping:', message); // Log the payload before escaping
    
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, there was an error.');
  }
});

bot.command('vibescontract', async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {  
    const message = await generateContractMessage(tokens[2]);
    console.log('Payload before escaping:', message); // Log the payload before escaping
    
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, there was an error.');
  }
});

// bot.command('contract', async (ctx) => {
//   console.log('Chat ID: ', ctx.chat.id);
//   try {
//     const token = getToken('contract', ctx.chat.id);
//     if (!token) {
//       await ctx.reply('Sorry, no token found for this chat.');
//       return;
//     }
    
//     const ipfsGateway = await getIpfsGateway();
//     console.log('IPFS Gateway:', ipfsGateway);
//     const ipfsGatewayUrl = ipfsGateway + "/#/?outputCurrency=" + token.contractAddress;
    
//     // Format the message to include token.symbol, token.contractAddress, and the concatenated URL
//     const message = `
// \`\`\`

// ${token.flair}

// Name: ${token.name}
// Symbol: ${token.symbol}
// ⠀
// \`\`\`
// Contract Address: \`${token.contractAddress}\`

// [Scan](https://scan.pulsechain.com/address/${token.contractAddress})   \\|   [Contract](https://scan.pulsechain.com/address/${token.contractAddress}?tab=contract)
// [Dexscreener](https://dexscreener.com/pulsechain/${token.mainPair})  \\|  [Dextools](https://www.dextools.io/app/en/pulse/pair-explorer/${token.mainPair})
// [PulseX Buy Link](${ipfsGatewayUrl})
//     `;
    
//     console.log('Payload:', message); // Log the payload
    
//     await ctx.reply(message, {
//       parse_mode: 'MarkdownV2',
//       disable_web_page_preview: true
//     });
//   } catch (error) {
//     console.error('Error:', error);
//     await ctx.reply('Sorry, there was an error fetching the IPFS gateway.');
//   }
// });

// Command handler for /price
bot.command('price', async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {
    const token = getToken('price', ctx.chat.id);
    if (!token) {
      await ctx.reply('Sorry, no token found for this chat.');
      return;
    }
    const data = await fetchPriceMultiBlock(token);
    const message = formatPriceChangesMessage(data, token);
    console.log('Payload:', message); // Log the payload
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Error fetching data for blocks:', error);
    await ctx.reply('Sorry, there was an error fetching the price data.');
  }
});

// Command handler for /1d
bot.command('1d', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  const query = `
    {
      pairHourDatas(
          first: 48
          where: {
              pair_in: [
                  "0x146e1f1e060e5b5016db0d118d2c5a11a240ae32"
                  "${token.mainPair}"
              ]
          }
          orderBy: hourStartUnix
          orderDirection: desc
      ) {
          reserve0
          reserve1
          hourStartUnix
          pair {
              id
          }
          hourlyVolumeUSD
      }
      pair(id: "${token.mainPair}") {
          token1 {
              derivedUSD
          }
      }
    }
  `;

  const filePath = path.join(saveLocation, `${token.symbol}-1d.png`);

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    const newFilePath = await generatePriceChart(query, `${token.symbol}-1d`, token, true);
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    console.log('Chart freshly generated');
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }

});

// Command handler for /7d
bot.command('7d', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }

  const query = `
    {
      pairHourDatas(
          first: 336
          where: {
              pair_in: [
                  "0x146e1f1e060e5b5016db0d118d2c5a11a240ae32"
                  "${token.mainPair}"
              ]
          }
          orderBy: hourStartUnix
          orderDirection: desc
      ) {
          reserve0
          reserve1
          hourStartUnix
          pair {
              id
          }
          hourlyVolumeUSD
      }
      pair(id: "${token.mainPair}") {
          token1 {
              derivedUSD
          }
      }
    }
  `;

  const filePath = path.join(saveLocation, `${token.symbol}-7d.png`);

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    const newFilePath = await generatePriceChart(query, `${token.symbol}-7d`, token, true, 'day');
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    console.log('Chart freshly generated');
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }
});

// Command handler for /7d
bot.command('30d', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  const query = `
    {
      tokenDayDatas(
          first: 30
          orderBy: date
          where: { token: "${token.contractAddress}" }
          orderDirection: desc
      ) {
          date
          dailyVolumeUSD
          priceUSD
      }
      pair(id: "${token.mainPair}") {
          token1 {
              derivedUSD
          }
      }
    }
  `;

  const filePath = path.join(saveLocation, `${token.symbol}-30d.png`);

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    const newFilePath = await generatePriceChart(query, `${token.symbol}-30d`, token, false);
    await ctx.replyWithPhoto(new InputFile(newFilePath));
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }
});

bot.command('burned_chart', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command, ctx.chat.id);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  
  const filePath = path.join(saveLocation, `${token.symbol}-Burned-30d.png`);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    // generateBurnedChart(`${token.symbol} - Burned 30d`, token, isHourly = false, ticks = 'day')
    
    const newFilePath = await generateBurnedChart(`${token.symbol}-Burned-30d`, token, isHourly = false, ticks = 'day');
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    } catch (error) {
      console.error('Error generating chart:', error);
      await ctx.reply('Sorry, there was an error generating the chart.');
    }
});

// Command handler for /price
bot.command('burned', async (ctx) => {
  console.log('/burned called');
  console.log('Chat ID: ', ctx.chat.id);
  // if (ctx.chat.id === "-1002100001267") {
  //   return;
  // }
  try {
    const token = getToken('price', ctx.chat.id);
    if (!token) {
      await ctx.reply('Sorry, no token found for this chat.');
      return;
    }
    
    let burned, usdValue;
    try {
      [burned, usdValue] = await Promise.all([
        getTotalBurned(token),
        getUSDPrice(token)
      ]);

      console.log(`Burned: ${burned}`);
      console.log(`$USD Value: ${usdValue}`);
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }

    // Calculate the USD value of the burned tokens
    const usdValueBurned = burned * usdValue;

    // const message = `Burned: ${burned}\n$USD Value: ${usdValue}`;
    // const message = `⠀⢠⡀⠀\n⢀⣿⣿⡄  Burn Stats\n⢸⡿⢹⣿  XUSD: ${escapeMarkdownV2(burned.toFixed(0))}\n⠈⢧⢠⠏  USD:  ${escapeMarkdownV2(usdValueBurned.toFixed(0))}`;
    const message = `
    \`\`\`
⠀    
⠀⠀⢱⡀⠀  ${token.symbol}\n⠀⢀⣿⣿⡄  Burn Stats\n⠀⢸⡿⢹⣿  XUSD: ${escapeMarkdownV2(burned.toFixed(0))}\n⠀⠈⢧⢠⠏  USD:  ${escapeMarkdownV2(usdValueBurned.toFixed(0))} 
⠀    
    \`\`\`
    `;



    console.log('Payload:', message); // Log the payload
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Error fetching data for blocks:', error);
    await ctx.reply('Sorry, there was an error fetching the price data.');
  }
});

bot.command('supply', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command, ctx.chat.id);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  
  const filePath = path.join(saveLocation, `${token.symbol}-Total-Supply.png`);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    // generateSupplyChart(`${token.symbol} - Total Supply`, token, isHourly = false, ticks = 'day')
    
    const newFilePath = await generateSupplyChart(`${token.symbol}-Total-Supply`, token, isHourly = false, ticks = 'day');
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    } catch (error) {
      console.error('Error generating chart:', error);
      await ctx.reply('Sorry, there was an error generating the chart.');
    }
});

bot.command('supply_all_time', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command, ctx.chat.id);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  
  const filePath = path.join(saveLocation, `${token.symbol}-Total-Supply_All_Time.png`);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    // generateSupplyChart(`${token.symbol} - Total Supply`, token, isHourly = false, ticks = 'day')
    
    const now = new Date();
    const startDate = new Date(2024, 8, 25); // (Month is zero-indexed: 8 = September)
    const diffInMs = now - startDate;
    const daysSince = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
    console.log(`Days since September 25 plus 1: ${daysSince}`);

    days = daysSince;

    const newFilePath = await generateSupplyChart(`${token.symbol}-Total-Supply-All-Time`, token, isHourly = false, ticks = 'day', days );
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    } catch (error) {
      console.error('Error generating chart:', error);
      await ctx.reply('Sorry, there was an error generating the chart.');
    }
});

bot.command('marketcap', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command, ctx.chat.id);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  
  const filePath = path.join(saveLocation, `${token.symbol}-Market-Cap.png`);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    // generateSupplyChart(`${token.symbol} - Total Supply`, token, isHourly = false, ticks = 'day')
    
    const newFilePath = await generateMCapChart(`${token.symbol}-Market-Cap`, token, isHourly = false, ticks = 'day');
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    } catch (error) {
      console.error('Error generating chart:', error);
      await ctx.reply('Sorry, there was an error generating the chart.');
    }
});


bot.command('holders', async (ctx) => {
  const command = ctx.message.text.split(' ')[0];
  console.log('Received command:', command, ctx.chat.id);
  const token = getToken(command, ctx.chat.id);
  if (!token) {
    await ctx.reply('Sorry, no token found for this command.');
    return;
  }
  
  const filePath = path.join(saveLocation, `${token.symbol}-Holders.png`);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = new Date();
      const fileAgeInMinutes = (now - stats.mtime) / 1000 / 60;

      if (fileAgeInMinutes < cacheLifetime) {
        await ctx.replyWithPhoto(new InputFile(filePath));
        console.log('Chart sent from cache');
        return;
      }
    }

    // generateSupplyChart(`${token.symbol} - Total Supply`, token, isHourly = false, ticks = 'day')
    
    sheetId = "1jrbzvOoo4vwHusY4DrGJv9cT_qLkFIa6dtq4U5kRF8g"
    const newFilePath = await generateHoldersChart(token, sheetId, token.symbol, `${token.symbol}-Holders`);
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    } catch (error) {
      console.error('Error generating chart:', error);
      await ctx.reply('Sorry, there was an error generating the chart.');
    }
});

// Command handler for /vibepass
bot.command('vibepass', async (ctx) => {
  console.log('Chat ID: ', ctx.chat.id);
  try {
    const token = tokens[0]
    
    const message = await generateVibePassMessage(token);
    
    console.log('Payload:', message); // Log the payload
    
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, there was an error fetching the IPFS gateway.');
  }
});

// Call the subscribe function to start listening for events

subscribe(bot).then(() => {
  console.log('Subscribed to events successfully.');
}).catch((error) => {
  console.error('Error subscribing to events:', error);
});

bot.start();
