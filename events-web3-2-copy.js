const { Web3 } = require('web3');
const { InputFile } = require('grammy'); // Import InputFile from grammy
const fs = require('fs');
const { generateVibePassImage } = require('./vibePass');

const options = {
  timeout: 30000, // ms
  clientConfig: {
    maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
    maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
    keepalive: true,
    keepaliveInterval: 60000 // ms
  },
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 50,
    onTimeout: false
  }
};

const web3 = new Web3(new Web3.providers.WebsocketProvider("ws://rpc.pulsechain.com", options));

const VibePassContractAddress = '0x0e0Deb1C756d81c19235CF6C832377bC481cA05A';
const VibePassContractABI = require('./ABI/VibePass.json'); 
const VibePassContract = new web3.eth.Contract(VibePassContractABI, VibePassContractAddress);

function serializeEvent(event) {
  const serializedEvent = {};
  for (const key in event) {
    if (typeof event[key] === 'bigint') {
      serializedEvent[key] = event[key].toString();
    } else {
      serializedEvent[key] = event[key];
    }
  }
  return serializedEvent;
}

const TELEGRAM_CHAT_ID = '-4575699807'; // Your chat ID

// Function to send Telegram message
async function sendTelegramMessage(bot, message) {
  try {
    await bot.api.sendMessage(TELEGRAM_CHAT_ID, message);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

async function subscribe(bot) {
  VibePassContract.events.allEvents()
  .on('data', async (event) => {
    const serializedReturnValues = serializeEvent(event.returnValues);
    let eventDetails = `
      Contract: VibePass
      Event: ${event.event}
      Block Number: ${event.blockNumber}
      Transaction Hash: ${event.transactionHash}
      Args: ${JSON.stringify(serializedReturnValues)}
    `;

    // Check if the event is a Transfer event and meets the specified conditions
    if (event.event === 'Transfer' && 
        serializedReturnValues['0'] === '0x0000000000000000000000000000000000000000' && 
        'tokenId' in serializedReturnValues) {
      const wallet = serializedReturnValues['1'];
      const passId = serializedReturnValues['tokenId'];
      eventDetails += `
        VibePass Minted �
      `;

      // Generate the image
      const imagePath = await generateVibePassImage(wallet, passId);

      // Log the image path
      console.log('Generated image path:', imagePath);

      // Check if the file exists
      if (fs.existsSync(imagePath)) {
        // Send the image with the message
        try {
          await bot.api.sendPhoto(TELEGRAM_CHAT_ID, new InputFile(imagePath), {
            caption: eventDetails,
            parse_mode: 'MarkdownV2'
          });
        } catch (error) {
          console.error('Error sending Telegram message:', error);
        }
      } else {
        console.error('Error: Image file does not exist at path:', imagePath);
      }
    } else {
      console.log('Event received:', eventDetails);
      console.log("serializedReturnValues['0'] =", serializedReturnValues['0']);
      console.log("serializedReturnValues['1'] =", serializedReturnValues['1']);
      console.log("serializedReturnValues['tokenId'] =", serializedReturnValues['tokenId']);
    }
  });

  VibePassContract.events.allEvents()
    .on('error', console.error);

  console.log('Listening for events...');
}

// function to unsubscribe from a subscription
async function unsubscribe(subscription) {
    await subscription.unsubscribe();
}

module.exports = { subscribe };