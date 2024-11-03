// import Web3 from 'web3';
const { Web3 } = require('web3');

// set a provider - MUST be a WebSocket(WSS) provider
// const web3 = new Web3("wss://rpc.pulsechain.com");

const web3 = new Web3("ws://192.168.1.103:8546");

const XUSDVibeGovenorContractAddress = '0x20a7d24fd1e43f0c0b3d434cbd607ea6a62d5a3a';
const XUSDVibeGovenorContractABI = require('./ABI/XUSDVibeGovenor.json');
const XUSDVibeGovenorContract = new web3.eth.Contract(XUSDVibeGovenorContractABI, XUSDVibeGovenorContractAddress);

const VibePassContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
const VibePassContractABI = require('./ABI/VibePass.json'); 
const VibePassContract = new web3.eth.Contract(VibePassContractABI, VibePassContractAddress);

const VibeRegistryContractAddress = '0xEa246e011aF35414F103022883D2A224C35252F3';
const VibeRegistryContractABI = require('./ABI/VibeRegistry.json'); 
const VibeRegistryContract = new web3.eth.Contract(VibeRegistryContractABI, VibeRegistryContractAddress);

const PulseLPContractABI = require('./ABI/PulseLP.json');
const PulseLPContractAddress = '0x79fC0e8d904F7145d7eD2F1E74B96c806e9BF249';
const PulseLPContract = new web3.eth.Contract(PulseLPContractABI, PulseLPContractAddress);

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
  // create a new contract object, providing the ABI and address
  // const contract = new web3.eth.Contract(abi, address);
  //const PulseLPContract = new web3.eth.Contract(PulseLPContractABI, PulseLPContractAddress);

  // // subscribe to the smart contract event
  // const subscription = contract.events.Swap();
  //const subscription = contract.events.allEvents();

  // // new value every time the event is emitted
  //subscription.on("data", console.log);

  // PulseLPContract.events.allEvents()
  //   .on('data', async (event) => {
  //     const serializedReturnValues = serializeEvent(event.returnValues);
  //     const eventDetails = `
  //       Event: ${event.event}
  //     `;
  //     console.log('Event received:', eventDetails);
  //     await sendTelegramMessage(bot, eventDetails);
  //   })

  //   /*
  //   Event: ${event.event}       
  //   Block Number: ${event.blockNumber}
  //   Transaction Hash: ${event.transactionHash}
  //   Args: ${JSON.stringify(serializedReturnValues)} 
  //   */

  // PulseLPContract.events.allEvents()
  //   .on('error', console.error);


  VibeRegistryContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Event: ${event.event}
 
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })

  VibeRegistryContract.events.allEvents()
    .on('error', console.error);


  XUSDVibeGovenorContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Event: ${event.event}
 
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })

    XUSDVibeGovenorContract.events.allEvents()
    .on('error', console.error);

  VibePassContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Event: ${event.event}
        
      `;
      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })

  VibePassContract.events.allEvents()
    .on('error', console.error);


  console.log('Listening for events...');


  // const XUSDVibeGovenorContractAddress = '0x20a7d24fd1e43f0c0b3d434cbd607ea6a62d5a3a';
  // const XUSDVibeGovenorContract = new web3.eth.Contract(XUSDVibeGovenorContractABI, XUSDVibeGovenorContractAddress);

  // XUSDVibeGovenorContract.events.allEvents()
  //   .on('data', async (event) => {
  //     const eventDetails = `
  //       Event: ${event.event}
  //       Block Number: ${event.blockNumber}
  //       Transaction Hash: ${event.transactionHash}
  //       Args: ${JSON.stringify(event.returnValues)}
  //     `;
  //     console.log('Event received:', eventDetails);
  //     await sendTelegramMessage(bot, eventDetails);
  //   })
  //   .on('error', console.error);

  

}

// function to unsubscribe from a subscription
async function unsubscribe(subscription) {
    await subscription.unsubscribe();
}

module.exports = { subscribe };
// subscribe();
// unsubscribe(subscription);