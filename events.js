const { ethers } = require('ethers');

const XUSDVibeGovenorContractABI = require('./ABI/XUSDVibeGovenor.json');
const VibePassContractABI = require('./ABI/VibePass.json'); 
const VibeRegistryContractABI = require('./ABI/VibeRegistry.json'); 
const PulseLPContractABI = require('./ABI/PulseLP.json');

// Function to send Telegram message
async function sendTelegramMessage(bot, message) {
  try {
    await bot.api.sendMessage(process.env.TELEGRAM_CHAT_ID, message);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Function to watch all events
async function watchEvents(bot) {
  //const provider = new ethers.WebSocketProvider('ws://192.168.1.103:8546');
  const provider = new ethers.WebSocketProvider('wss://rpc.pulsechain.com');
  
  const XUSDVibeGovenorContractAddress = '0x20a7d24fd1e43f0c0b3d434cbd607ea6a62d5a3a';
  const XUSDVibeGovenorContract = new ethers.Contract(XUSDVibeGovenorContractAddress, XUSDVibeGovenorContractABI, provider);

  console.log('Listening for events...');

  XUSDVibeGovenorContract.on('*', async (event) => {
    const eventDetails = `
      Event: ${event.event}
      Block Number: ${event.blockNumber}
      Transaction Hash: ${event.transactionHash}
      Args: ${JSON.stringify(event.args)}
    `;
    console.log('Event received:', eventDetails);
    await sendTelegramMessage(bot, eventDetails);
  });

  XUSDVibeGovenorContract.on("*", (event) => {
    // The `event.log` has the entire EventLog
    console.log('Event received:', event);
  });

  const VibePassContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
  const VibePassContract = new ethers.Contract(VibePassContractAddress, VibePassContractABI, provider);

  VibePassContract.on('*', async (event) => {
    const eventDetails = `
      Event: ${event.event}
      Block Number: ${event.blockNumber}
      Transaction Hash: ${event.transactionHash}
      Args: ${JSON.stringify(event.args)}
    `;
    console.log('Event received:', eventDetails);
    await sendTelegramMessage(bot, eventDetails);
  });

  const VibeRegistryContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
  const VibeRegistryContract = new ethers.Contract(VibeRegistryContractAddress, VibeRegistryContractABI, provider);

  VibeRegistryContract.on('*', async (event) => {
    const eventDetails = `
      Event: ${event.event}
      Block Number: ${event.blockNumber}
      Transaction Hash: ${event.transactionHash}
      Args: ${JSON.stringify(event.args)}
    `;
    console.log('Event received:', eventDetails);
    await sendTelegramMessage(bot, eventDetails);
  });

  const PulseLPContractAddress = '0x79fC0e8d904F7145d7eD2F1E74B96c806e9BF249';
  const PulseLPContract = new ethers.Contract(PulseLPContractAddress, PulseLPContractABI, provider);

  PulseLPContract.on('*', async (event) => {
    const eventDetails = `
      Event: ${event.event}
      Block Number: ${event.blockNumber}
      Transaction Hash: ${event.transactionHash}
      Args: ${JSON.stringify(event.args)}
    `;
    console.log('Event received:', eventDetails);
    await sendTelegramMessage(bot, eventDetails);
  });

  PulseLPContract.on("*", (event) => {
    // The `event.log` has the entire EventLog
    console.log('Event received:', event);
  });  
}

module.exports = { watchEvents };