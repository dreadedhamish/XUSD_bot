// charts.js
const fs = require("fs");
const path = require('path');
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const csv = require('csv-parser');

const axiosInstance = require("./axiosConfig");
const { bot, graphEndpoint, rpcEndpoint, saveLocation } = require("./bot");
require('dotenv').config(); // Load environment variables

const { getMidnightTimestamps, getBlockNumbers } = require('./helpers');

// Chart defaults
const width = 500; // width of the chart
const height = 300; // height of the chart
const backgroundColour = "black";
const borderColour = "rgba(255, 255, 255, 0.3)";
const colour = "rgba(255, 255, 255, 0.9)";

// Generic function to fetch data based on the GraphQL query
async function fetchData(query) {
  const response = await axiosInstance.post(
    graphEndpoint,
    { query },
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  const data = response.data;
  // console.log("response.data = ", data.data);
  return data.data;
}

// Function to format data for Chart.js
function formatDataForChart(data, token, isHourly = false, ticks) {
  let periods;
  const pair1Id = token.mainPair;
  console.log("token.mainPair = ", token.mainPair);
  const pair2Id = "0x146e1f1e060e5b5016db0d118d2c5a11a240ae32"; // DAI from Ethereum/WPLS v2

  if (isHourly) {
    // Group data by hourStartUnix
    const groupedData = data.pairHourDatas.reduce((acc, hourData) => {
      const hour = hourData.hourStartUnix;
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(hourData);
      return acc;
    }, {});

    // Calculate price and volume for each hour
    periods = Object.keys(groupedData)
      .map((hour) => {
        const items = groupedData[hour];
        const pair1 = items.find((item) => item.pair.id === pair1Id);
        const pair2 = items.find((item) => item.pair.id === pair2Id);

        if (pair1 && pair2) {
          const reserve1Pair1 = parseFloat(pair1.reserve1);
          const reserve0Pair1 = parseFloat(pair1.reserve0);
          const reserve1Pair2 = parseFloat(pair2.reserve1);
          const reserve0Pair2 = parseFloat(pair2.reserve0);

          console.log(`Hour: ${hour}`);
          // console.log(`Pair1 - Reserve1: ${reserve1Pair1}, Reserve0: ${reserve0Pair1}`);
          // console.log(`Pair2 - Reserve1: ${reserve1Pair2}, Reserve0: ${reserve0Pair2}`);

          let price;
          if (token.position === "token1") {
            price =
              (reserve0Pair1 / reserve1Pair1) * (reserve1Pair2 / reserve0Pair2);
          } else if (token.position === "token0") {
            price =
              (reserve1Pair1 / reserve0Pair1) * (reserve1Pair2 / reserve0Pair2);
          }

          const volume = parseFloat(pair1.hourlyVolumeUSD);

          // console.log(`Calculated Price: ${price}, Volume: ${volume}`);

          return {
            // date: ticks === 'hour' ? new Date(hour * 1000).getHours() : new Date(hour * 1000).getDate(), // Get hour or day without leading zeroes
            date: new Date(hour * 1000),
            price,
            volume,
          };
        } else {
          console.log(`Missing pair data for hour: ${hour}`);
        }
        return null;
      })
      .filter((item) => item !== null);
  } else {
    periods = data.tokenDayDatas.map((dayData) => ({
      date: new Date(dayData.date * 1000), // Get day without leading zeroes
      dailyVolumeUSD: parseFloat(dayData.dailyVolumeUSD),
      priceUSD: parseFloat(dayData.priceUSD),
    }));
  }

  const derivedUSD = parseFloat(data.pair.token1.derivedUSD);

  // Prepare data for Chart.js
  const labels = periods.map((period) => period.date);
  const dailyVolumes = periods.map(
    (period) => period.dailyVolumeUSD || period.volume
  );
  const prices = periods.map((period) => period.priceUSD || period.price);

  if (!isHourly) {
    labels.reverse();
    dailyVolumes.reverse();
    prices.reverse();
  }

  const todayPrice = derivedUSD;

  // Log the labels, dailyVolumes, prices, and todayPrice
  // console.log("Labels:", labels);
  // console.log("Daily Volumes:", dailyVolumes);
  // console.log("Prices:", prices);
  // console.log("Today Price:", todayPrice);

  // Add a placeholder for today's volume to keep the lengths consistent
  dailyVolumes.push(null);

  return {
    labels,
    datasets: [
      {
        label: "Daily Volume (USD)",
        data: dailyVolumes,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.3)",
        yAxisID: "y1",
        type: "bar",
      },
      {
        label: "Price (USD)",
        data: [...prices, todayPrice],
        borderColor: token.featureColour,
        // borderColor: "rgba(153, 0, 153, 1)",
        backgroundColor: token.featureColour,
        // backgroundColor: "rgba(153, 0, 153, 0.2)",
        yAxisID: "y2",
      },
    ],
  };
}

// Generic function to generate chart
async function generatePriceChart(
  query,
  title,
  token,
  isHourly = false,
  ticks = "hour"
) {
  const data = await fetchData(query);
  const chartData = formatDataForChart(data, token, isHourly, ticks);

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  let lastDisplayedDay = null;

  const configuration = {
    type: "line",
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false,
        },
      },
      scales: {
        y1: {
          type: "linear",
          position: "left",
          title: {
            display: true,
            text: "Volume (USD)",
            color: colour,
          },
          ticks: {
            callback: function (value) {
              return value >= 1000 ? value / 1000 + "k" : value;
            },
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false,
          },
        },
        y2: {
          type: "linear",
          position: "right",
          title: {
            display: true,
            text: "Price (USD)",
            color: colour,
          },
          ticks: {
            color: colour,
          },
          grid: {
            drawOnChartArea: false,
            color: borderColour,
            display: false,
          },
        },
        x: {
          ticks: {
            callback: (function () {
              let lastDisplayedDay = null;
              return function (value, index, values) {
                const date = new Date(chartData.labels[index]);
                const day = date.getDate();
                const hour = date.getHours();

                if (ticks === "hour" && isHourly) {
                  return index % 2 === 0 ? hour : ""; // Show every second hour
                } else {
                  if (day !== lastDisplayedDay) {
                    lastDisplayedDay = day;
                    return index % 2 === 0 ? day : ""; // Show every second day
                  } else {
                    return ""; // Skip displaying the day again
                  }
                }

                // if (ticks === "hour" && isHourly) {
                //   return hour; // Show just the hour number
                // } else {
                //   if (day !== lastDisplayedDay) {
                //     lastDisplayedDay = day;
                //     return day; // Display the day number
                //   } else {
                //     return ""; // Skip displaying the day again
                //   }
                // }
              };
            })(),
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false,
          },
        },
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false, // Ensure lines only appear where there is a label
    },
    datasets: chartData.datasets.map((dataset) => ({
      ...dataset,
      borderWidth: 0, // Turn off the lines
    })),
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

async function getBalancesForAddresses(addresses, tokenAddress, blockNumbers) {
  addresses = addresses.map(address => address.toLowerCase());
  tokenAddress = tokenAddress.toLowerCase();

  const requests = [];
  addresses.forEach((address) => {
    blockNumbers.forEach((block, index) => {
      const data = "0x70a08231000000000000000000000000" + address.slice(2);
      requests.push({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: tokenAddress,
            data: data
          },
          block.blockNumber
        ],
        id: index + 1
      });
    });
  });

  const response = await axiosInstance.post(rpcEndpoint, requests, {
    headers: { 'Content-Type': 'application/json' }
  });

  const balances = [];
  for (let i = 0; i < blockNumbers.length; i++) {
    let totalBalance = 0;
    for (let j = 0; j < addresses.length; j++) {
      const balanceHex = response.data[i * addresses.length + j].result;
      const balance = parseInt(balanceHex, 16) / 1e18;
      totalBalance += balance;
    }
    balances.push({
      timestamp: blockNumbers[i].timestamp,
      blockNumber: blockNumbers[i].blockNumber,
      balance: totalBalance
    });
  }

  return balances;
}

async function generateCirculatingSupplyChart(title, token, isHourly = false, ticks = 'day') {
  const timestamps = await getMidnightTimestamps(30);
  const blockNumbers = await getBlockNumbers(timestamps);
  const totalSupply = await getTotalSupply(blockNumbers, token);

  const addresses = [
    '0x3246F31aD1b00991965d7A68aeF694C4464d89Eb',
    '0xa5255A4E00d4e2762EA7e9e1Dc4Ecf68b981e760',
    '0x3173614ca9b65a0ae32f258b011b7e27e0f2b837',
    '0x31ad1d26eba0cab65be3589555e570502cc50286',
    '0x4cba293d2207c00558d832b03bd9e9da2a85a48c'
  ];
  const walletBalances = await getBalancesForAddresses(addresses, token.contractAddress, blockNumbers);

  const circulatingSupply = totalSupply.map((supply, index) => {
    const walletBalance = walletBalances.find(balance => balance.blockNumber === supply.blockNumber);
    return {
      timestamp: supply.timestamp,
      blockNumber: supply.blockNumber,
      balance: supply.balance - (walletBalance ? walletBalance.balance : 0)
    };
  });

  // Log the required information per blockNumber
  circulatingSupply.forEach((supply, index) => {
    const walletBalance = walletBalances.find(balance => balance.blockNumber === supply.blockNumber);
    console.log(`blockNumber: ${supply.blockNumber}, totalSupply: ${totalSupply[index].balance}, walletBalances: ${walletBalance ? walletBalance.balance : 0}, circulatingSupply: ${supply.balance}`);
  });

  // Extract labels (timestamps) and data (balances)
  const labels = circulatingSupply.map(entry => new Date(entry.timestamp * 1000).toISOString().split('T')[0]);
  const data = circulatingSupply.map(entry => entry.balance);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Circulating Supply',
        data: data,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 600, backgroundColour: 'white' });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: 'black',
          font: {
            size: 20
          }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Circulating Supply',
            color: 'black'
          },
          ticks: {
            callback: function(value) {
              return value >= 1000 ? (value / 1000) + 'k' : value;
            },
            color: 'black'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return hour; // Show just the hour number
              } else {
                return day; // Display the day number
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: 'black'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            display: false
          }
        }
      },
      layout: {
        backgroundColor: 'white'
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
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

//   // Sort the timestamps in ascending order
//   timestamps.sort((a, b) => a - b);

//   return timestamps;
// }

// async function getBlockNumbers(timestamps) {
//   const requests = timestamps.map((timestamp, index) => ({
//     jsonrpc: "2.0",
//     method: "erigon_getBlockByTimestamp",
//     params: [timestamp.toString(), false],
//     id: index + 1
//   }));

//   const response = await axiosInstance.post(rpcEndpoint, requests, {
//     headers: { 'Content-Type': 'application/json' }
//   });

//   return response.data.map(res => ({
//     timestamp: timestamps[res.id - 1],
//     blockNumber: res.result.number
//   }));
// }

async function getTotalSupply(blockNumbers, token) {
  let contractAddress = token.contractAddress;
  if (typeof contractAddress !== 'string') {
    throw new Error('Invalid contract address');
  }
  contractAddress = contractAddress.toLowerCase();
  const requests = blockNumbers.map((block, index) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: contractAddress,
        data: "0x18160ddd"
      },
      block.blockNumber
    ],
    id: index + 1
  }));

  const response = await axiosInstance.post(rpcEndpoint, requests, {
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data.map((res, index) => {
    const balanceHex = res.result;
    const balance = parseInt(balanceHex, 16) / 1e18;
    return {
      timestamp: blockNumbers[index].timestamp,
      blockNumber: blockNumbers[index].blockNumber,
      balance: balance
    };
  });
}

async function generateSupplyChart(title, token, isHourly = false, ticks = 'day') {
  const timestamps = await getMidnightTimestamps(30);
  const blockNumbers = await getBlockNumbers(timestamps);
  console.log('blockNumbers = ', blockNumbers);
  const balances = await getTotalSupply(blockNumbers, token);
  console.log(balances);

  // Extract labels (timestamps) and data (balances)
  const labels = balances.map(entry => new Date(entry.timestamp * 1000).toISOString().split('T')[0]);
  const data = balances.map(entry => entry.balance);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Total Supply',
        data: data,
        borderColor: token.featureColour,
        // backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Total Supply',
            color: colour
          },
          ticks: {
            callback: function(value) {
              return value >= 1000000 ? (value / 1000000) + 'M' : value;
            },
            color: colour
          },
          grid: {
            color: borderColour,
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return index % 2 === 0 ? hour : ''; // Show just the hour number for every second tick
              } else {
                return index % 2 === 0 ? day : ''; // Display the day number for every second tick
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false
          }
        }
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };
  
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

async function getMarketCap(blockNumbers, token) {
  let contractAddress = token.contractAddress;
  if (typeof contractAddress !== 'string') {
    throw new Error('Invalid contract address');
  }
  contractAddress = contractAddress.toLowerCase();

  // Create batch request data for total supply
  const supplyRequests = blockNumbers.map((block, index) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: contractAddress,
        data: "0x18160ddd" // totalSupply() method signature
      },
      block.blockNumber
    ],
    id: index + 1
  }));

  // Fetch total supply data
  const supplyResponse = await axiosInstance.post(rpcEndpoint, supplyRequests, {
    headers: { 'Content-Type': 'application/json' }
  });

  const totalSupplies = supplyResponse.data.map((res, index) => {
    const balanceHex = res.result;
    const balance = parseInt(balanceHex, 16) / 1e18;
    return {
      timestamp: blockNumbers[index].timestamp,
      blockNumber: blockNumbers[index].blockNumber,
      totalSupply: balance
    };
  });
  console.log('totalSupplies = ', totalSupplies);

  // Create GraphQL query for prices
  const priceQueries = blockNumbers.map((block, index) => `
    pair${index}: pair(id: "${token.mainPair}", block: { number: ${parseInt(block.blockNumber, 16)} }) {
      token1 {
        derivedUSD
      }
    }
  `).join('\n');

  const priceQuery = `
    {
      ${priceQueries}
    }
  `;

  // Log the priceQuery
  console.log('priceQuery:', priceQuery);

  // Fetch price data
  const priceResponse = await axiosInstance.post(graphEndpoint, { query: priceQuery }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000
  });
  console.log('priceResponse = ', priceResponse);

  const prices = blockNumbers.map((block, index) => {
    const priceData = priceResponse.data.data[`pair${index}`];
    const price = parseFloat(priceData.token1.derivedUSD);
    return {
      timestamp: block.timestamp,
      blockNumber: block.blockNumber,
      price: price
    };
  });

  // Calculate market cap for each block number
  const marketCaps = blockNumbers.map((block, index) => {
    const totalSupply = totalSupplies[index].totalSupply;
    const price = prices[index].price;
    const marketCap = totalSupply * price;
    return {
      timestamp: block.timestamp,
      blockNumber: block.blockNumber,
      marketCap: marketCap
    };
  });

  return marketCaps;
}

async function generateMCapChart(title, token, isHourly = false, ticks = 'day') {
  const timestamps = await getMidnightTimestamps(30);
  const blockNumbers = await getBlockNumbers(timestamps);
  console.log('blockNumbers = ', blockNumbers);
  const mcaps = await getMarketCap(blockNumbers, token);
  console.log(mcaps);

  // Extract labels (timestamps) and data (balances)
  const labels = mcaps.map(entry => new Date(entry.timestamp * 1000).toISOString().split('T')[0]);
  // const data = mcaps.map(entry => entry.balance);
  const data = mcaps.map(entry => entry.marketCap);


  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Market Cap',
        data: data,
        borderColor: token.featureColour,
        // backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Market Cap',
            color: colour
          },
          ticks: {
            callback: function(value) {
              return value >= 1000000 ? (value / 1000000) + 'M' : value;
            },
            color: colour
          },
          grid: {
            color: borderColour,
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return index % 2 === 0 ? hour : ''; // Show just the hour number for every second tick
              } else {
                return index % 2 === 0 ? day : ''; // Display the day number for every second tick
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false
          }
        }
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };
  
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

async function getBurned(blockNumbers, token) {
  let contractAddress = token.contractAddress;
  if (typeof contractAddress !== 'string') {
    throw new Error('Invalid contract address');
  }
  contractAddress = contractAddress.toLowerCase();
  // Function: totalBurned(), Selector: d89135cd
  const requests = blockNumbers.map((block, index) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: contractAddress,
        data: "0xd89135cd"
      },
      block.blockNumber
    ],
    id: index + 1
  }));

  const response = await axiosInstance.post(rpcEndpoint, requests, {
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data.map((res, index) => {
    const balanceHex = res.result;
    const balance = parseInt(balanceHex, 16) / 1e18;
    return {
      timestamp: blockNumbers[index].timestamp,
      blockNumber: blockNumbers[index].blockNumber,
      balance: balance
    };
  });
}

async function generateBurnedChart(title, token, isHourly = false, ticks = 'day') {
  const timestamps = await getMidnightTimestamps(30);
  const blockNumbers = await getBlockNumbers(timestamps);
  // console.log('blockNumbers = ', blockNumbers);
  const burned = await getBurned(blockNumbers, token);
  // console.log(burned);

  // Extract labels (timestamps) and data (balances)
  const labels = burned.map(entry => new Date(entry.timestamp * 1000).toISOString().split('T')[0]);
  const data = burned.map(entry => entry.balance);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Balance',
        data: data,
        borderColor: token.featureColour,
        // backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Total Burned',
            color: colour
          },
          ticks: {
            callback: function(value) {
              return value >= 1000000 ? (value / 1000000) + 'M' : value;
            },
            color: colour
          },
          grid: {
            color: borderColour,
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return index % 2 === 0 ? hour : ''; // Show just the hour number for every second tick
              } else {
                return index % 2 === 0 ? day : ''; // Display the day number for every second tick
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false
          }
        }
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

async function OLDgetHolders(blockNumbers, token) {
  let contractAddress = token.contractAddress;
  if (typeof contractAddress !== 'string') {
    throw new Error('Invalid contract address');
  }
  contractAddress = contractAddress.toLowerCase();
  const requests = blockNumbers.map((block, index) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: contractAddress,
        data: "0x18160ddd"
      },
      block.blockNumber
    ],
    id: index + 1
  }));

  const response = await axiosInstance.post(rpcEndpoint, requests, {
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data.map((res, index) => {
    const balanceHex = res.result;
    const balance = parseInt(balanceHex, 16) / 1e18;
    return {
      timestamp: blockNumbers[index].timestamp,
      blockNumber: blockNumbers[index].blockNumber,
      balance: balance
    };
  });
}

async function OLDgenerateHoldersChart(title, token, isHourly = false, ticks = 'day') {
  const timestamps = await getMidnightTimestamps(30);
  const blockNumbers = await getBlockNumbers(timestamps);
  console.log('blockNumbers = ', blockNumbers);
  const balances = await getHolders(blockNumbers, token);
  console.log(balances);

  // Extract labels (timestamps) and data (balances)
  const labels = balances.map(entry => new Date(entry.timestamp * 1000).toISOString().split('T')[0]);
  const data = balances.map(entry => entry.balance);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Total Supply',
        data: data,
        borderColor: token.featureColour,
        // backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Total Burned',
            color: colour
          },
          ticks: {
            callback: function(value) {
              return value >= 1000000 ? (value / 1000000) + 'M' : value;
            },
            color: colour
          },
          grid: {
            color: borderColour,
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return index % 2 === 0 ? hour : ''; // Show just the hour number for every second tick
              } else {
                return index % 2 === 0 ? day : ''; // Display the day number for every second tick
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false
          }
        }
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };
  
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

// Function to fetch data from Google Sheets
async function fetchGoogleSheetData(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
  // const response = await axios.get(url);
  const response = await axiosInstance.get(url);
  // const response = await axiosInstance.post(rpcEndpoint, requests, {
  //   headers: { 'Content-Type': 'application/json' }
  // });
  
  return response.data;
}

// Function to parse CSV data
function parseCsvData(csvData) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require('stream');
    const csvStream = csv();
    const readableStream = new stream.Readable();
    readableStream._read = () => {}; // No-op
    readableStream.push(csvData);
    readableStream.push(null);

    readableStream
      .pipe(csvStream)
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Function to generate holders chart
async function generateHoldersChart(token, sheetId, sheetName, title, isHourly = false, ticks = 'day') {
  // Fetch data from Google Sheets
  const csvData = await fetchGoogleSheetData(sheetId, sheetName);
  let data = await parseCsvData(csvData); // Use let instead of const

  // Restrict to the last 30 values
  data = data.slice(-30);

  // Extract labels and data
  const labels = data.map(row => new Date(row['Timestamp']).toISOString().split('T')[0]);
  const holdersData = data.map(row => parseInt(row['Holders'], 10));

  // Prepare chart data
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Holders',
        data: holdersData,
        borderColor: token.featureColour,
        // backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
      }
    ]
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const configuration = {
    type: 'line',
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          color: colour,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Users',
            color: colour
          },
          ticks: {
            callback: function(value) {
              return value >= 1000000 ? (value / 1000000) + 'M' : value;
            },
            color: colour
          },
          grid: {
            color: borderColour,
            display: false
          }
        },
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(chartData.labels[index]);
              const day = date.getDate();
              const hour = date.getHours();
              
              if (ticks === 'hour' && isHourly) {
                return index % 2 === 0 ? hour : ''; // Show just the hour number for every second tick
              } else {
                return index % 2 === 0 ? day : ''; // Display the day number for every second tick
              }
            },
            autoSkip: false, // Ensure all ticks are considered
            maxRotation: 0, // Prevent rotation of labels
            minRotation: 0, // Prevent rotation of labels
            color: colour,
          },
          grid: {
            color: borderColour,
            display: false
          }
        }
      },
      layout: {
        backgroundColor: backgroundColour,
      },
      spanGaps: false // Ensure lines only appear where there is a label
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration); // , 'image'
  fs.writeFileSync(`${saveLocation}/${title}.png`, imageBuffer);
  return `${saveLocation}/${title}.png`; // Return the file path
}

// Export the functions
module.exports = {
  generatePriceChart,
  generateSupplyChart,
  generateBurnedChart,
  generateHoldersChart,
  generateMCapChart
};
