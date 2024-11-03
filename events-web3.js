const Web3 = require('web3');
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
  // const web3 = new Web3(Web3.WebsocketProvider('wss://rpc.pulsechain.com'));
  var web3 = new Web3(Web3.WebsocketProvider('wss://rpc.pulsechain.com'));
  //var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

  const XUSDVibeGovenorContractAddress = '0x20a7d24fd1e43f0c0b3d434cbd607ea6a62d5a3a';
  const XUSDVibeGovenorContract = new web3.eth.Contract(XUSDVibeGovenorContractABI, XUSDVibeGovenorContractAddress);

  console.log('Listening for events...');

  XUSDVibeGovenorContract.events.allEvents()
    .on('data', async (event) => {
      const eventDetails = `
        Event: ${event.event}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        Args: ${JSON.stringify(event.returnValues)}
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })
    .on('error', console.error);

  const VibePassContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
  const VibePassContract = new web3.eth.Contract(VibePassContractABI, VibePassContractAddress);

  VibePassContract.events.allEvents()
    .on('data', async (event) => {
      const eventDetails = `
        Event: ${event.event}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        Args: ${JSON.stringify(event.returnValues)}
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })
    .on('error', console.error);

  const VibeRegistryContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
  const VibeRegistryContract = new web3.eth.Contract(VibeRegistryContractABI, VibeRegistryContractAddress);

  VibeRegistryContract.events.allEvents()
    .on('data', async (event) => {
      const eventDetails = `
        Event: ${event.event}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        Args: ${JSON.stringify(event.returnValues)}
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })
    .on('error', console.error);

  const PulseLPContractAddress = '0x79fC0e8d904F7145d7eD2F1E74B96c806e9BF249';
  const PulseLPContract = new web3.eth.Contract(PulseLPContractABI, PulseLPContractAddress);

  PulseLPContract.events.allEvents()
    .on('data', async (event) => {
      const eventDetails = `
        Event: ${event.event}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        Args: ${JSON.stringify(event.returnValues)}
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })
    .on('error', console.error);
}

module.exports = { watchEvents };