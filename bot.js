require('dotenv').config();

const { Bot, InputFile } = require("grammy");
const { ignoreOld } = require("grammy-middlewares");
const { limit } = require("@grammyjs/ratelimiter");
const fs = require('fs');
const path = require('path');

// const { subscribe } = require('./events-web3-2');

// Debugging statements
console.log('BOT_TOKEN:', process.env.BOT_TOKEN);

const bot = new Bot(process.env.BOT_TOKEN); // Use environment variable for token

// Limits message handling to a message per second for each user.
bot.use(limit());


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
const { generateChart, generateSupplyChart } = require('./charts');

// Define contract addresses and main pairs
// Non-checksummed addresses only
const tokens = [
  {
    name: '1SWAP',
    contractAddress: '0xeb14f3192a37ad2501f3bf6627c565e6799ad661',
    mainPair: '0x246766d81bad75bca1d9189fc0d90ced7f057b15',
    position: 'token1',
    featureColour: '#2EAEA2',
    chatID: '-1002100001267',
    flair: `
⠀⣠⠂⠉⠉⠳⣦   Oneswap
⣼⠹⣄⡀⠠⠊⠈⢧  Liquidity
⢻⡄⠊⠙⠛⢆⠀⢸  Yield
⠀⠛⠧⣄⣀⡌⠔⠁  Layer`
  },
  {
    name: 'XUSD',
    contractAddress: '0xbbea78397d4d4590882efcc4820f03074ab2ab29',
    mainPair: '0xeb5c0c2f096604a62585ee378f664fbf6620b5a5',
    position: 'token1',
    featureColour: '#9A0093',
    chatID: '-1002185937112',
    flair: `
⠘⢿⣷⣄⠀⡠⠾⠿⠃  XUSD
⠀⠀⠙⢿⣿⣷⣄⠀⠀  Vibratile
⢠⣶⡶⠊⠀⠙⢿⣷⡄  Asset`
  }
  // Add more tokens here as needed
];

bot.use(ignoreOld());

function getToken(command, chatID) {
  console.log('command:', command, 'type:', typeof command);
  if (typeof command !== 'string') {
    console.log("Command isn't a string!")
    return null;
  }
  if (command.startsWith('/1d_') || command.startsWith('/7d_') || command.startsWith('/30d_')) {
    const tokenName = command.split('_')[1].toUpperCase();
    const token = tokens.find(t => t.name === tokenName);
    return token || tokens[1]; // Return tokens[1] if no token is found
  } else if (command === '/1d' || command === '/7d' || command === '/30d') {
    const token = tokens.find(t => t.chatID === chatID.toString());
    return token || tokens[1]; // Return tokens[1] if no token is found
  }

  console.log('Unknown chatID - using XUSD')
  return tokens[1];

  return null;
}

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

// Command handler for /1d and /1d_<token>
// bot.command(/1d(_\w+)?/, async (ctx) => {
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

  const filePath = path.join(saveLocation, `${token.name} - 1d.png`);

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

    const newFilePath = await generateChart(query, `${token.name} - 1d`, token, true);
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    console.log('Chart freshly generated');
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }

});

// Command handler for /7d and /7d_<token>
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

  const filePath = path.join(saveLocation, `${token.name} - 7d.png`);

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

    const newFilePath = await generateChart(query, `${token.name} - 7d`, token, true, 'day');
    await ctx.replyWithPhoto(new InputFile(newFilePath));
    console.log('Chart freshly generated');
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }
});

// bot.command('7d', async (ctx) => {
//   const command = ctx.message.text.split(' ')[0];
//   console.log('Received command:', command);
//   const token = getToken(command, ctx.chat.id);
//   if (!token) {
//     await ctx.reply('Sorry, no token found for this command.');
//     return;
//   }
//   const query = `
//     {
//       pairHourDatas(
//           first: 336
//           where: {
//               pair_in: [
//                   "0x146e1f1e060e5b5016db0d118d2c5a11a240ae32"
//                   "${token.mainPair}"
//               ]
//           }
//           orderBy: hourStartUnix
//           orderDirection: desc
//       ) {
//           reserve0
//           reserve1
//           hourStartUnix
//           pair {
//               id
//           }
//           hourlyVolumeUSD
//       }
//       pair(id: "${token.mainPair}") {
//           token1 {
//               derivedUSD
//           }
//       }
//     }
//   `;
//   try {
//     const filePath = await generateChart(query, `${token.name} - 7d`, token, true, 'day');
//     await ctx.replyWithPhoto(new InputFile(filePath));
//   } catch (error) {
//     console.error('Error generating chart:', error);
//     await ctx.reply('Sorry, there was an error generating the chart.');
//   }
// });

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

  const filePath = path.join(saveLocation, `${token.name} - 30d.png`);

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

    const newFilePath = await generateChart(query, `${token.name} - 30d`, token, false);
    await ctx.replyWithPhoto(new InputFile(newFilePath));
  } catch (error) {
    console.error('Error generating chart:', error);
    await ctx.reply('Sorry, there was an error generating the chart.');
  }
});


// bot.command('supply', async (ctx) => {
//   const command = ctx.message.text.split(' ')[0];
//   console.log('Received command:', command, ctx.chat.id);
//   const token = getToken(command, ctx.chat.id);
//   if (!token) {
//     await ctx.reply('Sorry, no token found for this command.');
//     return;
//   }
  
//   generateSupplyChart(`${token.name} - Total Supply`, token, isHourly = false, ticks = 'day')
//   // try {
//   //   const filePath = await generateChart(query, `${token.name} - 30d`, token, false);
//   //   await ctx.replyWithPhoto(new InputFile(filePath));
//   // } catch (error) {
//   //   console.error('Error generating chart:', error);
//   //   await ctx.reply('Sorry, there was an error generating the chart.');
//   // }
// });


bot.start();