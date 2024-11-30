// import Web3 from 'web3';
const { Web3 } = require('web3');

// set a provider - MUST be a WebSocket(WSS) provider
// const web3 = new Web3("wss://rpc.pulsechain.com");

const options = {
  timeout: 30000, // ms
  clientConfig: {
    // Useful if requests are large
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

const web3 = new Web3(new Web3.providers.WebsocketProvider("ws://192.168.1.103:8546", options));


// const XUSDVibeGovenorContractAddress = '0x20a7d24fd1e43f0c0b3d434cbd607ea6a62d5a3a';
// const XUSDVibeGovenorContractABI = require('./ABI/XUSDVibeGovenor.json');
// const XUSDVibeGovenorContract = new web3.eth.Contract(XUSDVibeGovenorContractABI, XUSDVibeGovenorContractAddress);

const VibePassContractAddress = '0x0e0Deb1C756d81c19235CF6C832377bC481cA05A';
const VibePassContractABI = require('./ABI/VibePass.json'); 
const VibePassContract = new web3.eth.Contract(VibePassContractABI, VibePassContractAddress);

const VibeRegistryContractAddress = '0x65B6A8293f8f3f51F19DF29Fd79548C7514EB99c';
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
  //       Block Number: ${event.blockNumber}
  //       Transaction Hash: ${event.transactionHash}
  //       Args: ${JSON.stringify(serializedReturnValues)}
  //     `;
  //     console.log('Event received:', eventDetails);
  //     // await sendTelegramMessage(bot, eventDetails);
  //   })

  // //   /*
  // //   Event: ${event.event}       
  // //   Block Number: ${event.blockNumber}
  // //   Transaction Hash: ${event.transactionHash}
  // //   Args: ${JSON.stringify(serializedReturnValues)} 
  // //   */

  // PulseLPContract.events.allEvents()
  //   .on('error', console.error);


  VibeRegistryContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Contract: VibeRegistry - Event: ${event.event}
        Timestamp: ${new Date().toISOString()}
      `;

      // ClassAdded
      // ClassRemoved
      // ContractRemovedFromWhitelistFrom
      // ContractRemovedFromWhitelistTo
      // ContractWhitelistedFrom
      // ContractWhitelistedTo
      // NewBlockProcessed
      // RewardsCalculated
      // RewardsCalculationFailed
      // TaxParametersUpdated
      // TradingRewardsSet
      // TransactionRecorded
      // VibeClassRemoved
      // VibesCalculated
      // VibesCalculationFailed

      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })

  VibeRegistryContract.events.allEvents()
    .on('error', console.error);

  // XUSDVibeGovenorContract.events.allEvents()
  //   .on('data', async (event) => {
  //     const serializedReturnValues = serializeEvent(event.returnValues);
  //     const eventDetails = `
  //       Event: ${event.event}
  //     `;
  //     console.log('Event received:', eventDetails);
  //     await sendTelegramMessage(bot, eventDetails);
  //   })

  //   XUSDVibeGovenorContract.events.allEvents()
  //   .on('error', console.error);

  VibePassContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Contract: VibePass: 
        Event: ${event.event}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        Args: ${JSON.stringify(serializedReturnValues)}
      `;

      // PassMinted
      // PassTransferred
      // UserGladiatorRankUpgrade
      // GladiatorRankUpdated
      // VotesUpdated

      console.log('Event received:', eventDetails);
      await sendTelegramMessage(bot, eventDetails);
    })

  VibePassContract.events.allEvents()
    .on('error', console.error);


  // Trading Rewards Refiller

  const TradingRewardsFillerContractABI = require('./ABI/tradingRewardsFiller.json');
  const TradingRewardsFillerContractAddress = '0x3A0410290940b68b7b2032Fab87BF6E1e3647b48';
  const TradingRewardsFillerContract = new web3.eth.Contract(TradingRewardsFillerContractABI, TradingRewardsFillerContractAddress);

  TradingRewardsFillerContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Contract: Trading Rewards Refiller: Event: ${event.event} Args: ${JSON.stringify(serializedReturnValues)}
      `;
      // console.log('Event received:', eventDetails);
      // await sendTelegramMessage(bot, eventDetails);
    })
    
  TradingRewardsFillerContract.events.allEvents()  
    .on('error', console.error);

    // Staking Rewards Refiller

  const StakingRefillerContractABI = require('./ABI/refillStaking.json');
  const StakingRefillerContractAddress = '0xC9BAa3A2c23A6Ff2b2A02C4DAd3A17391f282Fb5';
  const StakingRefillerContract = new web3.eth.Contract(StakingRefillerContractABI, StakingRefillerContractAddress);

  StakingRefillerContract.events.allEvents()
    .on('data', async (event) => {
      const serializedReturnValues = serializeEvent(event.returnValues);
      const eventDetails = `
        Contract: Staking Refiller: Event: ${event.event} Args: ${JSON.stringify(serializedReturnValues)}
        Block Number: ${event.blockNumber}
        Transaction Hash: ${event.transactionHash}
        `;
      // console.log('Event received:', eventDetails);
      // await sendTelegramMessage(bot, eventDetails);
    })

  StakingRefillerContract.events.allEvents()
  .on('error', console.error);




  console.log('Listening for events...');
  

}

// function to unsubscribe from a subscription
async function unsubscribe(subscription) {
    await subscription.unsubscribe();
}

module.exports = { subscribe };
// subscribe();
// unsubscribe(subscription);